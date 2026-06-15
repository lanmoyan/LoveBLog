export function imageVariantUrl(src: string | null | undefined, width = 960, quality = 78) {
  const raw = String(src || '').trim();
  if (!raw || !Number.isFinite(width) || width <= 0) return raw;
  if (!raw.startsWith('/api/uploads/') && !raw.startsWith('/uploads/')) return raw;

  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  params.set('w', String(Math.round(width)));
  params.set('q', String(Math.max(45, Math.min(92, Math.round(quality)))));
  return `${path}?${params.toString()}`;
}
