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
  if (arg === '--debug') {
    flags.add('debug');
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
const debug = flags.has('debug');

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

function normalizeBaseUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
}

const directusCandidates = [
  process.env.DIRECTUS_INTERNAL_URL,
  process.env.CMS_INTERNAL_URL,
  process.env.DIRECTUS_PUBLIC_URL,
  'http://directus:8055',
  'http://localhost:8055',
]
  .map(normalizeBaseUrl)
  .filter(Boolean);

if (!directusCandidates.length) {
  directusCandidates.push('http://localhost:8055');
}

const DEFAULT_DIRECTUS_PUBLIC_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const directusUrl = directusCandidates[0];
const directusAccessTokenRaw = process.env.DIRECTUS_ACCESS_TOKEN || process.env.DIRECTUS_ADMIN_STATIC_TOKEN || '';
const directusAccessToken = typeof directusAccessTokenRaw === 'string' ? directusAccessTokenRaw.trim() : '';
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
const adminStaticToken = (process.env.DIRECTUS_ADMIN_STATIC_TOKEN || '').trim();

if (!directusAccessToken && (!adminEmail || !adminPassword)) {
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

function logDebug(...args) {
  if (debug) {
    console.log('[debug]', ...args);
  }
}

logDebug('Using Directus URL', directusUrl);
if (directusCandidates.length > 1) {
  logDebug('Directus URL fallbacks', directusCandidates.slice(1));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  if (options && options.signal) {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDirectus() {
  if (dryRun) {
    return;
  }
  const attempts = Number.parseInt(process.env.SEED_DIRECTUS_MAX_ATTEMPTS || '12', 10);
  const delay = Number.parseInt(process.env.SEED_DIRECTUS_RETRY_DELAY || '5000', 10);
  const endpoints = [`${directusUrl}/server/health`, `${directusUrl}/server/ping`];
  logStep('Waiting for Directus API to become available');
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const url of endpoints) {
      try {
        const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 8000);
        logDebug('Health check', url, '->', response.status);
        if (response.ok) {
          if (response.headers.get('content-type')?.includes('application/json')) {
            const payload = await response.json();
            const status = payload?.status || payload?.data?.status;
            logDebug('Health payload', payload);
            if (typeof status === 'string' && status.toLowerCase() !== 'ok') {
              break;
            }
          }
          return;
        }
      } catch (error) {
        logDebug('Health check failed for', url, error.message);
      }
    }
    if (attempt < attempts) {
      logDebug(`Directus not ready yet (attempt ${attempt}/${attempts}) — waiting ${delay}ms before retry`);
      await sleep(delay);
    }
  }
  throw new Error('Directus API недоступен. Проверьте, что контейнер directus запущен и порт 8055 открыт.');
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
  const method = options.method || 'GET';
  logDebug(`${method} ${url}`);
  const response = await fetchWithTimeout(url, options, 15000);
  logDebug(`${method} ${url} -> ${response.status}`);
  if (!response.ok) {
    let details = '';
    try {
      const parsed = await response.json();
      details = JSON.stringify(parsed, null, 2);
    } catch (error) {
      details = await response.text();
    }
    const error = new Error(`Request to ${url} failed with status ${response.status}: ${details}`);
    error.status = response.status;
    throw error;
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {};
  }
  return response.json();
}

function createUploadFile(arrayBuffer, filename, type) {
  if (typeof File === 'function') {
    return new File([arrayBuffer], filename, { type });
  }
  return new Blob([arrayBuffer], { type });
}

function shouldAttemptManualUpload(error) {
  if (!error) {
    return false;
  }
  const status = error.status;
  if (status === 503 || status === 502 || status === 500 || status === 403) {
    return true;
  }
  const message = String(error.message || '').toLowerCase();
  return message.includes('external-file') || message.includes("couldn't fetch file");
}

async function downloadRemoteAsset(url) {
  const headers = {
    'User-Agent': 'uks2-seeder/1.0 (+https://uks.delightsoft.ru)',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    Referer: 'https://uks.irkutsk.ru/',
  };
  const response = await fetchWithTimeout(url, { headers }, 15000);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  let filename = null;
  try {
    const parsed = new URL(url);
    filename = parsed.pathname ? parsed.pathname.split('/').filter(Boolean).pop() : null;
  } catch (error) {
    filename = null;
  }
  if (!filename) {
    filename = `image-${Date.now()}.jpg`;
  }
  return { arrayBuffer, contentType, filename };
}

