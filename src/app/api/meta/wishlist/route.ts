import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserFromRequest, requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { canAdmin } from '@/lib/users';

const WishSchema = z.object({
  content: z.string().trim().min(1).max(100),
  displayAt: z.string().optional(),
  noteStyle: z.enum(['paper', 'rose', 'sun', 'mint', 'sky', 'lavender', 'custom', 'random']).default('random'),
  noteColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal(''))
});

const styles = ['paper', 'rose', 'sun', 'mint', 'sky', 'lavender'];

function cleanWish(data: z.infer<typeof WishSchema>) {
  const noteStyle = data.noteStyle === 'random' ? styles[Math.floor(Math.random() * styles.length)] : data.noteStyle;
  const displayAt = data.displayAt ? new Date(data.displayAt) : new Date();
  return {
    content: data.content,
    displayAt: Number.isNaN(displayAt.getTime()) ? new Date() : displayAt,
    noteStyle,
    noteColor: noteStyle === 'custom' ? data.noteColor || '' : '',
    textColor: noteStyle === 'custom' ? data.textColor || '' : ''
  };
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  const scope = (new URL(request.url).searchParams.get('scope') || '').trim().toLowerCase();
  if (scope === 'mine') return NextResponse.json({ items: [] });
  if (scope === 'all' && !canAdmin(user)) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const items = await prisma.wishlistItem.findMany({
    orderBy: [{ done: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = WishSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '心愿内容不正确' }, { status: 400 });
    const duplicate = await prisma.wishlistItem.findFirst({
      where: { content: parsed.data.content },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ error: '已存在相同心愿，已跳过重复内容' }, { status: 409 });
    }
    const item = await prisma.wishlistItem.create({ data: cleanWish(parsed.data) });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
