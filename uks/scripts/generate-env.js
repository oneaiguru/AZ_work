#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');

const projectRoot = path.resolve(__dirname, '..');
const examplePath = path.join(projectRoot, '.env.example');
const envPath = path.join(projectRoot, '.env');

if (!fs.existsSync(examplePath)) {
  console.error('Cannot find .env.example at', examplePath);
  process.exit(1);
}

if (fs.existsSync(envPath) && !force) {
  console.error('Refusing to overwrite existing .env. Re-run with --force to replace it.');
  process.exit(1);
}

const randomAlphaNumeric = (length) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
};

const randomUrlSafe = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const secrets = new Map(
  Object.entries({
    APP_KEYS: () => Array.from({ length: 4 }, () => randomUrlSafe(32)).join(','),
    API_TOKEN_SALT: () => randomUrlSafe(32),
    ADMIN_JWT_SECRET: () => randomUrlSafe(32),
    TRANSFER_TOKEN_SALT: () => randomUrlSafe(32),
    ENCRYPTION_KEY: () => randomUrlSafe(32),
    DATABASE_PASSWORD: () => randomAlphaNumeric(24),
    MINIO_ACCESS_KEY: () => randomAlphaNumeric(20),
    MINIO_SECRET_KEY: () => randomAlphaNumeric(40),
  })
);

const exampleContent = fs.readFileSync(examplePath, 'utf8');
const generatedLines = exampleContent.split(/\r?\n/).map((line) => {
  if (!line || line.trim().startsWith('#') || !line.includes('=')) {
    return line;
  }
  const [rawKey] = line.split('=');
  const key = rawKey.trim();
  const generator = secrets.get(key);
  if (!generator) {
    return line;
  }
  return `${key}=${generator()}`;
});

const output = generatedLines.join('\n');
fs.writeFileSync(envPath, output.endsWith('\n') ? output : `${output}\n`, { mode: 0o600 });

console.log('Generated uks/.env with random credentials.');
