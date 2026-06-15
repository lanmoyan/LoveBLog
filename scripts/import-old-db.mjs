import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const root = process.cwd();
const oldDbPath = path.resolve(root, '..', 'data', 'love.db');
const oldUploadDir = path.resolve(root, '..', 'uploads');
const configuredUploadDir = process.env.UPLOAD_DIR || process.env.UPLOADS_DIR || 'uploads';
const newUploadDir = path.isAbsolute(configuredUploadDir) ? configuredUploadDir : path.resolve(root, configuredUploadDir);
const reset = process.argv.includes('--reset');

function rows(db, table, columns = '*') {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
  if (!exists) return [];
  return db.prepare(`SELECT ${columns} FROM ${table}`).all();
}

function dateValue(value) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function resetTarget() {
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.message.deleteMany();
  await prisma.guestbookEntry.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.event.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function syncPostgresSequences() {
  const tables = [
    ['users', 'id'],
    ['posts', 'id'],
    ['post_images', 'id'],
    ['likes', 'id'],
    ['comments', 'id'],
    ['messages', 'id'],
    ['guestbook', 'id'],
    ['wishlist', 'id'],
    ['events', 'id'],
    ['blog_posts', 'id']
  ];

  for (const [table, column] of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', '${column}'),
        COALESCE((SELECT MAX("${column}") FROM "${table}"), 1),
        (SELECT COUNT(*) FROM "${table}") > 0
      )
    `);
  }
}

async function main() {
  if (!fs.existsSync(oldDbPath)) {
    throw new Error(`旧数据库不存在：${oldDbPath}`);
  }
  fs.mkdirSync(newUploadDir, { recursive: true });
  if (fs.existsSync(oldUploadDir)) {
    fs.cpSync(oldUploadDir, newUploadDir, { recursive: true });
  }

  const old = new DatabaseSync(oldDbPath, { readOnly: true });
  if (reset) await resetTarget();

  for (const row of rows(old, 'users')) {
    await prisma.user.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        avatar: row.avatar || '',
        avatarImage: row.avatar_image || '',
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {
        username: row.username,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        avatar: row.avatar || '',
        avatarImage: row.avatar_image || ''
      }
    });
  }

  for (const row of rows(old, 'settings')) {
    await prisma.setting.upsert({
      where: { key: row.key },
      create: { key: row.key, value: String(row.value ?? '') },
      update: { value: String(row.value ?? '') }
    });
  }

  for (const row of rows(old, 'posts')) {
    await prisma.post.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        authorId: row.author_id,
        content: row.content || '',
        mood: row.mood || '',
        video: row.video || '',
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {
        content: row.content || '',
        mood: row.mood || '',
        video: row.video || ''
      }
    });
  }

  for (const row of rows(old, 'post_images')) {
    await prisma.postImage.upsert({
      where: { id: row.id },
      create: { id: row.id, postId: row.post_id, path: row.path, sort: row.sort || 0 },
      update: { path: row.path, sort: row.sort || 0 }
    });
  }

  for (const row of rows(old, 'likes')) {
    await prisma.like.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {}
    });
  }

  for (const row of rows(old, 'comments')) {
    await prisma.comment.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id || null,
        guestQq: row.guest_qq || null,
        guestNick: row.guest_nick || null,
        parentId: row.parent_id || null,
        content: row.content,
        ip: row.ip || null,
        region: row.region || null,
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {
        content: row.content,
        parentId: row.parent_id || null
      }
    });
  }

  for (const row of rows(old, 'messages')) {
    await prisma.message.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        userId: row.user_id,
        content: row.content,
        color: row.color || '#fff4f6',
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: { content: row.content, color: row.color || '#fff4f6' }
    });
  }

  for (const row of rows(old, 'guestbook')) {
    await prisma.guestbookEntry.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        qq: row.qq,
        nickname: row.nickname || '',
        content: row.content,
        approved: Number(row.approved ?? 1),
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {
        nickname: row.nickname || '',
        content: row.content,
        approved: Number(row.approved ?? 1)
      }
    });
  }

  for (const row of rows(old, 'wishlist')) {
    await prisma.wishlistItem.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        content: row.content,
        done: Number(row.done || 0),
        createdAt: dateValue(row.created_at) || new Date(),
        doneAt: dateValue(row.done_at) || null,
        displayAt: dateValue(row.display_at) || null,
        noteStyle: row.note_style || 'paper',
        noteColor: row.note_color || '',
        textColor: row.text_color || ''
      },
      update: {
        content: row.content,
        done: Number(row.done || 0),
        doneAt: dateValue(row.done_at) || null,
        displayAt: dateValue(row.display_at) || null,
        noteStyle: row.note_style || 'paper',
        noteColor: row.note_color || '',
        textColor: row.text_color || ''
      }
    });
  }

  for (const row of rows(old, 'events')) {
    await prisma.event.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        date: row.date,
        title: row.title,
        description: row.description || '',
        image: row.image || '',
        imageMeta: row.image_meta || '{}',
        createdAt: dateValue(row.created_at) || new Date()
      },
      update: {
        date: row.date,
        title: row.title,
        description: row.description || '',
        image: row.image || '',
        imageMeta: row.image_meta || '{}'
      }
    });
  }

  old.close();
  await syncPostgresSequences();

  const counts = {
    users: await prisma.user.count(),
    posts: await prisma.post.count(),
    images: await prisma.postImage.count(),
    comments: await prisma.comment.count(),
    guestbook: await prisma.guestbookEntry.count(),
    wishlist: await prisma.wishlistItem.count(),
    events: await prisma.event.count()
  };
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
