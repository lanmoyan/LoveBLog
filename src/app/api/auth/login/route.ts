import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isUserActive, publicUserSelect } from '@/lib/users';

const LoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: '账号或密码不正确' }, { status: 401 });
  }
  if (!isUserActive(user)) {
    return NextResponse.json({ error: '账号已被封禁，请联系管理员' }, { status: 403 });
  }

  const publicUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect
  });
  return NextResponse.json({
    user: publicUser,
    message: 'Credentials verified. Use NextAuth credentials signIn to create a session.'
  });
}
