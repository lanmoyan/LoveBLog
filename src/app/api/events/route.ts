import { NextResponse } from 'next/server';
import { getAuthUserFromRequest, requireAdminUser } from '@/lib/auth';
import { readLocalImageMeta } from '@/lib/exif';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { getSetting } from '@/lib/settings';
import { saveUploadedFile } from '@/lib/upload-storage';
import { cleanRemoteImageUrl, publicUploadUrl } from '@/lib/uploads';
import { canAdmin } from '@/lib/users';

export const runtime = 'nodejs';

function parseMeta(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function publicEvent<T extends { image: string; imageMeta: string }>(event: T) {
  return { ...event, image: publicUploadUrl(event.image), imageMeta: parseMeta(event.imageMeta) };
}

async function autoMeta(image: string) {
  if ((await getSetting('image_meta_enabled', '1')) === '0') return {};
  return readLocalImageMeta(image);
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  const scope = (new URL(request.url).searchParams.get('scope') || '').trim().toLowerCase();
  if (scope === 'mine') return NextResponse.json({ events: [] });
  if (scope === 'all' && !canAdmin(user)) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    orderBy: [{ date: 'asc' }, { id: 'asc' }]
  });
  return NextResponse.json({ events: events.map(publicEvent) });
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const form = await request.formData();
    const date = String(form.get('date') || '').trim();
    const title = String(form.get('title') || '').trim().slice(0, 40);
    const description = String(form.get('description') || '').trim().slice(0, 500);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: '请选择正确的日期' }, { status: 400 });
    if (!title) return NextResponse.json({ error: '事件标题不能为空' }, { status: 400 });
    const file = form.get('image');
    const imageUrl = cleanRemoteImageUrl(form.get('imageUrl') || form.get('image_url'));
    const image = file instanceof File && file.size > 0 ? await saveUploadedFile(file, 'event') : imageUrl;
    const event = await prisma.event.create({
      data: {
        date,
        title,
        description,
        image,
        imageMeta: JSON.stringify(await autoMeta(image))
      }
    });
    return NextResponse.json({ event: publicEvent(event) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
