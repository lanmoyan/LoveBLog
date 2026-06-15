import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { readCachedImageMeta } from '@/lib/image-meta-cache';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) return NextResponse.json({ error: '事件不存在' }, { status: 404 });
    const imageMeta = await readCachedImageMeta(event.image);
    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { imageMeta: JSON.stringify(imageMeta) }
    });
    return NextResponse.json({ event: { ...updated, imageMeta }, recognized: Object.keys(imageMeta).length > 0 });
  } catch (error) {
    return jsonError(error);
  }
}
