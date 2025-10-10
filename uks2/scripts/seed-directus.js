#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (typeof fetch !== 'function') {
  console.error('This script requires Node.js 18+ with the global fetch API.');
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = new Set();
let dataFile = path.join(__dirname, 'seed-data.json');
let maxImages = 12;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--dry-run') {
    flags.add('dry-run');
    continue;
  }
  if (arg === '--truncate') {
    flags.add('truncate');
    continue;
  }
  if (arg === '--skip-images') {
    flags.add('skip-images');
    continue;
  }
  if (arg.startsWith('--data=')) {
    dataFile = path.resolve(process.cwd(), arg.slice('--data='.length));
    continue;
  }
  if (arg === '--data' && args[index + 1]) {
    dataFile = path.resolve(process.cwd(), args[index + 1]);
    index += 1;
    continue;
  }
  if (arg.startsWith('--max-images=')) {
    const value = Number.parseInt(arg.slice('--max-images='.length), 10);
    if (Number.isFinite(value) && value > 0) {
      maxImages = value;
    }
    continue;
  }
  if (arg === '--max-images' && args[index + 1]) {
    const value = Number.parseInt(args[index + 1], 10);
    if (Number.isFinite(value) && value > 0) {
      maxImages = value;
    }
    index += 1;
    continue;
  }
  console.warn('Unknown argument:', arg);
}

const dryRun = flags.has('dry-run');
const skipImages = flags.has('skip-images');
const truncateCollections = flags.has('truncate');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      return;
    }
    const [rawKey, ...rest] = line.split('=');
    const key = rawKey.trim();
    if (!key || process.env[key]) {
      return;
    }
    const value = rest.join('=').trim();
    process.env[key] = value;
  });
}

const directusUrl = (process.env.DIRECTUS_INTERNAL_URL || process.env.DIRECTUS_PUBLIC_URL || 'http://localhost:8055').replace(/\/$/, '');
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  if (dryRun) {
    console.warn('DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD не заданы — используем фиктивные значения для dry-run.');
    process.env.DIRECTUS_ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'dry-run@example.com';
    process.env.DIRECTUS_ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'dry-run';
  } else {
    console.error('DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD must be set via environment variables or uks2/.env.');
    process.exit(1);
  }
}

if (!fs.existsSync(dataFile)) {
  console.error('Cannot find seed data file at', dataFile);
  process.exit(1);
}

const seedData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

function logStep(message) {
  process.stdout.write(`\n==> ${message}\n`);
}

function withAuth(token, options = {}) {
  const headers = Object.assign({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }, options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return Object.assign({}, options, { headers });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let details = '';
    try {
      const parsed = await response.json();
      details = JSON.stringify(parsed, null, 2);
    } catch (error) {
      details = await response.text();
    }
    throw new Error(`Request to ${url} failed with status ${response.status}: ${details}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {};
  }
  return response.json();
}

async function getPublicRoleId(token) {
  const params = new URLSearchParams();
  params.set('limit', '-1');
  params.append('fields[]', 'id');
  params.append('fields[]', 'name');
  params.append('fields[]', 'key');
  const url = `${directusUrl}/roles?${params.toString()}`;
  const response = await requestJson(url, withAuth(token));
  const roles = Array.isArray(response?.data) ? response.data : [];
  const match = roles.find((role) => role?.key === 'public') || roles.find((role) => role?.name?.toLowerCase() === 'public');
  if (match?.id) {
    return match.id;
  }
  throw new Error('Не удалось найти публичную роль в Directus.');
}

async function upsertPermission(token, roleId, collection, action, payload) {
  const params = new URLSearchParams();
  params.set('filter[role][_eq]', roleId);
  params.set('filter[collection][_eq]', collection);
  params.set('filter[action][_eq]', action);
  const url = `${directusUrl}/permissions?${params.toString()}`;
  const existingResponse = await requestJson(url, withAuth(token));
  const existing = Array.isArray(existingResponse?.data) ? existingResponse.data[0] : undefined;
  if (existing?.id) {
    await requestJson(`${directusUrl}/permissions/${existing.id}`, withAuth(token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }));
    return existing.id;
  }
  const created = await requestJson(`${directusUrl}/permissions`, withAuth(token, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ role: roleId, collection, action }, payload)),
  }));
  return created?.data?.id;
}

async function ensurePublicApiAccess(token) {
  logStep('Ensuring public API permissions');
  const roleId = await getPublicRoleId(token);
  const collections = ['homepage', 'projects', 'procurements', 'documents', 'news_articles', 'contacts'];
  const payload = { fields: '*', permissions: {}, validation: {} };
  for (const collection of collections) {
    await upsertPermission(token, roleId, collection, 'read', payload);
  }
}

async function authenticate() {
  logStep('Authenticating with Directus');
  const url = `${directusUrl}/auth/login`;
  const payload = {
    email: adminEmail,
    password: adminPassword,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cannot authenticate: ${response.status} ${text}`);
  }
  const result = await response.json();
  if (!result?.data?.access_token) {
    throw new Error('Missing access token in Directus auth response');
  }
  return result.data.access_token;
}

