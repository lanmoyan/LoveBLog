import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManagePost, postInclude, serializePost } from '@/lib/posts';
import { jsonError } from '@/lib/responses';
import { removeUpload } from '@/lib/upload-storage';

type Context = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function enabled(value: unknown) {
  if (typeof value === 'boolean') return value;
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const current = await prisma.post.findUnique({ where: { id: Number(id) }, include: { images: true } });
    if (!current) return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    if (!canManagePost(current, user)) return NextResponse.json({ error: '只能编辑自己的动态' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const imageId = positiveId(body.imageId || body.image_id);
    const removeVideo = enabled(body.video || body.removeVideo || body.remove_video);
    if (!imageId && !removeVideo) return NextResponse.json({ error: '请选择要删除的媒体' }, { status: 400 });

    const imageToRemove = imageId ? current.images.find((image) => image.id === imageId) : null;
    if (imageId && !imageToRemove) return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    if (removeVideo && !current.video) return NextResponse.json({ error: '视频不存在' }, { status: 404 });

    const nextImageCount = current.images.length - (imageToRemove ? 1 : 0);
    const nextVideo = removeVideo ? '' : current.video;
    if (!current.content.trim() && nextImageCount === 0 && !nextVideo) {
      return NextResponse.json({ error: '说说不能为空' }, { status: 400 });
    }

    const post = await prisma.$transaction(async (tx) => {
      if (imageToRemove) {
        await tx.postImage.delete({ where: { id: imageToRemove.id } });
      }
      if (removeVideo) {
        return tx.post.update({
          where: { id: current.id },
          data: { video: '' },
          include: postInclude
        });
      }
      return tx.post.findUniqueOrThrow({ where: { id: current.id }, include: postInclude });
    });

    if (imageToRemove) await removeUpload(imageToRemove.path);
    if (removeVideo) await removeUpload(current.video);
    return NextResponse.json({ post: serializePost(post, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}
