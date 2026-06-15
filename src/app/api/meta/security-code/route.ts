import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { jsonError } from '@/lib/responses';
import { getSetting, setSetting } from '@/lib/settings';

export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    const next = String(body.newCode || body.new_code || '').trim();
    const current = String(body.currentCode || body.current_code || '');
    const existing = await getSetting('security_code', '');
    if (existing && !(await bcrypt.compare(current, existing))) {
      return NextResponse.json({ error: '当前安全码不正确' }, { status: 403 });
    }
    if (next.length < 4) return NextResponse.json({ error: '安全码至少 4 位' }, { status: 400 });
    await setSetting('security_code', await bcrypt.hash(next, 10));
    return NextResponse.json({ ok: true, hasSecurityCode: true });
  } catch (error) {
    return jsonError(error);
  }
}
