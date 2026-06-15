import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { uploadNameFromPublicPath } from '@/lib/uploads';

const uploadPathPrefix = '/api/uploads/';
const managedUploadNamePattern = /^(?:upload|post|video|story-cover|event|home-album|site-icon|avatar-\d+)-\d{10,}-\d{1,10}\.(?:jpe?g|png|webp|gif|ico|mp4|webm|mov)$/i;

class UploadError extends Error {
  expose = true;
  status = 400;
}

function uploadError(message: string) {
  return new UploadError(message);
}

function storageErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return '请检查存储配置和权限。';
  return [error.name, error.message]
    .filter(Boolean)
    .join(': ')
    .replace(/\s+/g, ' ')
    .slice(0, 180) || '请检查存储配置和权限。';
}

function storageDriver() {
  return String(process.env.STORAGE_DRIVER || '').trim().toLowerCase();
}

function s3Enabled() {
  return storageDriver() === 's3' || storageDriver() === 'r2';
}

function s3Bucket() {
  return String(process.env.S3_BUCKET || process.env.R2_BUCKET || '').trim();
}

function s3PublicBaseUrl() {
  return String(process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
}

function s3KeyPrefix() {
  return String(process.env.S3_KEY_PREFIX || process.env.R2_KEY_PREFIX || 'uploads').trim().replace(/^\/+|\/+$/g, '');
}

let cachedS3Client: S3Client | null = null;

function s3Client() {
  if (cachedS3Client) return cachedS3Client;
  const endpoint = String(process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '').trim() || undefined;
  const region = String(process.env.S3_REGION || process.env.R2_REGION || 'auto').trim();
  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) throw uploadError('对象存储访问密钥未配置，请检查 S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY。');
  cachedS3Client = new S3Client({
    endpoint,
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1',
    credentials: { accessKeyId, secretAccessKey }
  });
  return cachedS3Client;
}

function objectKeyFromName(name: string) {
  const prefix = s3KeyPrefix();
  return prefix ? `${prefix}/${name}` : name;
}

function isManagedUploadName(name: string) {
  return managedUploadNamePattern.test(name);
}

function managedNameFromObjectKey(key: string) {
  const prefix = s3KeyPrefix();
  const expectedPrefix = prefix ? `${prefix}/` : '';
  if (expectedPrefix && !key.startsWith(expectedPrefix)) return '';
  const name = key.slice(expectedPrefix.length);
  return name && !name.includes('/') && isManagedUploadName(name) ? name : '';
}

function s3PublicUrl(name: string) {
  const baseUrl = s3PublicBaseUrl();
  if (!baseUrl) throw uploadError('对象存储公开访问地址未配置，请检查 S3_PUBLIC_URL 或 R2_PUBLIC_URL。');
  return `${baseUrl}/${objectKeyFromName(name).split('/').map(encodeURIComponent).join('/')}`;
}

function configuredUploadDir() {
  const raw = String(process.env.UPLOAD_DIR || process.env.UPLOADS_DIR || '').trim();
  const root = /*turbopackIgnore: true*/ process.cwd();
  if (!raw) return path.join(root, 'uploads');
  return path.isAbsolute(raw) ? raw : path.resolve(/*turbopackIgnore: true*/ root, raw);
}

function sourceRootFromStandalone() {
  const marker = `${path.sep}.next${path.sep}standalone`;
  const root = /*turbopackIgnore: true*/ process.cwd();
  return root.endsWith(marker) ? path.resolve(/*turbopackIgnore: true*/ root, '..', '..') : '';
}

function uniqueDirs(values: Array<string | false | undefined>) {
  return Array.from(new Set(values.flatMap((value) => value ? [path.resolve(/*turbopackIgnore: true*/ value)] : [])));
}

function uploadDir() {
  return configuredUploadDir();
}

function uploadDirs() {
  const sourceRoot = sourceRootFromStandalone();
  const root = /*turbopackIgnore: true*/ process.cwd();
  return uniqueDirs([
    uploadDir(),
    path.join(root, 'public', 'uploads'),
    sourceRoot && path.join(sourceRoot, 'uploads'),
    sourceRoot && path.join(sourceRoot, 'public', 'uploads')
  ]);
}

function cleanFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'upload';
}