async function uploadAssetToDirectus(token, image, asset) {
  if (dryRun) {
    console.log(`[dry-run] Would upload downloaded file ${image.url}`);
    return null;
  }
  const form = new FormData();
  if (image.title) {
    form.set('title', image.title);
  } else {
    form.set('title', asset.filename);
  }
  if (image.description) {
    form.set('description', image.description);
  }
  const filePart = createUploadFile(asset.arrayBuffer, asset.filename, asset.contentType);
  form.set('file', filePart, asset.filename);
  const response = await requestJson(`${directusUrl}/files`, withAuth(token, { method: 'POST', body: form }));
  return response?.data?.id ?? null;
}

async function findPublicPolicyContext(token) {
  const params = new URLSearchParams();
  params.set('filter[icon][_eq]', 'public');
  params.set('limit', '-1');
  params.set('fields', 'id,name,access.id,access.role');
  const response = await requestJson(`${directusUrl}/policies?${params.toString()}`, withAuth(token));
  const policies = Array.isArray(response?.data) ? response.data : [];
  const normalized = policies.map((policy) => ({
    id: policy?.id,
    name: policy?.name,
    roleId: Array.isArray(policy?.access)
      ? policy.access.map((entry) => entry?.role).find((value) => typeof value === 'string' && value)
      : undefined,
  }));
  logDebug('Available policies', normalized);
  const match =
    normalized.find((policy) => typeof policy?.name === 'string' && policy.name.toLowerCase().includes('public')) || normalized[0];
  if (match?.id) {
    return match;
  }
  throw new Error('Не удалось определить политику Directus для публичного доступа.');
}

async function attachPolicyToRole(token, roleId, policyId) {
  logDebug('Attaching policy', policyId, 'to role', roleId);
  try {
    await requestJson(`${directusUrl}/access`, withAuth(token, {
      method: 'POST',
      body: JSON.stringify({ role: roleId, policy: policyId, sort: 1 }),
    }));
  } catch (error) {
    if (error?.status === 400 && /INVALID_FOREIGN_KEY/.test(String(error.message || ''))) {
      throw new Error(
        `Не удалось прикрепить публичную политику к роли ${roleId}. Проверьте, что эта роль существует в Directus ` +
          'и повторите запуск сидера (при необходимости укажите DIRECTUS_PUBLIC_ROLE_ID).',
      );
    }
    throw error;
  }
}

async function fetchRoleById(token, roleId) {
  if (!roleId) {
    return null;
  }
  try {
    const response = await requestJson(`${directusUrl}/roles/${roleId}`, withAuth(token));
    const role = response?.data;
    if (role?.id) {
      logDebug('Resolved role via direct lookup', { id: role.id, name: role.name });
      return Object.assign({ exists: true }, role);
    }
  } catch (error) {
    if (error?.status === 404) {
      logDebug('Direct lookup did not find role', roleId);
      return { id: roleId, exists: false };
    }
    if (error?.status === 403) {
      logDebug('Direct lookup forbidden for role', roleId, '- continuing');
      return { id: roleId, exists: null };
    }
    throw error;
  }
  return { id: roleId, exists: false };
}

function findLikelyPublicRole(roles) {
  const normalized = roles
    .filter((role) => role && typeof role.id === 'string')
    .map((role) => ({
      id: role.id,
      name: role?.name,
      icon: role?.icon,
      admin: role?.admin_access,
      app: role?.app_access,
    }));
  if (!normalized.length) {
    return null;
  }
  const byIcon = normalized.find((role) => role.icon === 'public');
  if (byIcon) {
    return byIcon;
  }
  const byName = normalized.find((role) => {
    const name = typeof role.name === 'string' ? role.name.toLowerCase() : '';
    return name.includes('public') || name.includes('публ');
  });
  if (byName) {
    return byName;
  }
  const nonAdmin = normalized.filter((role) => role.admin === false);
  if (nonAdmin.length === 1) {
    return nonAdmin[0];
  }
  const nonAdminWithoutApp = nonAdmin.filter((role) => role.app === false);
  if (nonAdminWithoutApp.length) {
    return nonAdminWithoutApp[0];
  }
  return normalized[0];
}

