import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const postId = Number(id);
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    const existing = await prisma.like.findUnique({ where: { postId_userId: { postId, userId: user.id } } });
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }
    await prisma.like.create({ data: { postId, userId: user.id } });
    return NextResponse.json({ liked: true });
  } catch (error) {
    return jsonError(error);
  }
}
