import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let activeChild = null;

function envValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function ensureAuthSecret() {
  const explicitSecret = envValue('AUTH_SECRET') || envValue('NEXTAUTH_SECRET');
  if (explicitSecret) {
    process.env.AUTH_SECRET = explicitSecret;
    process.env.NEXTAUTH_SECRET = explicitSecret;
    return;
  }

  const secretPath = process.env.AUTH_SECRET_FILE || join(process.env.UPLOAD_DIR || '/app/uploads', '.auth-secret');
  let generatedSecret = '';

  if (existsSync(secretPath)) {
    generatedSecret = readFileSync(secretPath, 'utf8').trim();
  }

  if (!generatedSecret) {
    generatedSecret = randomBytes(48).toString('base64url');
    mkdirSync(dirname(secretPath), { recursive: true });
    writeFileSync(secretPath, `${generatedSecret}\n`, { mode: 0o600 });
    console.log(`Generated auth secret at ${secretPath}. Keep this file backed up.`);
  }

  process.env.AUTH_SECRET = generatedSecret;
  process.env.NEXTAUTH_SECRET = generatedSecret;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    activeChild = spawn(command, args, { stdio: 'inherit' });
    activeChild.on('error', reject);
    activeChild.on('exit', (code, signal) => {
      activeChild = null;
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${signal || code}`));
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (activeChild) activeChild.kill(signal);
    else process.exit(0);
  });
}

ensureAuthSecret();

await import('./prepare-db.mjs');

if (process.env.RUN_MIGRATIONS === '0') {
  console.log('Skipping database migrations because RUN_MIGRATIONS=0.');
} else {
  await run('node', ['scripts/run-migrations.mjs']);
}

await run('node', ['server.js']);
