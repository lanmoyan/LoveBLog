import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export type VisitPayload = {
  sessionId: string;
  path: string;
  title?: string;
  referrer?: string;
  durationMs?: number;
  screen?: string;
};

let tableReady: Promise<void> | null = null;

export function cleanVisitPath(value: unknown) {
  const raw = String(value || '/').trim() || '/';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`.slice(0, 300) || '/';
    } catch {
      return '/';
    }
  }
  return raw.startsWith('/') ? raw.slice(0, 300) : `/${raw}`.slice(0, 300);
}

function cleanText(value: unknown, max = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return '';
}

function decodeHeader(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function requestRegion(request: Request) {
  const headers = request.headers;
  const country = decodeHeader(firstHeader(headers, ['x-vercel-ip-country', 'cf-ipcountry', 'x-country-code']));
  const province = decodeHeader(firstHeader(headers, ['x-vercel-ip-country-region', 'x-region', 'x-real-region']));
  const city = decodeHeader(firstHeader(headers, ['x-vercel-ip-city', 'x-city', 'x-real-city']));
  return [country, province, city].map((item) => cleanText(item, 40)).filter(Boolean).join(' / ') || '未知地区';
}

export function requestIpHash(request: Request) {
  const raw = firstHeader(request.headers, ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])
    .split(',')[0]
    .trim();
  return raw ? createHash('sha256').update(raw).digest('hex').slice(0, 32) : '';
}

export function parseDevice(userAgent: string, screen = '') {
  const ua = userAgent.toLowerCase();
  const mobile = /iphone|ipod|android.*mobile|windows phone|mobile/.test(ua);
  const tablet = /ipad|tablet|android(?!.*mobile)/.test(ua);
  const deviceType = tablet ? '平板' : mobile ? '移动端' : '电脑端';
  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('firefox/') ? 'Firefox'
      : ua.includes('chrome/') || ua.includes('crios/') ? 'Chrome'
        : ua.includes('safari/') ? 'Safari'
          : '未知浏览器';
  const os = ua.includes('windows') ? 'Windows'
    : ua.includes('iphone') || ua.includes('ipad') ? 'iOS'
      : ua.includes('android') ? 'Android'
        : ua.includes('mac os') ? 'macOS'
          : ua.includes('linux') ? 'Linux'
            : '未知系统';
  const detail = [os, browser, cleanText(screen, 32)].filter(Boolean).join(' · ');
  return { deviceType, browser, os, detail };
}

export async function ensureVisitEventTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "visit_events" (
          "id" SERIAL NOT NULL,
          "session_id" TEXT NOT NULL,
          "path" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT '',
          "referrer" TEXT NOT NULL DEFAULT '',
          "duration_ms" INTEGER NOT NULL DEFAULT 0,
          "region" TEXT NOT NULL DEFAULT '',
          "device_type" TEXT NOT NULL DEFAULT '电脑端',
          "device_detail" TEXT NOT NULL DEFAULT '',
          "browser" TEXT NOT NULL DEFAULT '',
          "os" TEXT NOT NULL DEFAULT '',
          "user_agent" TEXT NOT NULL DEFAULT '',
          "ip_hash" TEXT NOT NULL DEFAULT '',
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "visit_events_session_id_path_key" ON "visit_events"("session_id", "path")');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "visit_events_created_at_idx" ON "visit_events"("created_at")');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "visit_events_path_created_at_idx" ON "visit_events"("path", "created_at")');
    })();
  }
  return tableReady;
}

export function normalizeVisitPayload(value: unknown): VisitPayload {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    sessionId: cleanText(record.sessionId, 80) || 'anonymous',
    path: cleanVisitPath(record.path),
    title: cleanText(record.title, 160),
    referrer: cleanText(record.referrer, 300),
    durationMs: Math.max(0, Math.min(24 * 60 * 60 * 1000, Number(record.durationMs || 0) || 0)),
    screen: cleanText(record.screen, 32)
  };
}