async function ensureSingleton(token, collection) {
  if (dryRun) {
    console.log(`[dry-run] Would ensure singleton ${collection}`);
    return;
  }
  try {
    await requestJson(`${directusUrl}/items/${collection}`, withAuth(token));
  } catch (error) {
    if (!/404/.test(String(error.message))) {
      throw error;
    }
    await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
      method: 'POST',
      body: JSON.stringify({}),
    }));
  }
}

async function updateSingleton(token, collection, payload) {
  if (dryRun) {
    console.log(`[dry-run] Would update singleton ${collection} with`, payload);
    return;
  }
  await ensureSingleton(token, collection);
  await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

async function listIds(token, collection) {
  const response = await requestJson(`${directusUrl}/items/${collection}?limit=-1&fields=id`, withAuth(token));
  return Array.isArray(response?.data) ? response.data.map((item) => item.id).filter((id) => id !== null && id !== undefined) : [];
}

async function truncateCollection(token, collection) {
  if (dryRun) {
    console.log(`[dry-run] Would truncate ${collection}`);
    return;
  }
  const ids = await listIds(token, collection);
  if (!ids.length) {
    return;
  }
  const chunkSize = 25;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
      method: 'DELETE',
      body: JSON.stringify({ keys: chunk }),
    }));
  }
}

async function findExisting(token, collection, filterField, filterValue) {
  if (filterValue === undefined || filterValue === null || filterValue === '') {
    return null;
  }
  const search = new URLSearchParams();
  search.append(`filter[${filterField}][_eq]`, String(filterValue));
  search.append('limit', '1');
  search.append('fields', 'id');
  const response = await requestJson(`${directusUrl}/items/${collection}?${search.toString()}`, withAuth(token));
  const first = Array.isArray(response?.data) ? response.data[0] : null;
  return first?.id ?? null;
}

async function upsertItem(token, collection, filterField, payload) {
  if (dryRun) {
    const filterValue = payload[filterField];
    console.log(`[dry-run] Would upsert ${collection} (${filterField}=${filterValue ?? 'n/a'})`);
    return null;
  }
  const filterValue = payload[filterField];
  const existingId = await findExisting(token, collection, filterField, filterValue);
  if (existingId) {
    await requestJson(`${directusUrl}/items/${collection}/${existingId}`, withAuth(token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }));
    return existingId;
  }
  const response = await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
  return response?.data?.id ?? null;
}

function parseImageSources(data) {
  const unique = new Set();
  const result = [];
  const sources = Array.isArray(data.imageSources) ? data.imageSources : [];
  sources.forEach((entry) => {
    if (typeof entry === 'string' && entry) {
      const value = entry.trim();
      if (value && !unique.has(value)) {
        unique.add(value);
        result.push(value);
      }
    }
  });
  return result;
}

async function scrapeImagesFrom(url) {
  const headers = {
    'User-Agent': 'uks2-seeder/1.0 (+https://uks.delightsoft.ru)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const html = await response.text();
  const matches = new Set();
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) {
      continue;
    }
    try {
      const absolute = new URL(raw, url).toString();
      const hostname = new URL(absolute).hostname;
      if (!hostname.endsWith('uks.irkutsk.ru')) {
        continue;
      }
      if (!matches.has(absolute)) {
        matches.add(absolute);
      }
    } catch (error) {
      // ignore invalid URLs
    }
  }
  return Array.from(matches);
}

async function importRemoteFile(token, image) {
  if (!image?.url) {
    return null;
  }
  try {
    const body = {
      url: image.url,
      title: image.title || image.url,
      data: {},
    };
    if (image.description) {
      body.data.description = image.description;
    }
    if (dryRun) {
      console.log(`[dry-run] Would import file ${image.url}`);
      return null;
    }
    const response = await requestJson(`${directusUrl}/files/import`, withAuth(token, {
      method: 'POST',
      body: JSON.stringify(body),
    }));
    return response?.data?.id ?? null;
  } catch (error) {
    console.warn('Failed to import image', image.url, error.message);
    return null;
  }
}