async function listAllRoles(token) {
  const params = new URLSearchParams();
  params.set('fields', 'id,name,icon,admin_access,app_access');
  params.set('limit', '-1');
  const url = `${directusUrl}/roles?${params.toString()}`;
  const response = await requestJson(url, withAuth(token));
  const roles = Array.isArray(response?.data) ? response.data : [];
  logDebug(
    'Available roles overview',
    roles.map((role) => ({
      id: role?.id,
      name: role?.name,
      icon: role?.icon,
      admin_access: role?.admin_access,
      app_access: role?.app_access,
    })),
  );
  return roles;
}

async function createPublicRole(token) {
  if (dryRun) {
    console.log('[dry-run] Would create Directus public role');
    return { id: 'dry-run-public-role' };
  }
  logDebug('Creating new Directus public role');
  const created = await requestJson(`${directusUrl}/roles`, withAuth(token, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Public',
      icon: 'public',
      description: 'Автоматически созданная роль для публичного доступа.',
      admin_access: false,
      app_access: false,
    }),
  }));
  const role = created?.data;
  if (!role?.id) {
    throw new Error('Directus не вернул идентификатор новой публичной роли.');
  }
  logDebug('Created public role', { id: role.id, name: role.name });
  return role;
}

async function ensureProjectPublicRole(token, roleId) {
  if (dryRun) {
    console.log(`[dry-run] Would set project public_role to ${roleId}`);
    return;
  }
  let currentRoleId;
  try {
    const settings = await requestJson(`${directusUrl}/settings`, withAuth(token));
    currentRoleId = settings?.data?.project?.public_role;
    logDebug('Current project public_role', currentRoleId);
  } catch (error) {
    if (error?.status === 403) {
      logDebug('Access to /settings denied while reading current public_role — continuing');
    } else if (error?.status !== 404) {
      throw error;
    }
  }
  if (currentRoleId === roleId) {
    return;
  }
  try {
    await requestJson(`${directusUrl}/settings`, withAuth(token, {
      method: 'PATCH',
      body: JSON.stringify({ project: { public_role: roleId } }),
    }));
    logDebug('Updated project public_role setting', roleId);
  } catch (error) {
    if (error?.status === 403) {
      console.warn('Не удалось обновить настройки Directus: доступ запрещен. Продолжаем без изменения public_role.');
    } else if (error?.status === 400) {
      console.warn('Directus отклонил попытку обновить public_role (400). Продолжаем без изменения настройки.');
    } else {
      throw error;
    }
  }
}

