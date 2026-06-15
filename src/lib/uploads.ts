const uploadPathPrefix = '/api/uploads/';
const legacyUploadPathPrefix = '/uploads/';
const uploadNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

function storagePublicBaseUrls() {
  return [process.env.S3_PUBLIC_URL, process.env.R2_PUBLIC_URL]
    .map((value) => String(value || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function isOwnStorageUrl(url: URL) {
  const raw = url.toString();
  return storagePublicBaseUrls().some((baseUrl) => raw === baseUrl || raw.startsWith(`${baseUrl}/`));
}

export function uploadNameFromPublicPath(value: string | null | undefined) {
  const raw = String(value || '').trim().split(/[?#]/)[0];
  const localPath = raw.startsWith(uploadPathPrefix) || raw.startsWith(legacyUploadPathPrefix) ? raw : '';
  if (!localPath) return '';
  const name = localPath.split('/').filter(Boolean).pop() || '';
  return uploadNamePattern.test(name) ? name : '';
}

export function cleanLocalUploadUrl(value: unknown) {
  const name = uploadNameFromPublicPath(String(value || '').trim());
  return name ? `${uploadPathPrefix}${name}` : '';
}

export function publicUploadUrl(value: unknown) {
  const raw = String(value || '').trim();
  const name = uploadNameFromPublicPath(raw);
  return name ? `${uploadPathPrefix}${name}` : raw;
}

export function cleanImageUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const localUrl = cleanLocalUploadUrl(raw);
  if (localUrl) return localUrl;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function cleanRemoteImageUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw || cleanLocalUploadUrl(raw)) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && !isOwnStorageUrl(url) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function cleanExternalUrl(value: unknown) {
  const url = cleanImageUrl(value);
  return url.replace(/\/$/, '');
}
