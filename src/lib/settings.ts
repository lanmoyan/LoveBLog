import { prisma } from '@/lib/prisma';
import { cleanImageUrl } from '@/lib/uploads';
import { DEFAULT_USER_ROLES, normalizeUserRoles } from '@/lib/users';

export const DEFAULT_EMOJI_PACKS = [
  { name: '常用', items: ['😊', '😘', '🥰', '😍', '🤗', '😜', '🥺', '😭', '😂', '👍', '🎉', '✨'] },
  { name: '恋爱', items: ['🌹', '💐', '💖', '💕', '💗', '💞', '💋', '💌', '💘', '💝', '🫶', '💍'] },
  { name: '氛围', items: ['🌙', '⭐', '☀️', '🌈', '🍰', '🎂', '🍓', '🧸', '🎀', '🎁', '🎆', '📷'] }
] as const;

export type EmojiItem = string | { label: string; url: string; text?: string };
export type EmojiPack = { name: string; items: EmojiItem[] };

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getSettingMap() {
  try {
    const settings = await prisma.setting.findMany();
    return new Map(settings.map((item) => [item.key, item.value]));
  } catch {
    return new Map<string, string>();
  }
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
}

export async function getSetting(key: string, fallback = '') {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

function cleanExternalUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeEmojiItem(item: unknown): EmojiItem | '' {
  if (typeof item === 'string') return item.trim().slice(0, 120);
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  const url = cleanExternalUrl(record.url || record.src || record.image);
  const label = String(record.label || record.name || '表情').trim().slice(0, 24);
  const text = String(record.text || '').trim().slice(0, 120);
  return url ? { label, url, text } : text;
}

export function normalizeEmojiPacks(value: unknown): EmojiPack[] {
  const raw = Array.isArray(value) ? value : DEFAULT_EMOJI_PACKS;
  const packs = raw
    .slice(0, 12)
    .map((pack, index) => {
      const record = pack as Record<string, unknown>;
      const name = String(record?.name || `表情${index + 1}`).trim().slice(0, 16);
      const items = Array.isArray(record?.items)
        ? record.items.map(normalizeEmojiItem).filter(Boolean).slice(0, 120)
        : [];
      return { name, items } as EmojiPack;
    })
    .filter((pack) => pack.name && pack.items.length);
  return packs.length ? packs : DEFAULT_EMOJI_PACKS.map((pack) => ({ name: pack.name, items: [...pack.items] }));
}

export function parseImageUrls(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(cleanImageUrl).filter(Boolean);
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(cleanImageUrl).filter(Boolean);
  } catch {
    // fall through
  }
  return raw.split(/\r?\n|,/).map(cleanImageUrl).filter(Boolean);
}

export function readEmojiPacksFromMap(settings: Map<string, string>) {
  return normalizeEmojiPacks(safeJson(settings.get('emoji_packs_json'), DEFAULT_EMOJI_PACKS));
}

export function readUserRolesFromMap(settings: Map<string, string>) {
  return normalizeUserRoles(safeJson(settings.get('user_roles_json'), DEFAULT_USER_ROLES));
}
