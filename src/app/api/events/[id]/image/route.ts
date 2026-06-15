import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload } from '@/lib/upload-storage';
import { publicUploadUrl } from '@/lib/uploads';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

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

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) return NextResponse.json({ error: '时光不存在' }, { status: 404 });
    if (!event.image) return NextResponse.json({ error: '图片不存在' }, { status: 404 });

    const updatedEvent = await prisma.event.update({
      where: { id: event.id },
      data: { image: '', imageMeta: '{}' }
    });
    await removeUpload(event.image);
    return NextResponse.json({ event: publicEvent(updatedEvent) });
  } catch (error) {
    return jsonError(error);
  }
}
