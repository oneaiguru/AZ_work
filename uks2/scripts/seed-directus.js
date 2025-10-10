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

function isDnsErrorCode(code) {
  return ['EAI_AGAIN', 'ENOTFOUND', 'EAI_FAIL', 'EAI_NODATA', 'EAI_NONAME'].includes(code);
}

function isNetworkErrorCode(code) {
  return [
    'ENETUNREACH',
    'EHOSTUNREACH',
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'ENETDOWN',
    'EHOSTDOWN',
    'EPIPE',
    'EPROTO',
    'UND_ERR_CONNECT_TIMEOUT',
  ].includes(code);
}

async function pollDirectusHealth(baseUrl) {
  const healthUrl = `${baseUrl}/server/health`;
  console.log(`Polling ${healthUrl} for up to ${directusWaitTimeoutMs}ms (minimum interval ${directusWaitIntervalMs}ms).`);
  const startTime = Date.now();
  const deadline = startTime + directusWaitTimeoutMs;
  let attempt = 0;
  let lastError = null;

  while (Date.now() <= deadline) {
    attempt += 1;
    let attemptError = null;
    const timeoutMs = Math.max(1000, directusWaitIntervalMs);
    try {
      const fetchOptions = {
        method: 'GET',
        headers: { Accept: 'application/json' },
      };
      let controller;
      let timeoutId;
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
          attemptError = new Error(`Health endpoint reported status: ${JSON.stringify(body)}`);
        } catch (error) {
          if (attempt > 1) {
            const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`Directus responded after ${attempt} attempts (${elapsedSeconds}s).`);
          }
          return;
        }
      } else {
        attemptError = new Error(`Unexpected status ${response.status}`);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        attemptError = new Error(`Health check request timed out after ${timeoutMs}ms`, { cause: error });
      } else {
        attemptError = new Error(`Health check request failed: ${error.message || error}`, { cause: error });
      }
    }

    if (attemptError) {
      lastError = attemptError;
      const remaining = deadline - Date.now();
      const baseMessage = attemptError.message || String(attemptError);
      const code = findErrorProperty(attemptError, 'code');
      const hostname = findErrorProperty(attemptError, 'hostname');
      const address = findErrorProperty(attemptError, 'address');
      const port = findErrorProperty(attemptError, 'port');
      const details = [baseMessage];
      if (code && !baseMessage.includes(code)) {
        attemptError.code = code;
        details.push(`code=${code}`);
      }
      if (hostname && !baseMessage.includes(hostname)) {
        attemptError.hostname = hostname;
        details.push(`hostname=${hostname}`);
      }
      if (address && !baseMessage.includes(address)) {
        attemptError.address = address;
        details.push(`address=${address}`);
      }
      if (port && !baseMessage.includes(String(port))) {
        attemptError.port = port;
        details.push(`port=${port}`);
      }
      const reason = details.filter(Boolean).join(' ');
      if (code && isDnsErrorCode(code)) {
        console.log(`Directus URL ${baseUrl} is not reachable due to DNS resolution error: ${reason}.`);
        attemptError.url = baseUrl;
        attemptError.isDnsError = true;
        throw attemptError;
      }
      if (code && isNetworkErrorCode(code)) {
        console.log(`Directus URL ${baseUrl} is not reachable due to network error: ${reason}.`);
        attemptError.url = baseUrl;
        attemptError.isNetworkError = true;
        throw attemptError;
      }
      if (remaining <= 0) {
        console.log(`Directus not ready (attempt ${attempt}): ${reason}. No time left to retry.`);
        break;
      }
      const delay = Math.min(directusWaitIntervalMs * Math.pow(1.5, attempt - 1), 10000);
      const waitMs = Math.max(250, delay);
      const waitSeconds = (waitMs / 1000).toFixed(1);
      const remainingSeconds = (remaining / 1000).toFixed(1);
      console.log(`Directus not ready (attempt ${attempt}): ${reason}. Retrying in ${waitSeconds}s (time left ${remainingSeconds}s).`);
      await sleep(waitMs);
      continue;
    }

    break;
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const message = `Directus did not become reachable within ${directusWaitTimeoutMs}ms (${elapsedSeconds}s) after ${attempt} attempts.`;
  const error = lastError ? new Error(message, { cause: lastError }) : new Error(message);
  error.url = baseUrl;
  throw error;
}

async function waitForDirectusAvailability() {
  if (!directusUrlCandidates.length) {
    return;
  }
  logStep('Waiting for Directus to become reachable');
  const errors = [];
  for (let index = 0; index < directusUrlCandidates.length; index += 1) {
    const candidate = directusUrlCandidates[index];
    const ordinal = `${index + 1}/${directusUrlCandidates.length}`;
    console.log(`\nChecking Directus URL candidate ${ordinal}: ${candidate}`);
    try {
      directusUrl = candidate;
      await pollDirectusHealth(candidate);
      console.log(`Directus is ready at ${directusUrl}.`);
      return;
    } catch (error) {
      errors.push({ url: candidate, error });
      const code = findErrorProperty(error, 'code');
      if (index < directusUrlCandidates.length - 1) {
        if (code && isDnsErrorCode(code)) {
          console.log(`Falling back to the next candidate because DNS lookup failed for ${candidate}.`);
          continue;
        }
        if (code && isNetworkErrorCode(code)) {
          console.log(`Falling back to the next candidate because a network error (${code}) occurred for ${candidate}.`);
          continue;
        }
        const message = error?.message || String(error);
        console.log(`Attempt to reach Directus at ${candidate} failed (${message}). Trying the next candidate...`);
        continue;
      }
    }
  }

  const tried = directusUrlCandidates.join(', ');
  const message = `Directus did not become reachable via any configured URL. Tried: ${tried}`;
  if (errors.length === 1) {
    throw new Error(message, { cause: errors[0].error });
  }
  const aggregate = new AggregateError(
    errors.map((entry) => {
      if (entry && entry.error) {
        entry.error.url = entry.url;
      }
      return entry.error || entry;
    }),
    message,
  );
  throw aggregate;
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
      await waitForDirectusAvailability();
      if (accessTokenOverride) {
        logStep('Using Directus access token from CLI');
        token = accessTokenOverride;
      } else if (adminStaticToken) {
        logStep('Using Directus static token from environment');
        token = adminStaticToken;
      } else {
        token = await authenticate();
      }
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