async function getPublicRoleContext(token) {
  const policy = await findPublicPolicyContext(token);
  const policyId = policy.id;
  let roleId = policy.roleId;
  if (!roleId && process.env.DIRECTUS_PUBLIC_ROLE_ID) {
    roleId = process.env.DIRECTUS_PUBLIC_ROLE_ID;
    logDebug('Using DIRECTUS_PUBLIC_ROLE_ID from environment');
  }
  const triedEndpoints = [];
  if (roleId) {
    const role = await fetchRoleById(token, roleId);
    if (!role?.exists) {
      roleId = undefined;
    } else {
      roleId = role.id;
    }
  }
  if (!roleId) {
    const url = `${directusUrl}/server/info`;
    triedEndpoints.push(url);
    try {
      const info = await requestJson(url, withAuth(token));
      const projectRoleId = info?.data?.project?.public_role;
      if (typeof projectRoleId === 'string' && projectRoleId) {
        const role = await fetchRoleById(token, projectRoleId);
        if (role?.exists) {
          roleId = role.id;
          logDebug('Found public role via /server/info', { roleId });
        }
      }
    } catch (error) {
      if (error?.status === 403) {
        logDebug('Access to /server/info denied, continuing with other strategies');
      } else if (error?.status !== 404) {
        throw error;
      }
    }
  }
  if (!roleId) {
    const params = new URLSearchParams();
    params.set('fields', 'id,name');
    params.set('filter[name][_icontains]', 'public');
    params.set('limit', '1');
    const url = `${directusUrl}/roles?${params.toString()}`;
    triedEndpoints.push(url);
    try {
      const response = await requestJson(url, withAuth(token));
      const match = Array.isArray(response?.data) ? response.data[0] : null;
      if (match?.id) {
        const role = await fetchRoleById(token, match.id);
        if (role?.exists) {
          roleId = role.id;
          logDebug('Found public role via /roles search', { id: roleId, name: match.name });
        }
      }
    } catch (error) {
      if (error?.status === 403) {
        logDebug('Access to /roles denied, relying on other strategies');
      } else {
        throw error;
      }
    }
  }
  if (!roleId) {
    const params = new URLSearchParams();
    params.set('fields', 'id,name');
    params.set('filter[icon][_eq]', 'public');
    params.set('limit', '1');
    const url = `${directusUrl}/roles?${params.toString()}`;
    triedEndpoints.push(url);
    try {
      const response = await requestJson(url, withAuth(token));
      const match = Array.isArray(response?.data) ? response.data[0] : null;
      if (match?.id) {
        const role = await fetchRoleById(token, match.id);
        if (role?.exists) {
          roleId = role.id;
          logDebug('Found public role via icon filter', { id: roleId, name: match.name });
        }
      }
    } catch (error) {
      if (error?.status === 403) {
        logDebug('Access to /roles with icon filter denied, continuing');
      } else {
        throw error;
      }
    }
  }
  if (!roleId) {
    const accessParams = new URLSearchParams();
    accessParams.set('filter[policy][_eq]', policyId);
    accessParams.set('limit', '1');
    accessParams.set('fields', 'id,role');
    const accessUrl = `${directusUrl}/access?${accessParams.toString()}`;
    triedEndpoints.push(accessUrl);
    try {
      const accessResponse = await requestJson(accessUrl, withAuth(token));
      const attachment = Array.isArray(accessResponse?.data) ? accessResponse.data[0] : null;
      if (attachment?.role) {
        const role = await fetchRoleById(token, attachment.role);
        if (role?.exists) {
          roleId = role.id;
          logDebug('Derived public role from existing access attachment', { roleId });
        }
      }
    } catch (error) {
      if (error?.status !== 403) {
        throw error;
      }
      logDebug('Unable to inspect access attachments due to permissions');
    }
  }
  if (!roleId) {
    try {
      const roles = await listAllRoles(token);
      const match = findLikelyPublicRole(roles);
      if (match?.id) {
        roleId = match.id;
        logDebug('Selected likely public role from full list', { id: roleId, name: match.name });
      }
    } catch (error) {
      if (error?.status === 403) {
        logDebug('Unable to fetch full role list due to permissions');
      } else {
        throw error;
      }
    }
  }
  if (!roleId && DEFAULT_DIRECTUS_PUBLIC_ROLE_ID) {
    const candidate = await fetchRoleById(token, DEFAULT_DIRECTUS_PUBLIC_ROLE_ID);
    if (candidate?.exists) {
      roleId = candidate.id;
      logDebug('Using default Directus public role id', roleId);
    } else {
      triedEndpoints.push(`default:${DEFAULT_DIRECTUS_PUBLIC_ROLE_ID}`);
      logDebug('Default Directus public role id not found in instance');
    }
  }
  if (!roleId) {
    const created = await createPublicRole(token);
    roleId = created.id;
  }
  if (!roleId) {
    throw new Error(
      `Не удалось определить публичную роль Directus. Укажите идентификатор роли через DIRECTUS_PUBLIC_ROLE_ID и повторите запуск. Проверенные эндпоинты: ${
        triedEndpoints.length ? triedEndpoints.join(', ') : 'нет'
      }`,
    );
  }
  await ensureProjectPublicRole(token, roleId);
  if (!policy.roleId || policy.roleId !== roleId) {
    try {
      await attachPolicyToRole(token, roleId, policyId);
    } catch (error) {
      if (error?.status === 409) {
        logDebug('Policy already attached to role, ignoring conflict');
      } else {
        throw error;
      }
    }
  }
  logDebug('Public role context', { roleId, policyId });
  return { roleId, policyId };
}

async function upsertPermission(token, policyId, collection, action, payload) {
  const params = new URLSearchParams();
  params.set('filter[policy][_eq]', policyId);
  params.set('filter[collection][_eq]', collection);
  params.set('filter[action][_eq]', action);
  const url = `${directusUrl}/permissions?${params.toString()}`;
  const existingResponse = await requestJson(url, withAuth(token));
  const existing = Array.isArray(existingResponse?.data) ? existingResponse.data[0] : undefined;
  if (existing?.id) {
    logDebug('Updating existing permission', existing.id, 'for', collection, action);
    await requestJson(`${directusUrl}/permissions/${existing.id}`, withAuth(token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }));
    return { id: existing.id, created: false };
  }
  logDebug('Creating permission for', collection, action);
  const created = await requestJson(`${directusUrl}/permissions`, withAuth(token, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ policy: policyId, collection, action }, payload)),
  }));
  return { id: created?.data?.id, created: true };
}

