import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserFromRequest, requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { getSetting } from '@/lib/settings';
import { publicUploadUrl } from '@/lib/uploads';
import { publicUserSelect } from '@/lib/users';

const emptyToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(20).optional(),
  avatar: z.string().trim().max(8).optional(),
  password: z.preprocess(emptyToUndefined, z.string().min(4).max(80).optional()),
  securityCode: z.preprocess(emptyToUndefined, z.string().optional())
});

export async function GET(request: Request) {
  const rawUser = await getAuthUserFromRequest(request);
  if (!rawUser) return NextResponse.json({ user: null, users: [], couple: [] });
  const user = { ...rawUser, avatarImage: publicUploadUrl(rawUser.avatarImage) };
  const users = (await prisma.user.findMany({ orderBy: { id: 'asc' }, select: publicUserSelect }))
    .map((item) => ({ ...item, avatarImage: publicUploadUrl(item.avatarImage) }));
  const partner = user.partnerId ? users.find((item) => item.id === user.partnerId) || null : null;
  const couple = partner ? [user, partner] : [user];
  const partnerCandidates = users.filter((item) => {
    if (item.id === user.id) return false;
    return !item.partnerId || item.partnerId === user.id;
  });
  return NextResponse.json({ user, users: couple, couple, partner, partnerCandidates });
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const parsed = ProfileSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '资料格式不正确' }, { status: 400 });

    const data: Record<string, string> = {};
    if (parsed.data.displayName) data.displayName = parsed.data.displayName;
    if (parsed.data.avatar) data.avatar = parsed.data.avatar;
    if (parsed.data.password) {
      const security = await getSetting('security_code', '');
      if (security && !(await bcrypt.compare(parsed.data.securityCode || '', security))) {
        return NextResponse.json({ error: '请输入正确的安全码后再修改密码' }, { status: 403 });
      }
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data, select: publicUserSelect });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
