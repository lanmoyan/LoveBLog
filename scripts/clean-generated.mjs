import { readdir, rm, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const removed = [];

function insideRoot(path) {
  const rel = relative(root, path);
  return rel && !rel.startsWith('..') && !rel.includes(`..${sep}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function removePath(path) {
  const target = resolve(root, path);
  if (!insideRoot(target)) {
    throw new Error(`Refusing to remove path outside project: ${target}`);
  }
  if (!(await exists(target))) return;
  await rm(target, { recursive: true, force: true });
  removed.push(relative(root, target));
}

async function removePrismaTmpFiles(path) {
  const dir = resolve(root, path);
  if (!insideRoot(dir) || !(await exists(dir))) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.includes('.tmp')) continue;
    await removePath(resolve(dir, entry.name));
  }
}

await removePrismaTmpFiles('node_modules/.prisma/client');
await removePrismaTmpFiles('.next/standalone/node_modules/.prisma/client');
await removePath('.next/cache');

if (args.has('--next')) {
  await removePath('.next');
}

if (removed.length === 0) {
  console.log('No generated files needed cleaning.');
} else {
  console.log(`Removed ${removed.length} generated path(s):`);
  for (const path of removed) console.log(`- ${path}`);
}
