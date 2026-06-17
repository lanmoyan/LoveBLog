import { readCachedImageMeta } from '@/lib/image-meta-cache';
import { getSetting } from '@/lib/settings';
import { publicUploadUrl } from '@/lib/uploads';

export function parseEventMeta(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function publicEvent<T extends { image: string; imageMeta: string }>(event: T) {
  return { ...event, image: publicUploadUrl(event.image), imageMeta: parseEventMeta(event.imageMeta) };
}

export async function autoEventImageMeta(image: string) {
  if ((await getSetting('image_meta_enabled', '1')) === '0') return {};
  return readCachedImageMeta(image);
}
