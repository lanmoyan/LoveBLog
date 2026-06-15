import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { publicUserSelect } from '@/lib/users';

export const runtime = 'nodejs';

const PartnerSchema = z.object({
  partnerId: z.coerce.number().int().positive().optional(),
  partner_id: z.coerce.number().int().positive().optional()
});

async function sessionPayload(userId: number) {
  const [user, users] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect }),
    prisma.user.findMany({ orderBy: { id: 'asc' }, select: publicUserSelect })
  ]);
  const partner = user.partnerId ? users.find((item) => item.id === user.partnerId) || null : null;
  const couple = partner ? [user, partner] : [user];
  const partnerCandidates = users.filter((item) => {
    if (item.id === user.id) return false;
    return !item.partnerId || item.partnerId === user.id;
  });

  return { user, users: couple, couple, partner, partnerCandidates };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const parsed = PartnerSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '请选择要绑定的情侣账号' }, { status: 400 });

    const partnerId = parsed.data.partnerId || parsed.data.partner_id;
    if (!partnerId) return NextResponse.json({ error: '请选择要绑定的情侣账号' }, { status: 400 });
    if (partnerId === user.id) return NextResponse.json({ error: '不能绑定自己的账号' }, { status: 400 });

    const [current, partner] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { id: true, partnerId: true } }),
      prisma.user.findUnique({ where: { id: partnerId }, select: publicUserSelect })
    ]);
    if (!current) return NextResponse.json({ error: '当前账号不存在' }, { status: 404 });
    if (!partner) return NextResponse.json({ error: '情侣账号不存在' }, { status: 404 });
    if (current.partnerId && current.partnerId !== partner.id) {
      return NextResponse.json({ error: '请先解绑当前情侣账号' }, { status: 400 });
    }
    if (partner.partnerId && partner.partnerId !== user.id) {
      return NextResponse.json({ error: '这个账号已经绑定了其他情侣账号' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { partnerId: partner.id } }),
      prisma.user.update({ where: { id: partner.id }, data: { partnerId: user.id } })
    ]);

    return NextResponse.json(await sessionPayload(user.id));
  } catch (error) {
    return jsonError(error, '情侣账号绑定失败');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, partnerId: true } });
    if (!current?.partnerId) return NextResponse.json(await sessionPayload(user.id));

    await prisma.user.updateMany({
      where: { id: { in: [current.id, current.partnerId] } },
      data: { partnerId: null }
    });

    return NextResponse.json(await sessionPayload(user.id));
  } catch (error) {
    return jsonError(error, '情侣账号解绑失败');
  }
}
