import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, registrationEmailEnabled, verifyRegistrationCode } from '@/lib/registration-email';
import { publicUserSelect } from '@/lib/users';

const RegisterSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().trim().min(1).max(20),
  password: z.string().min(6).max(80),
  email: z.string().trim().max(180).optional(),
  code: z.string().trim().max(12).optional()
});

export async function POST(request: Request) {
  const parsed = RegisterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: '请填写 3-32 位账号、昵称和至少 6 位密码' }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  const email = normalizeEmail(parsed.data.email);
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const userCountBeforeRegister = await prisma.user.count();
  const needsEmailCode = userCountBeforeRegister > 0 && await registrationEmailEnabled();
  if (needsEmailCode) {
    if (!email) return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
    if (!await verifyRegistrationCode(email, parsed.data.code)) {
      return NextResponse.json({ error: '邮箱验证码不正确或已过期' }, { status: 400 });
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const user = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { username }, select: { id: true } });
        if (existing) return null;
        return tx.user.create({
          data: {
            username,
            email: email || null,
            displayName: parsed.data.displayName,
            passwordHash,
            roleKey: userCountBeforeRegister === 0 ? 'admin' : 'user',
            lastLoginAt: new Date()
          },
          select: publicUserSelect
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (!user) return NextResponse.json({ error: '账号已被注册' }, { status: 409 });
      return NextResponse.json({ user, firstAdmin: user.roleKey === 'admin' }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: '账号或邮箱已被注册' }, { status: 409 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt === 0) {
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json({ error: '注册冲突，请重试' }, { status: 409 });
}
