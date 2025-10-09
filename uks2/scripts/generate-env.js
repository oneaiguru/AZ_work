#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const rotateDbPassword = args.has('--rotate-db-password');

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

const previousEnv = new Map();
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      return;
    }
    const [rawKey, ...rest] = line.split('=');
    const key = rawKey.trim();
    const value = rest.join('=');
    previousEnv.set(key, value);
  });
}

const randomAlphaNumeric = (length) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
};

const randomUrlSafe = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const secrets = new Map(
  Object.entries({
    DIRECTUS_KEY: () => randomUrlSafe(48),
    DIRECTUS_SECRET: () => randomUrlSafe(48),
    DATABASE_PASSWORD: () => randomAlphaNumeric(24),
    MINIO_ROOT_USER: () => randomAlphaNumeric(20),
    MINIO_ROOT_PASSWORD: () => randomAlphaNumeric(40),
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
  if (key === 'DATABASE_PASSWORD' && previousEnv.has(key) && !rotateDbPassword) {
    return `${key}=${previousEnv.get(key)}`;
  }
  return `${key}=${generator()}`;
});

const output = generatedLines.join('\n');
fs.writeFileSync(envPath, output.endsWith('\n') ? output : `${output}\n`, { mode: 0o600 });

const currentEnv = new Map();
generatedLines.forEach((line) => {
  if (!line || line.trim().startsWith('#') || !line.includes('=')) {
    return;
  }
  const [rawKey, ...rawValue] = line.split('=');
  const key = rawKey.trim();
  const value = rawValue.join('=');
  currentEnv.set(key, value);
});

const updateDatabasePasswordIfNeeded = () => {
  if (!previousEnv.has('DATABASE_PASSWORD')) {
    return;
  }

  const previousPassword = previousEnv.get('DATABASE_PASSWORD');
  const nextPassword = currentEnv.get('DATABASE_PASSWORD');

  if (!nextPassword || nextPassword === previousPassword) {
    return;
  }

  const dbUser = currentEnv.get('DATABASE_USERNAME') || 'postgres';
  const dbName = currentEnv.get('DATABASE_NAME') || dbUser;

  const sql = `ALTER USER "${dbUser.replace(/"/g, '""')}" WITH PASSWORD '${nextPassword.replace(/'/g, "''")}';`;

  const composeArgs = ['exec', '-T', 'postgres', 'psql', '-U', dbUser, '-d', dbName, '-c', sql];
  const env = { ...process.env, PGPASSWORD: previousPassword };

  const attempts = [
    ['docker', ['compose', ...composeArgs]],
    ['docker-compose', composeArgs],
  ];

  let updated = false;
  let lastError;

  for (const [command, args] of attempts) {
    const result = spawnSync(command, args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
    });

    if (result.error) {
      lastError = result.error;
      continue;
    }

    if (result.status === 0) {
      updated = true;
      break;
    }

    lastError = new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }

  if (updated) {
    console.log('Updated PostgreSQL user password to match the regenerated .env file.');
    return;
  }

  console.warn('Unable to update PostgreSQL password automatically. If the container is running, update it manually:');
  console.warn(`  docker compose exec postgres psql -U ${dbUser} -d ${dbName} -c "${sql}"`);
  if (lastError) {
    console.warn(String(lastError));
  }
};

updateDatabasePasswordIfNeeded();

console.log('Generated uks2/.env with random credentials.');
if (previousEnv.has('DATABASE_PASSWORD') && !rotateDbPassword) {
  console.log('Kept existing DATABASE_PASSWORD. Run with --rotate-db-password to generate a new one — the script will try to update PostgreSQL automatically.');
}
