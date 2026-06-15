import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { findUploadFile } from '@/lib/upload-storage';

type Context = { params: Promise<{ path: string[] }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contentTypes: Record<string, string> = {
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

const resizableTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parseRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) return null;
  return { start, end };
}

function numericParam(request: Request, key: string, fallback: number) {
  const value = Number(new URL(request.url).searchParams.get(key) || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function imageVariantRequest(request: Request, contentType: string) {
  if (!resizableTypes.has(contentType)) return null;
  const width = Math.round(numericParam(request, 'w', 0));
  if (!Number.isInteger(width) || width < 160) return null;
  return {
    width: Math.min(width, 2400),
    quality: Math.max(45, Math.min(92, Math.round(numericParam(request, 'q', 78))))
  };
}

async function variantFile(sourceFile: string, sourceSize: number, options: { width: number; quality: number }) {
  const parsed = path.parse(sourceFile);
  const cacheDir = path.join(parsed.dir, '.cache');
  const cacheFile = path.join(cacheDir, `${parsed.name}-w${options.width}-q${options.quality}.webp`);
  const cached = await stat(cacheFile).catch(() => null);
  const sourceInfo = await stat(sourceFile);
  if (cached?.isFile() && cached.mtimeMs >= sourceInfo.mtimeMs && cached.size > 0) {
    return { file: cacheFile, contentType: 'image/webp' };
  }

  await mkdir(cacheDir, { recursive: true });
  await sharp(sourceFile, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: options.width, withoutEnlargement: true })
    .webp({ quality: options.quality, effort: 4 })
    .toFile(cacheFile);

  const output = await stat(cacheFile).catch(() => null);
  if (!output?.isFile() || output.size <= 0 || output.size >= sourceSize) {
    return { file: sourceFile, contentType: '' };
  }
  return { file: cacheFile, contentType: 'image/webp' };
}

async function serveUpload(request: Request, parts: string[] | undefined, body: boolean) {
  if (!Array.isArray(parts) || parts.length !== 1) return new NextResponse(null, { status: 404 });

  const file = await findUploadFile(`/uploads/${parts[0]}`);
  if (!file) return new NextResponse(null, { status: 404 });

  const sourceInfo = await stat(file);
  let servedFile = file;
  let contentType = contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const variant = imageVariantRequest(request, contentType);
  if (variant) {
    const transformed = await variantFile(file, sourceInfo.size, variant).catch(() => null);
    if (transformed?.file) {
      servedFile = transformed.file;
      if (transformed.contentType) contentType = transformed.contentType;
    }
  }

  const info = servedFile === file ? sourceInfo : await stat(servedFile);
  const size = info.size;
  const range = parseRange(request.headers.get('range'), size);
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff'
  });

  if (range) {
    headers.set('Content-Length', String(range.end - range.start + 1));
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    const stream = body ? Readable.toWeb(createReadStream(servedFile, range)) as ReadableStream<Uint8Array> : null;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers.set('Content-Length', String(size));
  const stream = body ? Readable.toWeb(createReadStream(servedFile)) as ReadableStream<Uint8Array> : null;
  return new NextResponse(stream, {
    headers: {
      'Accept-Ranges': headers.get('Accept-Ranges') || 'bytes',
      'Cache-Control': headers.get('Cache-Control') || '',
      'Content-Length': headers.get('Content-Length') || String(size),
      'Content-Type': contentType
    }
  });
}

export async function GET(_request: Request, context: Context) {
  const { path: parts } = await context.params;
  return serveUpload(_request, parts, true);
}

export async function HEAD(_request: Request, context: Context) {
  const { path: parts } = await context.params;
  return serveUpload(_request, parts, false);
}
