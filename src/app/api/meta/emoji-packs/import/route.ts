import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { normalizeEmojiPacks, type EmojiItem, type EmojiPack } from '@/lib/settings';
import { jsonError } from '@/lib/responses';

function cleanText(value: unknown, max = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeImageUrl(value: string) {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);
}

function normalizeImportItem(value: unknown, fallbackLabel = '表情'): EmojiItem | null {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    if (isHttpUrl(raw)) {
      const label = raw.split(/[/?#]/).filter(Boolean).pop()?.replace(/\.[a-z0-9]+$/i, '') || fallbackLabel;
      return { label: cleanText(label, 24), url: raw };
    }
    return cleanText(raw);
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const url = cleanText(record.url || record.src || record.image || record.icon || record.href, 500);
  const label = cleanText(record.label || record.name || record.title || fallbackLabel, 24);
  const text = cleanText(record.text || record.code || record.value, 120);
  if (url && isHttpUrl(url)) return { label, url, text: text || undefined };
  return text || null;
}

function packsFromUnknown(value: unknown, fallbackName: string): EmojiPack[] {
  if (Array.isArray(value)) {
    const maybePacks = value.filter((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).items));
    if (maybePacks.length) return normalizeEmojiPacks(maybePacks);
    const items = value
      .map((item) => normalizeImportItem(item, fallbackName))
      .filter((item): item is EmojiItem => Boolean(item));
    return items.length ? [{ name: fallbackName, items }] : [];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const packName = cleanText(record.name || record.title || fallbackName, 16);
    const packs = record.packs || record.data || record.list || record.groups;
    if (Array.isArray(packs)) return packsFromUnknown(packs, packName);
    const items = record.items || record.emojis || record.images || record.icons;
    if (Array.isArray(items)) {
      return [{
        name: packName,
        items: items
          .map((item) => normalizeImportItem(item, packName))
          .filter((item): item is EmojiItem => Boolean(item))
      }].filter((pack) => pack.items.length);
    }
  }

  const raw = String(value || '').trim();
  if (!raw) return [];
  const items = raw
    .split(/\r?\n|,/)
    .map((item) => normalizeImportItem(item, fallbackName))
    .filter((item): item is EmojiItem => Boolean(item));
  return items.length ? [{ name: fallbackName, items }] : [];
}

async function readSource(source: string) {
  if (!isHttpUrl(source)) return source;
  if (looksLikeImageUrl(source)) return [source];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(source, {
      headers: { Accept: 'application/json,text/plain,*/*' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!res.ok) throw new Error('source fetch failed');
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    const source = String(body.source || '').trim();
    const fallbackName = cleanText(body.name, 16) || '网络表情包';
    if (!source) return NextResponse.json({ error: '请提供表情来源' }, { status: 400 });

    let value: unknown = source;
    if (source.startsWith('{') || source.startsWith('[')) {
      value = JSON.parse(source);
    } else {
      value = await readSource(source);
    }

    const packs = packsFromUnknown(value, fallbackName).slice(0, 12);
    if (!packs.length) return NextResponse.json({ error: '没有识别到可用表情项' }, { status: 400 });
    return NextResponse.json({ packs: normalizeEmojiPacks(packs) });
  } catch (error) {
    return jsonError(error, '表情包导入失败');
  }
}
