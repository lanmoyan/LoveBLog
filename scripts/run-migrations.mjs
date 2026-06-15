import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function splitSql(sql) {
  const statements = [];
  let current = '';
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1] || '';

    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      current += char;
      if (sql.startsWith(dollarTag, i)) {
        current += sql.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        dollarTag = '';
      }
      continue;
    }

    if (!single && !double && char === '-' && next === '-') {
      current += char + next;
      i += 1;
      lineComment = true;
      continue;
    }

    if (!single && !double && char === '/' && next === '*') {
      current += char + next;
      i += 1;
      blockComment = true;
      continue;
    }

    if (!single && !double && char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (!double && char === "'" && sql[i - 1] !== '\\') {
      single = !single;
      current += char;
      continue;
    }

    if (!single && char === '"') {
      double = !double;
      current += char;
      continue;
    }

    if (!single && !double && char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function ensureMigrationsTable(tx) {
  await tx.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function alreadyApplied(tx, migrationName) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = ${quoteLiteral(migrationName)} AND "rolled_back_at" IS NULL AND "finished_at" IS NOT NULL LIMIT 1`
  );
  return rows.length > 0;
}

async function applyMigration(migrationName, sql) {
  const id = randomUUID();
  const statements = splitSql(sql);

  await prisma.$transaction(async (tx) => {
    await ensureMigrationsTable(tx);
    if (await alreadyApplied(tx, migrationName)) return;

    await tx.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count") VALUES (${quoteLiteral(id)}, ${quoteLiteral(checksum(sql))}, ${quoteLiteral(migrationName)}, now(), 0)`
    );

    let appliedSteps = 0;
    for (const statement of statements) {
      await tx.$executeRawUnsafe(statement);
      appliedSteps += 1;
    }

    await tx.$executeRawUnsafe(
      `UPDATE "_prisma_migrations" SET "finished_at" = now(), "applied_steps_count" = ${appliedSteps} WHERE "id" = ${quoteLiteral(id)}`
    );
  });
}

async function main() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrations = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrations) {
    const sql = await readFile(join(migrationsDir, migrationName, 'migration.sql'), 'utf8');
    await applyMigration(migrationName, sql);
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
