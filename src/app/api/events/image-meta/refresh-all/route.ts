import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { readLocalImageMeta } from '@/lib/exif';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const rows = await prisma.event.findMany({ where: { image: { not: '' } } });
    let recognized = 0;
    for (const event of rows) {
      const imageMeta = await readLocalImageMeta(event.image);
      if (Object.keys(imageMeta).length) recognized += 1;
      await prisma.event.update({ where: { id: event.id }, data: { imageMeta: JSON.stringify(imageMeta) } });
    }
    return NextResponse.json({ ok: true, updated: rows.length, recognized });
  } catch (error) {
    return jsonError(error);
  }
}
