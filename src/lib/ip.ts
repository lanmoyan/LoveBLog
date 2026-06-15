import crypto from 'node:crypto';

function ipSecret() {
  const value = process.env.IP_SECRET || process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('IP_SECRET or AUTH_SECRET is required in production.');
  }
  return value || 'love-next-build-ip-secret';
}

const key = crypto.createHash('sha256').update(ipSecret()).digest();

export function normalizeIp(raw: string | null | undefined) {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

export function maskIp(raw: string | null | undefined) {
  const ip = normalizeIp(raw);
  if (!ip) return '';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  const parts = ip.split(':');
  return `${parts[0]}:${parts[1] || ''}:****`;
}

export function lookupRegion(raw: string | null | undefined) {
  const ip = normalizeIp(raw);
  if (!ip || ip === '127.0.0.1' || ip === '::1' || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
    return '本地';
  }
  return '未知';
}

export function encryptIp(ip: string) {
  if (!ip) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(ip, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, enc].map((part) => part.toString('base64url')).join('.');
  } catch {
    return '';
  }
}

export function decryptIp(token: string | null | undefined) {
  if (!token) return '';
  try {
    const [ivB, tagB, encB] = String(token).split('.');
    const iv = Buffer.from(ivB, 'base64url');
    const tag = Buffer.from(tagB, 'base64url');
    const enc = Buffer.from(encB, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