async function ensurePublicApiAccess(token) {
  logStep('Ensuring public API permissions');
  const { policyId } = await getPublicRoleContext(token);
  const collections = ['homepage', 'projects', 'procurements', 'documents', 'news_articles', 'contacts'];
  const payload = {
    fields: ['*'],
    permissions: null,
    validation: null,
    presets: null,
  };
  for (const collection of collections) {
    const result = await upsertPermission(token, policyId, collection, 'read', payload);
    logDebug('Permission configured', { collection, action: 'read', id: result?.id, created: result?.created });
  }
}

async function authenticate() {
  const url = `${directusUrl}/auth/login`;
  const payload = {
    email: adminEmail,
    password: adminPassword,
  };
  logDebug('POST', url, '(auth)');
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      },
      15000,
    );
  } catch (error) {
    const authError = new Error(`Не удалось подключиться к ${url}: ${error.message}`);
    authError.cause = error;
    throw authError;
  }
  logDebug('POST', url, '(auth) ->', response.status);
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

async function authenticateWithRetry() {
  let attempts = Number.parseInt(process.env.SEED_DIRECTUS_AUTH_ATTEMPTS || '5', 10);
  if (!Number.isFinite(attempts) || attempts <= 0) {
    attempts = 1;
  }
  let delay = Number.parseInt(process.env.SEED_DIRECTUS_AUTH_RETRY_DELAY || '4000', 10);
  if (!Number.isFinite(delay) || delay < 0) {
    delay = 0;
  }
  logStep('Authenticating with Directus');
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await authenticate();
    } catch (error) {
      lastError = error;
      const prefix = attempts > 1 ? ` (attempt ${attempt}/${attempts})` : '';
      console.warn(`Authentication failed${prefix}: ${error.message}`);
      if (debug && error?.stack) {
        console.warn(error.stack);
      }
      if (attempt < attempts) {
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

async function ensureAdminContext(token) {
  if (dryRun) {
    return;
  }
  try {
    const response = await requestJson(
      `${directusUrl}/users/me?fields=id,email,role.id,role.name,role.admin_access`,
      withAuth(token),
    );
    const user = response?.data;
    if (user?.id) {
      logDebug('Authenticated user context', {
        id: user.id,
        email: user.email,
        role: user?.role?.name,
        admin_access: user?.role?.admin_access,
      });
      if (user?.role?.admin_access === false) {
        throw new Error(
          'Указанная учётная запись Directus не имеет admin_access. Укажите DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD ' +
            'для администратора или задайте DIRECTUS_ACCESS_TOKEN с правами super-admin.',
        );
      }
    }
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        'Directus запретил запрос /users/me. Проверьте, что используете учётку администратора или static token с admin_access.',
      );
    }
    throw error;
  }
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
      if (error?.status === 403) {
        throw new Error(
          `Directus отклонил попытку получить синглтон "${collection}". Проверьте, что используете админский логин/пароль или токен с правами администратора.`,
        );
      }
      throw error;
    }
    try {
      await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
        method: 'POST',
        body: JSON.stringify({}),
      }));
    } catch (creationError) {
      if (creationError?.status === 403) {
        throw new Error(
          `Directus запретил создание синглтона "${collection}". Запустите сидер с админскими правами или временно снимите ограничения.`,
        );
      }
      throw creationError;
    }
  }
}

async function updateSingleton(token, collection, payload) {
  if (dryRun) {
    console.log(`[dry-run] Would update singleton ${collection} with`, payload);
    return;
  }
  await ensureSingleton(token, collection);
  try {
    await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }));
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        `Directus запретил обновление синглтона "${collection}". Убедитесь, что скрипт запускается с правами администратора.`,
      );
    }
    throw error;
  }
}

