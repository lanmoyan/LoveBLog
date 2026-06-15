import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const item = await prisma.wishlistItem.findUnique({ where: { id: Number(id) } });
    if (!item) return NextResponse.json({ error: '心愿不存在' }, { status: 404 });
    const done = item.done ? 0 : 1;
    const updated = await prisma.wishlistItem.update({
      where: { id: item.id },
      data: { done, doneAt: done ? new Date() : null }
    });
    return NextResponse.json({ item: updated });
  } catch (error) {
    return jsonError(error);
  }
}
