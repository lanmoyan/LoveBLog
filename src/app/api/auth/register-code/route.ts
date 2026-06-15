import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRegistrationCode } from '@/lib/registration-email';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return NextResponse.json({ error: '首次管理员注册不需要邮箱验证码' }, { status: 400 });
    }
    const result = await sendRegistrationCode(body.email);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '验证码发送失败' }, { status: 400 });
  }
}
