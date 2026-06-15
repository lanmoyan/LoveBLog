import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getSetting, normalizeAlbumTags, normalizeHomeAlbumImages, safeJson, setSetting } from '@/lib/settings';
import { jsonError } from '@/lib/responses';
import { removeUpload } from '@/lib/upload-storage';

type Context = { params: Promise<{ index: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { index } = await context.params;
    const n = Number(index);
    const images = normalizeHomeAlbumImages(safeJson(await getSetting('home_album_images', '[]'), []));
    if (!Number.isInteger(n) || n < 0 || n >= images.length) {
      return NextResponse.json({ error: '相册图片不存在' }, { status: 404 });
    }
    const [removed] = images.splice(n, 1);
    await removeUpload(removed.path);
    await setSetting('home_album_images', JSON.stringify(images));
    return NextResponse.json({ images });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { index } = await context.params;
    const n = Number(index);
    const images = normalizeHomeAlbumImages(safeJson(await getSetting('home_album_images', '[]'), []));
    if (!Number.isInteger(n) || n < 0 || n >= images.length) {
      return NextResponse.json({ error: '相册图片不存在' }, { status: 404 });
    }

    const data = await request.json().catch(() => ({}));
    images[n] = {
      ...images[n],
      title: String(data.title || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      description: String(data.description || '').replace(/\s+/g, ' ').trim().slice(0, 180),
      tags: normalizeAlbumTags(data.tags),
      mood: String(data.mood || '').replace(/\s+/g, ' ').trim().slice(0, 24)
    };
    await setSetting('home_album_images', JSON.stringify(images));
    return NextResponse.json({ images });
  } catch (error) {
    return jsonError(error);
  }
}
