import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { autoEventImageMeta, parseEventMeta, publicEvent } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload, saveUploadedFile } from '@/lib/upload-storage';
import { cleanRemoteImageUrl } from '@/lib/uploads';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const current = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!current) return NextResponse.json({ error: '事件不存在' }, { status: 404 });
    const form = await request.formData();
    const date = String(form.get('date') || '').trim();
    const title = String(form.get('title') || '').trim().slice(0, 40);
    const description = String(form.get('description') || '').trim().slice(0, 500);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: '请选择正确的日期' }, { status: 400 });
    if (!title) return NextResponse.json({ error: '事件标题不能为空' }, { status: 400 });
    const duplicate = await prisma.event.findFirst({
      where: { date, title, description, id: { not: current.id } },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ error: '已存在相同时光碎片，已取消保存' }, { status: 409 });
    }

    let image = current.image;
    let imageMeta = parseEventMeta(current.imageMeta);
    const file = form.get('image');
    const imageUrl = cleanRemoteImageUrl(form.get('imageUrl') || form.get('image_url'));
    if (file instanceof File && file.size > 0) {
      await removeUpload(current.image);
      image = await saveUploadedFile(file, 'event');
      imageMeta = await autoEventImageMeta(image);
    } else if (imageUrl) {
      await removeUpload(current.image);
      image = imageUrl;
      imageMeta = {};
    } else if (form.get('removeImage') === '1' || form.get('remove_image') === '1') {
      await removeUpload(current.image);
      image = '';
      imageMeta = {};
    }

    const event = await prisma.event.update({
      where: { id: current.id },
      data: { date, title, description, image, imageMeta: JSON.stringify(imageMeta) }
    });
    return NextResponse.json({ event: publicEvent(event) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) return NextResponse.json({ error: '事件不存在' }, { status: 404 });
    await prisma.event.delete({ where: { id: event.id } });
    await removeUpload(event.image);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
