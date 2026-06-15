import type { ImageAsset } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ImageAssetMeta = Record<string, unknown>;
export type ImageVariantInfo = Record<string, unknown>;

export type ImageAssetInput = {
  path: string;
  originalName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  exifMeta?: ImageAssetMeta;
  variants?: ImageVariantInfo;
};

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function boundedInt(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) && next > 0 ? Math.min(Math.round(next), 2_147_483_647) : 0;
}

export function normalizeImageAssetPath(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw.replace(/^\/uploads\//, '/api/uploads/');
  if (raw.startsWith('/api/uploads/')) return raw.split('?')[0];
  return raw;
}

export function imageMetaFromAsset(asset: ImageAsset | null | undefined): ImageAssetMeta {
  if (!asset) return {};
  const meta = safeJson<ImageAssetMeta>(asset.exifMeta, {});
  const width = boundedInt(asset.width);
  const height = boundedInt(asset.height);
  const fileSize = boundedInt(asset.fileSize);

  return {
    ...meta,
    ...(width && !meta.pixel_width ? { pixel_width: String(width) } : {}),
    ...(height && !meta.pixel_height ? { pixel_height: String(height) } : {}),
    ...(fileSize ? { file_size_bytes: fileSize } : {})
  };
}

export async function getImageAssetMap(paths: Array<string | null | undefined>) {
  const normalized = Array.from(new Set(paths.map(normalizeImageAssetPath).filter(Boolean)));
  if (!normalized.length) return new Map<string, ImageAsset>();

  const rows = await prisma.imageAsset.findMany({
    where: { path: { in: normalized } }
  });
  return new Map(rows.map((row) => [row.path, row]));
}

export async function upsertImageAsset(input: ImageAssetInput) {
  const path = normalizeImageAssetPath(input.path);
  if (!path) return null;

  const data = {
    originalName: String(input.originalName || '').slice(0, 240),
    mimeType: String(input.mimeType || '').slice(0, 120),
    fileSize: boundedInt(input.fileSize),
    width: boundedInt(input.width),
    height: boundedInt(input.height),
    exifMeta: JSON.stringify(input.exifMeta || {}),
    variants: JSON.stringify(input.variants || {})
  };

  return prisma.imageAsset.upsert({
    where: { path },
    create: { path, ...data },
    update: data
  });
}

export async function removeImageAsset(path: string | null | undefined) {
  const normalized = normalizeImageAssetPath(path);
  if (!normalized) return;
  await prisma.imageAsset.deleteMany({ where: { path: normalized } });
}
