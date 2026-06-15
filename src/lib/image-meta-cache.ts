import { getImageAssetMap, imageMetaFromAsset, normalizeImageAssetPath } from '@/lib/image-assets';
import { cacheStoredUploadImage } from '@/lib/upload-storage';

export async function readCachedImageMeta(publicPath: string | null | undefined) {
  const raw = String(publicPath || '').trim();
  if (!raw) return {};

  await cacheStoredUploadImage(raw).catch(() => null);
  const assets = await getImageAssetMap([raw]);
  return imageMetaFromAsset(assets.get(normalizeImageAssetPath(raw)));
}
