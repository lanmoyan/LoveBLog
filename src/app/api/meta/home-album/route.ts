import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getSetting, normalizeHomeAlbumImages, parseImageUrls, safeJson, setSetting, type HomeAlbumImage } from '@/lib/settings';
import { jsonError } from '@/lib/responses';
import { saveUploadedFile } from '@/lib/upload-storage';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const form = await request.formData();
    const current = normalizeHomeAlbumImages(safeJson(await getSetting('home_album_images', '[]'), []));
    const files = form.getAll('images').filter((item): item is File => item instanceof File && item.size > 0);
    const urls = parseImageUrls(form.get('imageUrls') || form.get('image_urls') || form.get('url'));
    if (!files.length && !urls.length) return NextResponse.json({ error: '请选择图片或填写图片 URL' }, { status: 400 });
    const uploaded = [];
    for (const file of files.slice(0, 12)) uploaded.push(await saveUploadedFile(file, 'home-album'));
    const createdAt = new Date().toISOString();
    const additions: HomeAlbumImage[] = uploaded.concat(urls).map((path) => ({ path, createdAt }));
    const images = current.concat(additions).slice(0, 48);
    await setSetting('home_album_images', JSON.stringify(images));
    return NextResponse.json({ images }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
