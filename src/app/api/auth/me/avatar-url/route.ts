import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload } from '@/lib/upload-storage';
import { cleanRemoteImageUrl } from '@/lib/uploads';
import { publicUserSelect } from '@/lib/users';

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const body = await request.json().catch(() => ({}));
    const avatarImage = cleanRemoteImageUrl(body.url);
    if (!avatarImage) return NextResponse.json({ error: '请输入有效的图片 URL' }, { status: 400 });
    const current = await prisma.user.findUnique({ where: { id: user.id } });
    if (current?.avatarImage) await removeUpload(current.avatarImage);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarImage }, select: publicUserSelect });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
