import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload, saveUploadedFile } from '@/lib/upload-storage';
import { publicUserSelect } from '@/lib/users';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const form = await request.formData();
    const file = form.get('avatarImage') || form.get('avatar_image') || form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择头像图片' }, { status: 400 });
    const current = await prisma.user.findUnique({ where: { id: user.id } });
    const avatarImage = await saveUploadedFile(file, `avatar-${user.id}`, { maxBytes: 5 * 1024 * 1024 });
    if (current?.avatarImage) await removeUpload(current.avatarImage);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarImage }, select: publicUserSelect });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const current = await prisma.user.findUnique({ where: { id: user.id } });
    if (current?.avatarImage) await removeUpload(current.avatarImage);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarImage: '' }, select: publicUserSelect });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