export async function findUploadFile(publicPath: string | null | undefined) {
  const name = uploadNameFromPublicPath(publicPath);
  if (!name) return '';

  for (const dir of uploadDirs()) {
    const file = path.join(dir, name);
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }

  return '';
}

const imageTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['image/gif', ['.gif']]
]);

const iconTypes = new Map([
  ...imageTypes,
  ['image/x-icon', ['.ico']],
  ['image/vnd.microsoft.icon', ['.ico']]
]);

const videoTypes = new Map([
  ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']],
  ['video/quicktime', ['.mov']]
]);

function hasKnownSignature(buffer: Buffer, type: string) {
  if (type === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/gif') return buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
  if (type === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') {
    return buffer.length >= 6
      && buffer[0] === 0x00
      && buffer[1] === 0x00
      && (buffer[2] === 0x01 || buffer[2] === 0x02)
      && buffer[3] === 0x00
      && buffer[4] > 0;
  }
  if (type === 'video/mp4' || type === 'video/quicktime') return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (type === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

export async function saveUploadedFile(file: File, prefix = 'upload', options: { video?: boolean; icon?: boolean; maxBytes?: number } = {}) {
  const maxBytes = options.maxBytes ?? (options.video ? 100 * 1024 * 1024 : 10 * 1024 * 1024);
  if (file.size > maxBytes) throw uploadError(`文件不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB。`);
  const allowed = options.video ? videoTypes : options.icon ? iconTypes : imageTypes;
  if (!allowed.has(file.type)) throw uploadError(options.video ? '暂不支持这种视频格式。' : '只能上传图片文件。');

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasKnownSignature(bytes, file.type)) throw uploadError(options.video ? '无法识别视频内容，请换一个文件。' : '无法识别图片内容，请换一张图片。');

  const fallbackExt = allowed.get(file.type)?.[0] || (options.video ? '.mp4' : '.jpg');
  const rawExt = path.extname(file.name).toLowerCase();
  const ext = allowed.get(file.type)?.includes(rawExt) ? rawExt : fallbackExt;
  const name = `${cleanFilePart(prefix)}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  if (s3Enabled()) {
    const bucket = s3Bucket();
    if (!bucket) throw uploadError('对象存储桶未配置，请检查 S3_BUCKET 或 R2_BUCKET。');
    try {
      await s3Client().send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKeyFromName(name),
        Body: bytes,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable'
      }));
    } catch (error) {
      throw uploadError(`对象存储上传失败：${storageErrorMessage(error)}`);
    }
    return s3PublicUrl(name);
  }

  try {
    const targetUploadDir = uploadDir();
    await mkdir(targetUploadDir, { recursive: true });
    await writeFile(path.join(targetUploadDir, name), bytes);
    await Promise.all(uploadDirs()
      .filter((dir) => dir !== path.resolve(/*turbopackIgnore: true*/ targetUploadDir))
      .map(async (dir) => {
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, name), bytes);
      }));
  } catch (error) {
    throw uploadError(`本地上传目录写入失败：${storageErrorMessage(error)}`);
  }
  return `${uploadPathPrefix}${name}`;
}

export async function removeUpload(publicPath: string | null | undefined) {
  const name = uploadNameFromPublicPath(publicPath);
  if (name) {
    if (!isManagedUploadName(name)) return;
    await Promise.all(uploadDirs().map(async (dir) => {
      await rm(path.join(dir, name), { force: true }).catch(() => {});
      const parsed = path.parse(name);
      const cacheDir = path.join(dir, '.cache');
      const entries = await readdir(cacheDir).catch(() => []);
      await Promise.all(entries
        .filter((entry) => entry.startsWith(`${parsed.name}-w`) && entry.endsWith('.webp'))
        .map((entry) => rm(path.join(cacheDir, entry), { force: true }).catch(() => {})));
    }));
    return;
  }

  if (!s3Enabled()) return;
  const raw = String(publicPath || '').trim();
  const baseUrl = s3PublicBaseUrl();
  if (!raw || !baseUrl || !raw.startsWith(`${baseUrl}/`)) return;
  const key = raw
    .slice(baseUrl.length + 1)
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');
  if (!key || !managedNameFromObjectKey(key)) return;
  const bucket = s3Bucket();
  if (!bucket) return;
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
}
