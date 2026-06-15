import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { jsonError } from '@/lib/responses';
import { setSetting } from '@/lib/settings';
import { saveUploadedFile } from '@/lib/upload-storage';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择站点图标文件' }, { status: 400 });

    const siteIcon = await saveUploadedFile(file, 'site-icon', { icon: true, maxBytes: 2 * 1024 * 1024 });
    await setSetting('site_icon', siteIcon);

    return NextResponse.json({ siteIcon }, { status: 201 });
  } catch (error) {
    return jsonError(error, '站点图标上传失败');
  }
}
