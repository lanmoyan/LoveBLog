import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAuthIntegrationSettings } from '@/lib/auth-settings';

export function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 180) : '';
}

function verificationSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is required for email verification.');
  }
  return 'love-next-email-build-secret';
}

function hashCode(email: string, code: string) {
  return crypto
    .createHmac('sha256', verificationSecret())
    .update(`${email}:${code}`)
    .digest('hex');
}

export async function registrationEmailEnabled() {
  const { email } = await getAuthIntegrationSettings();
  return email.registrationEmailEnabled;
}

export async function sendRegistrationCode(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('请输入正确的邮箱地址');

  const { email: settings } = await getAuthIntegrationSettings();
  if (!settings.registrationEmailEnabled) throw new Error('邮箱验证码注册未开启');
  if (!settings.smtpHost || !settings.smtpFrom || !settings.smtpPass) {
    throw new Error('管理员还没有配置完整的 SMTP 邮箱');
  }

  const recent = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      purpose: 'register',
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - 60_000) }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (recent) throw new Error('验证码刚刚发送过，请稍后再试');

  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.emailVerificationCode.create({
    data: {
      email,
      codeHash: hashCode(email, code),
      purpose: 'register',
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }
  });

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort || 465),
    secure: settings.smtpSecure,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass } : undefined
  });

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: email,
    subject: '注册验证码',
    text: `你的注册验证码是：${code}。验证码 10 分钟内有效。`,
    html: `<p>你的注册验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>验证码 10 分钟内有效。</p>`
  });

  return { email };
}

export async function verifyRegistrationCode(rawEmail: unknown, rawCode: unknown) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return false;

  const row = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      purpose: 'register',
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!row || row.codeHash !== hashCode(email, code)) return false;

  await prisma.emailVerificationCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() }
  });
  return true;
}
