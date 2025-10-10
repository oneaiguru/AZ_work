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
let waitTimeoutOverride;
let waitIntervalOverride;
let accessTokenOverride;
const directusUrlOverrides = [];

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
  if (arg.startsWith('--directus-url=')) {
    const value = normalizeUrl(arg.slice('--directus-url='.length));
    if (value) {
      directusUrlOverrides.push(value);
    }
    continue;
  }
  if (arg === '--directus-url' && args[index + 1]) {
    const value = normalizeUrl(args[index + 1]);
    if (value) {
      directusUrlOverrides.push(value);
    }
    index += 1;
    continue;
  }
  if (arg.startsWith('--token=')) {
    accessTokenOverride = arg.slice('--token='.length).trim();
    continue;
  }
  if (arg === '--token' && args[index + 1]) {
    accessTokenOverride = args[index + 1].trim();
    index += 1;
    continue;
  }
  if (arg.startsWith('--token-file=')) {
    const tokenPath = path.resolve(process.cwd(), arg.slice('--token-file='.length));
    if (fs.existsSync(tokenPath)) {
      accessTokenOverride = fs.readFileSync(tokenPath, 'utf8').trim();
    } else {
      console.warn('Cannot read token file:', tokenPath);
    }
    continue;
  }
  if (arg === '--token-file' && args[index + 1]) {
    const tokenPath = path.resolve(process.cwd(), args[index + 1]);
    if (fs.existsSync(tokenPath)) {
      accessTokenOverride = fs.readFileSync(tokenPath, 'utf8').trim();
    } else {
      console.warn('Cannot read token file:', tokenPath);
    }
    index += 1;
    continue;
  }
  if (arg.startsWith('--wait-timeout-ms=')) {
    const value = parseIntegerOption(arg.slice('--wait-timeout-ms='.length));
    if (value !== null) {
      waitTimeoutOverride = value;
    }
    continue;
  }
  if (arg === '--wait-timeout-ms' && args[index + 1]) {
    const value = parseIntegerOption(args[index + 1]);
    if (value !== null) {
      waitTimeoutOverride = value;
    }
    index += 1;
    continue;
  }
  if (arg.startsWith('--wait-timeout=')) {
    const value = parseIntegerOption(arg.slice('--wait-timeout='.length), 1000);
    if (value !== null) {
      waitTimeoutOverride = value;
    }
    continue;
  }
  if (arg === '--wait-timeout' && args[index + 1]) {
    const value = parseIntegerOption(args[index + 1], 1000);
    if (value !== null) {
      waitTimeoutOverride = value;
    }
    index += 1;
    continue;
  }
  if (arg.startsWith('--wait-interval-ms=')) {
    const value = parseIntegerOption(arg.slice('--wait-interval-ms='.length));
    if (value !== null) {
      waitIntervalOverride = value;
    }
    continue;
  }
  if (arg === '--wait-interval-ms' && args[index + 1]) {
    const value = parseIntegerOption(args[index + 1]);
    if (value !== null) {
      waitIntervalOverride = value;
    }
    index += 1;
    continue;
  }
  if (arg.startsWith('--wait-interval=')) {
    const value = parseIntegerOption(arg.slice('--wait-interval='.length), 1000);
    if (value !== null) {
      waitIntervalOverride = value;
    }
    continue;
  }
  if (arg === '--wait-interval' && args[index + 1]) {
    const value = parseIntegerOption(args[index + 1], 1000);
    if (value !== null) {
      waitIntervalOverride = value;
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

function parseIntegerOption(value, multiplier = 1) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed * multiplier;
}

function normalizeUrl(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function findErrorProperty(error, property, seen = new Set()) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if (seen.has(error)) {
    return undefined;
  }
  seen.add(error);
  if (error[property] !== undefined && error[property] !== null) {
    return error[property];
  }
  if (error.cause) {
    return findErrorProperty(error.cause, property, seen);
  }
  return undefined;
}

const directusUrlCandidates = [
  ...directusUrlOverrides,
  process.env.DIRECTUS_SEED_URL,
  process.env.DIRECTUS_PUBLIC_URL,
  process.env.NEXT_PUBLIC_CMS_URL,
  process.env.CMS_INTERNAL_URL,
  process.env.DIRECTUS_INTERNAL_URL,
  'http://localhost/cms',
  'http://localhost:8055',
]
  .map(normalizeUrl)
  .filter(Boolean)
  .filter((url, index, self) => self.indexOf(url) === index);

let directusUrl = directusUrlCandidates[0] || 'http://localhost:8055';
const directusWaitTimeoutMs = parsePositiveInteger(waitTimeoutOverride ?? process.env.DIRECTUS_WAIT_TIMEOUT_MS, 300000);
const directusWaitIntervalMs = parsePositiveInteger(waitIntervalOverride ?? process.env.DIRECTUS_WAIT_INTERVAL_MS, 2000);
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
const adminStaticToken = (process.env.DIRECTUS_ADMIN_STATIC_TOKEN || '').trim();

if (!accessTokenOverride && !adminStaticToken && (!adminEmail || !adminPassword)) {
  if (dryRun) {
    console.warn('DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD не заданы — используем фиктивные значения для dry-run.');
    process.env.DIRECTUS_ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'dry-run@example.com';
    process.env.DIRECTUS_ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'dry-run';
  } else {
    console.error('DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD must be set via environment variables or uks2/.env, or provide a static token with --token / DIRECTUS_ADMIN_STATIC_TOKEN.');
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
  const {
    headers: extraHeaders,
    directusTokenTransport = 'header',
    ...rest
  } = options;

  const headers = Object.assign({ Accept: 'application/json' }, extraHeaders || {});

  if (rest.body && !(rest.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config = Object.assign({}, rest, { headers });

  if (token && token !== 'dry-run') {
    if (directusTokenTransport === 'query') {
      config.directusAccessToken = token;
    } else if (directusTokenTransport === 'both') {
      config.directusAccessToken = token;
      if (!headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    } else if (directusTokenTransport !== 'none' && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  config.directusTokenTransport = directusTokenTransport;
  return config;
}

function appendAccessToken(url, token) {
  if (!token) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('access_token')) {
      parsed.searchParams.append('access_token', token);
    }
    return parsed.toString();
  } catch (error) {
    const [base, hash] = url.split('#');
    const separator = base.includes('?') ? '&' : '?';
    const rebuilt = `${base}${separator}access_token=${encodeURIComponent(token)}`;
    return hash ? `${rebuilt}#${hash}` : rebuilt;
  }
}

function maskAccessToken(url) {
  if (!url) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('access_token')) {
      parsed.searchParams.set('access_token', '***');
    }
    return parsed.toString();
  } catch (error) {
    return url.replace(/access_token=[^&#]*/g, 'access_token=***');
  }
}

async function requestJson(url, options = {}) {
  const { directusAccessToken, directusTokenTransport, ...fetchOptions } = options;
  const headers = fetchOptions.headers || {};
  const hasAuthHeader = Boolean(headers.Authorization || headers.authorization);
  const shouldAppendToken = Boolean(
    directusAccessToken &&
      ((directusTokenTransport === 'query' && !hasAuthHeader) || directusTokenTransport === 'both')
  );
  const requestUrl = shouldAppendToken ? appendAccessToken(url, directusAccessToken) : url;
  const safeUrl = shouldAppendToken ? maskAccessToken(requestUrl) : requestUrl;
  let response;
  try {
    response = await fetch(requestUrl, fetchOptions);
  } catch (error) {
    const method = fetchOptions.method || 'GET';
    throw new Error(`Request to ${safeUrl} (${method}) failed: ${error.message || error}`, { cause: error });
  }
  if (!response.ok) {
    let details = '';
    try {
      const parsed = await response.json();
      details = JSON.stringify(parsed, null, 2);
    } catch (error) {
      details = await response.text();
    }
    throw new Error(`Request to ${safeUrl} failed with status ${response.status}: ${details}`);
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
    const metadata = {};
    if (image.title) {
      metadata.title = image.title;
    } else if (image.url) {
      metadata.title = image.url;
    }
    if (image.description) {
      metadata.description = image.description;
    }
    const body = { url: image.url };
    if (Object.keys(metadata).length > 0) {
      body.data = metadata;
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
