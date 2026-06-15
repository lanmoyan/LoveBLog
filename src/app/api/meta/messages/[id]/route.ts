import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { canAdmin } from '@/lib/users';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const message = await prisma.message.findUnique({ where: { id: Number(id) } });
    if (!message) return NextResponse.json({ error: '悄悄话不存在' }, { status: 404 });
    if (!canAdmin(user) && message.userId !== user.id) return NextResponse.json({ error: '只能删除自己的悄悄话' }, { status: 403 });
    await prisma.message.delete({ where: { id: message.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
