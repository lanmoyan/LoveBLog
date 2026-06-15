import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { jsonError } from '@/lib/responses';
import { saveUploadedFile } from '@/lib/upload-storage';
import { cleanRemoteImageUrl } from '@/lib/uploads';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAuthUser(request);
    const form = await request.formData();
    const url = cleanRemoteImageUrl(form.get('url'));
    if (url) return NextResponse.json({ url }, { status: 201 });

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择图片或填写图片 URL' }, { status: 400 });
    const uploaded = await saveUploadedFile(file, 'upload');

    return NextResponse.json({ url: uploaded }, { status: 201 });
  } catch (error) {
    return jsonError(error, '上传失败');
  }
}