async function collectImages(token) {
  if (dryRun) {
    console.log('Dry-run: skipping remote image scraping.');
    return new Map();
  }
  if (skipImages) {
    console.log('Skipping image import per --skip-images flag.');
    return new Map();
  }
  logStep('Collecting illustrative images from uks.irkutsk.ru');
  const collected = new Map();
  const sources = parseImageSources(seedData);
  for (const source of sources) {
    if (collected.size >= maxImages) {
      break;
    }
    try {
      const urls = await scrapeImagesFrom(source);
      for (const url of urls) {
        if (collected.has(url)) {
          continue;
        }
        collected.set(url, null);
        if (collected.size >= maxImages) {
          break;
        }
      }
    } catch (error) {
      console.warn('Unable to scrape images from', source, error.message);
    }
  }

  const manual = Array.isArray(seedData.manualImages) ? seedData.manualImages : [];
  for (const entry of manual) {
    if (collected.size >= maxImages) {
      break;
    }
    if (!collected.has(entry.url)) {
      collected.set(entry.url, null);
    }
  }

  let index = 0;
  for (const url of Array.from(collected.keys())) {
    if (collected.get(url)) {
      continue;
    }
    const image = manual.find((item) => item.url === url) || { url };
    const fileId = await importRemoteFile(token, image);
    collected.set(url, fileId);
    index += 1;
    if (index >= maxImages) {
      break;
    }
  }

  return collected;
}

async function seedHomepage(token) {
  logStep('Updating homepage singleton');
  const hero = seedData.homepage?.hero || {};
  const about = seedData.homepage?.about || {};
  const flagship = seedData.homepage?.flagship || {};
  const payload = {
    hero_title: hero.title || null,
    hero_subtitle: hero.subtitle || null,
    hero_primary_label: hero.primaryCta?.label || null,
    hero_primary_href: hero.primaryCta?.href || null,
    hero_secondary_label: hero.secondaryCta?.label || null,
    hero_secondary_href: hero.secondaryCta?.href || null,
    hero_stats: Array.isArray(hero.stats) ? hero.stats : null,
    about_intro: about.intro || null,
    about_values: Array.isArray(about.values) ? about.values : null,
    flagship_title: flagship.title || null,
    flagship_description: flagship.description || null,
    flagship_highlights: Array.isArray(flagship.highlights) ? flagship.highlights : null,
  };
  await updateSingleton(token, 'homepage', payload);
}

async function seedContacts(token) {
  logStep('Updating contacts singleton');
  const contacts = seedData.contacts || {};
  const payload = {
    address: contacts.address || null,
    phone: contacts.phone || null,
    email: contacts.email || null,
    schedule: contacts.schedule || null,
    lat: typeof contacts.lat === 'number' ? contacts.lat : null,
    lng: typeof contacts.lng === 'number' ? contacts.lng : null,
  };
  await updateSingleton(token, 'contacts', payload);
}

async function seedCollection(token, collection, filterField, entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return;
  }
  logStep(`Seeding ${collection}`);
  for (const entry of entries) {
    const payload = Object.assign({}, entry);
    if ('imageUrl' in payload) {
      delete payload.imageUrl;
    }
    await upsertItem(token, collection, filterField, payload);
  }
}

async function main() {
  try {
    let token;
    if (dryRun) {
      console.log('Запущен в режиме dry-run — запросы к Directus не выполняются.');
      token = 'dry-run';
    } else {
      token = await authenticate();
      await ensurePublicApiAccess(token);
    }

    const importedImages = await collectImages(token);
    if (importedImages && importedImages.size) {
      console.log(`Импортировано изображений: ${Array.from(importedImages.values()).filter(Boolean).length}`);
    }

    if (truncateCollections) {
      logStep('Truncating collections before seeding');
      await truncateCollection(token, 'projects');
      await truncateCollection(token, 'procurements');
      await truncateCollection(token, 'documents');
      await truncateCollection(token, 'news_articles');
    }

    await seedHomepage(token);
    await seedContacts(token);
    await seedCollection(token, 'projects', 'slug', seedData.projects);
    await seedCollection(token, 'procurements', 'slug', seedData.procurements);
    await seedCollection(token, 'documents', 'title', seedData.documents);
    await seedCollection(token, 'news_articles', 'title', seedData.news);

    logStep('Seeding completed successfully');
  } catch (error) {
    console.error('\nSeeding failed:', error.message);
    process.exitCode = 1;
  }
}

main();
