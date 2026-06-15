import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { getSetting, normalizeHomeAlbumImages, safeJson } from '../src/lib/settings';
import { cacheStoredUploadImage } from '../src/lib/upload-storage';

function addPath(paths: Set<string>, value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return;
  if (raw.startsWith('/api/uploads/') || raw.startsWith('/uploads/')) paths.add(raw);
}

async function collectImagePaths() {
  const paths = new Set<string>();
  const [users, postImages, events, stories, homeAlbumJson, siteIcon] = await Promise.all([
    prisma.user.findMany({ select: { avatarImage: true } }),
    prisma.postImage.findMany({ select: { path: true } }),
    prisma.event.findMany({ select: { image: true } }),
    prisma.blogPost.findMany({ select: { coverImage: true } }),
    getSetting('home_album_images', '[]'),
    getSetting('site_icon', '')
  ]);

  users.forEach((user) => addPath(paths, user.avatarImage));
  postImages.forEach((image) => addPath(paths, image.path));
  events.forEach((event) => addPath(paths, event.image));
  stories.forEach((story) => addPath(paths, story.coverImage));
  normalizeHomeAlbumImages(safeJson(homeAlbumJson, [])).forEach((image) => addPath(paths, image.path));
  addPath(paths, siteIcon);

  for (const baseDir of ['uploads', path.join('public', 'uploads')]) {
    const files = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
    for (const entry of files) {
      if (!entry.isFile()) continue;
      addPath(paths, `/api/uploads/${entry.name}`);
    }
  }

  return Array.from(paths);
}

async function main() {
  const paths = await collectImagePaths();
  let cached = 0;
  let skipped = 0;

  for (const path of paths) {
    const result = await cacheStoredUploadImage(path).catch(() => null);
    if (result) cached += 1;
    else skipped += 1;
  }

  console.log(`Image asset warmup complete. cached=${cached} skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
