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

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const directusUrl = (process.env.DIRECTUS_INTERNAL_URL || process.env.DIRECTUS_PUBLIC_URL || 'http://localhost:8055').replace(/\/$/, '');
const directusWaitTimeoutMs = parsePositiveInteger(process.env.DIRECTUS_WAIT_TIMEOUT_MS, 60000);
const directusWaitIntervalMs = parsePositiveInteger(process.env.DIRECTUS_WAIT_INTERVAL_MS, 2000);
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

let currentStep = 'initializing';

function logStep(message) {
  currentStep = message;
  process.stdout.write(`\n==> ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logErrorDetails(error, indent = '', seen = new WeakSet()) {
  if (!error) {
    console.error(`${indent}(no error object provided)`);
    return;
  }
  if (typeof error !== 'object') {
    console.error(`${indent}${String(error)}`);
    return;
  }
  if (seen.has(error)) {
    console.error(`${indent}[circular reference]`);
    return;
  }
  seen.add(error);

  const name = error.name || error.constructor?.name || 'Error';
  const message = error.message || '(no message)';
  console.error(`${indent}${name}: ${message}`);

  if (error.stack) {
    const stackLines = String(error.stack).split('\n');
    const [, ...rest] = stackLines;
    if (rest.length) {
      console.error(`${indent}Stack trace:`);
      rest.forEach((line) => {
        console.error(`${indent}${line.trim()}`);
      });
    }
  }

  const extraKeys = Object.keys(error).filter((key) => !['name', 'message', 'stack', 'cause'].includes(key) && error[key] !== undefined);
  if (extraKeys.length) {
    const extra = {};
    extraKeys.forEach((key) => {
      extra[key] = error[key];
    });
    console.error(`${indent}Additional fields:`, extra);
  }

  if (error.cause) {
    console.error(`${indent}Caused by:`);
    logErrorDetails(error.cause, `${indent}  `, seen);
  }
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
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const method = options.method || 'GET';
    throw new Error(`Request to ${url} (${method}) failed: ${error.message || error}`, { cause: error });
  }
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

async function waitForDirectusAvailability() {
  if (!directusUrl) {
    return;
  }
  logStep('Waiting for Directus to become reachable');
  const healthUrl = `${directusUrl}/server/health`;
  const startTime = Date.now();
  const deadline = startTime + directusWaitTimeoutMs;
  let attempt = 0;
  let lastError = null;

  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const fetchOptions = {
        method: 'GET',
        headers: { Accept: 'application/json' },
      };
      let controller;
      let timeoutId;
      const timeoutMs = Math.max(1000, directusWaitIntervalMs);
      if (typeof AbortController === 'function') {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        fetchOptions.signal = controller.signal;
      }
      let response;
      try {
        response = await fetch(healthUrl, fetchOptions);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
      if (response.ok) {
        try {
          const body = await response.json();
          if (!body || body.status === 'ok') {
            if (attempt > 1) {
              const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`Directus responded after ${attempt} attempts (${elapsedSeconds}s).`);
            }
            return;
          }
          lastError = new Error(`Health endpoint reported status: ${JSON.stringify(body)}`);
        } catch (error) {
          if (attempt > 1) {
            const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`Directus responded after ${attempt} attempts (${elapsedSeconds}s).`);
          }
          return;
        }
      } else {
        lastError = new Error(`Unexpected status ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    const delay = Math.min(directusWaitIntervalMs * Math.pow(1.5, attempt - 1), 10000);
    await sleep(Math.max(250, delay));
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const message = `Directus did not become reachable within ${directusWaitTimeoutMs}ms (${elapsedSeconds}s) after ${attempt} attempts.`;
  if (lastError) {
    throw new Error(message, { cause: lastError });
  }
  throw new Error(message);
}

async function authenticate() {
  logStep('Authenticating with Directus');
  const url = `${directusUrl}/auth/login`;
  const payload = {
    email: adminEmail,
    password: adminPassword,
  };
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(`Cannot reach Directus auth endpoint at ${url}: ${error.message || error}`, { cause: error });
  }
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
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${error.message || error}`, { cause: error });
  }
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
      await waitForDirectusAvailability();
      token = await authenticate();
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
    console.error(`\nSeeding failed during step: ${currentStep}`);
    logErrorDetails(error);
    if (directusUrl) {
      console.error('Directus URL:', directusUrl);
    }
    console.error('Flags:', {
      dryRun,
      skipImages,
      truncateCollections,
    });
    process.exitCode = 1;
  }
}

main();