async function listIds(token, collection) {
  try {
    const response = await requestJson(`${directusUrl}/items/${collection}?limit=-1&fields=id`, withAuth(token));
    return Array.isArray(response?.data)
      ? response.data.map((item) => item.id).filter((id) => id !== null && id !== undefined)
      : [];
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        `Directus запретил чтение коллекции "${collection}". Проверьте, что учётные данные администратора верны или используйте токен с правами super-admin.`,
      );
    }
    if (error?.status === 404) {
      throw new Error(
        `Коллекция "${collection}" отсутствует в текущей схеме Directus. Примените snapshot (npx directus schema apply) или импортируйте схему перед запуском сидера.`,
      );
    }
    throw error;
  }
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
    try {
      await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
        method: 'DELETE',
        body: JSON.stringify({ keys: chunk }),
      }));
    } catch (error) {
      if (error?.status === 403) {
        throw new Error(
          `Directus отказал в удалении записей коллекции "${collection}". Проверьте учётные данные администратора или токен доступа.`,
        );
      }
      throw error;
    }
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
  try {
    const response = await requestJson(`${directusUrl}/items/${collection}?${search.toString()}`, withAuth(token));
    const first = Array.isArray(response?.data) ? response.data[0] : null;
    return first?.id ?? null;
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        `Directus запретил поиск в коллекции "${collection}" (поле ${filterField}). Проверьте admin-доступ и права роли.`,
      );
    }
    if (error?.status === 404) {
      throw new Error(
        `Коллекция "${collection}" не найдена. Запустите миграции Directus или импортируйте snapshot перед посевом данных.`,
      );
    }
    throw error;
  }
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
    try {
      await requestJson(`${directusUrl}/items/${collection}/${existingId}`, withAuth(token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }));
    } catch (error) {
      if (error?.status === 403) {
        throw new Error(
          `Directus запретил обновление записи коллекции "${collection}" (ID ${existingId}). Убедитесь, что используете админский токен/учётку.`,
        );
      }
      throw error;
    }
    return existingId;
  }
  try {
    const response = await requestJson(`${directusUrl}/items/${collection}`, withAuth(token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    return response?.data?.id ?? null;
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        `Directus запретил создание записи в коллекции "${collection}". Проверьте права учетной записи администратора.`,
      );
    }
    if (error?.status === 404) {
      throw new Error(
        `Не удаётся создать запись коллекции "${collection}": коллекция отсутствует. Примените snapshot Directus перед запуском.`,
      );
    }
    throw error;
  }
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
  logDebug('Scraping images from', url);
  const headers = {
    'User-Agent': 'uks2-seeder/1.0 (+https://uks.delightsoft.ru)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  const response = await fetchWithTimeout(url, { headers }, 12000);
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
    if (error?.name === 'TimeoutError') {
      console.warn('Загрузка прервана по таймауту — при необходимости запустите сидер с флагом --skip-images.');
    }
    if (shouldAttemptManualUpload(error)) {
      try {
        logDebug('Falling back to manual upload for', image.url);
        const asset = await downloadRemoteAsset(image.url);
        const uploadedId = await uploadAssetToDirectus(token, image, asset);
        if (uploadedId) {
          console.log(`Импортировано изображение через обходное скачивание: ${image.url}`);
          return uploadedId;
        }
      } catch (fallbackError) {
        console.warn('Manual upload failed for', image.url, fallbackError.message);
        if (debug && fallbackError?.stack) {
          console.warn(fallbackError.stack);
        }
      }
    }
    if (debug && error?.stack) {
      console.warn(error.stack);
    }
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
    logDebug('Scraping source', source);
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
      if (error?.name === 'TimeoutError') {
        console.warn('Возможны сетевые ограничения — можно пропустить импорт изображений флагом --skip-images.');
      }
      if (debug && error?.stack) {
        console.warn(error.stack);
      }
    }
  }

  const manual = Array.isArray(seedData.manualImages) ? seedData.manualImages : [];
  for (const entry of manual) {
    if (collected.size >= maxImages) {
      break;
    }
    if (!collected.has(entry.url)) {
      logDebug('Adding manual image', entry.url);
      collected.set(entry.url, null);
    }
  }

  let index = 0;
  for (const url of Array.from(collected.keys())) {
    if (collected.get(url)) {
      continue;
    }
    logDebug('Importing image', url);
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
      await waitForDirectus();
      if (directusAccessToken) {
        logStep('Using Directus access token from environment');
        token = directusAccessToken;
      } else {
        token = await authenticateWithRetry();
      }
      await ensureAdminContext(token);
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
    if (debug && error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

main();
