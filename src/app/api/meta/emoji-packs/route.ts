import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { getSettingMap, normalizeEmojiPacks, readEmojiPacksFromMap, setSetting } from '@/lib/settings';
import { jsonError } from '@/lib/responses';

export async function GET() {
  const settings = await getSettingMap();
  return NextResponse.json({ packs: readEmojiPacksFromMap(settings) });
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    let raw = body.packs;
    if (typeof body.json === 'string') raw = JSON.parse(body.json);
    const packs = normalizeEmojiPacks(raw);
    await setSetting('emoji_packs_json', JSON.stringify(packs));
    return NextResponse.json({ packs });
  } catch (error) {
    return jsonError(error, '表情包 JSON 格式不正确');
  }
}
