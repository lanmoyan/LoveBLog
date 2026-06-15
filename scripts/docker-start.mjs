import { spawn } from 'node:child_process';

let activeChild = null;

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

await import('./prepare-db.mjs');

if (process.env.RUN_MIGRATIONS === '0') {
  console.log('Skipping database migrations because RUN_MIGRATIONS=0.');
} else {
  await run('node', ['scripts/run-migrations.mjs']);
}

await run('node', ['server.js']);
