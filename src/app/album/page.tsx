import { AlbumGallery } from '@/components/album-gallery';
import { readLocalImageMeta } from '@/lib/exif';
import { prisma } from '@/lib/prisma';
import { getSiteSnapshot } from '@/lib/site';
import { findUploadFile } from '@/lib/upload-storage';
import { publicUploadUrl, uploadNameFromPublicPath } from '@/lib/uploads';
import { stat as fsStat } from 'node:fs/promises';

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

function remoteFileName(value: string) {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return '';
  }
}

async function imageFileInfo(publicPath: string) {
  const fileName = uploadNameFromPublicPath(publicPath) || remoteFileName(publicPath);
  const file = await findUploadFile(publicPath);
  if (!file) return { fileName, fileSize: '' };
  const info = await fsStat(file).catch(() => null);
  return {
    fileName,
    fileSize: info?.isFile() ? formatBytes(info.size) : ''
  };
}

function parseImageTime(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    .replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
    .replace(' ', 'T');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

export default async function AlbumPage() {
  const [snapshot, postImageRows] = await Promise.all([
    getSiteSnapshot(),
    prisma.postImage.findMany({
      orderBy: [{ post: { createdAt: 'desc' } }, { sort: 'asc' }, { id: 'asc' }],
      include: {
        post: {
          select: {
            content: true,
            mood: true,
            createdAt: true,
            author: { select: { displayName: true } }
          }
        }
      }
    })
  ]);
  const postImages = postImageRows.map((image) => ({
    id: image.id,
    path: publicUploadUrl(image.path),
    author: image.post.author.displayName,
    createdAt: image.post.createdAt,
    title: image.post.mood || image.post.author.displayName || '相册',
    description: image.post.content
  }));
  const homeImages = snapshot.homeAlbumImages.map((image, index) => ({
    id: `home-${index}-${image.path}`,
    path: image.path,
    author: snapshot.title,
    createdAt: image.createdAt || '',
    title: image.title || '',
    description: image.description || '',
    tags: image.tags || [],
    mood: image.mood || ''
  }));
  const seenPaths = new Set<string>();
  const rawImages = [...postImages, ...homeImages].filter((image) => {
    if (seenPaths.has(image.path)) return false;
    seenPaths.add(image.path);
    return true;
  });
  const images = (await Promise.all(rawImages.map(async (image) => {
    const [imageMeta, fileInfo] = await Promise.all([
      readLocalImageMeta(image.path),
      imageFileInfo(image.path)
    ]);
    return {
      ...image,
      imageMeta,
      ...fileInfo
    };
  }))).sort((a, b) => {
    const bTakenAt = b.imageMeta?.taken_at || [b.imageMeta?.date, b.imageMeta?.time].filter(Boolean).join(' ') || b.createdAt;
    const aTakenAt = a.imageMeta?.taken_at || [a.imageMeta?.date, a.imageMeta?.time].filter(Boolean).join(' ') || a.createdAt;
    return parseImageTime(bTakenAt) - parseImageTime(aTakenAt);
  });

  return <AlbumGallery images={images} siteTitle={snapshot.title} siteIcon={snapshot.siteIcon} />;
}
