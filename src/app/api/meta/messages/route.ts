import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { canAdmin, publicUserSelect } from '@/lib/users';

const MessageSchema = z.object({
  content: z.string().trim().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#fff4f6')
});

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const scope = (new URL(request.url).searchParams.get('scope') || '').trim().toLowerCase();
    const messages = await prisma.message.findMany({
      where: canAdmin(user) && scope !== 'mine' ? undefined : { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { user: { select: publicUserSelect } }
    });
    return NextResponse.json({ messages });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const parsed = MessageSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '悄悄话内容不正确' }, { status: 400 });
    const duplicate = await prisma.message.findFirst({
      where: { userId: user.id, content: parsed.data.content },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ error: '已存在相同悄悄话，已跳过重复内容' }, { status: 409 });
    }
    const message = await prisma.message.create({
      data: { userId: user.id, ...parsed.data },
      include: { user: { select: publicUserSelect } }
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
