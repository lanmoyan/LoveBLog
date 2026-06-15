import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManagePost, postInclude, serializePost } from '@/lib/posts';
import { jsonError } from '@/lib/responses';
import { parseImageUrls } from '@/lib/settings';
import { removeUpload, saveUploadedFile } from '@/lib/upload-storage';

type Context = { params: Promise<{ id: string }> };

export const runtime = 'nodejs';

function parseRemoveImageIds(value: FormDataEntryValue | null | undefined) {
  if (!value) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    }
  } catch {
    // Comma-separated ids are also accepted.
  }
  return raw.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

function isEnabled(value: FormDataEntryValue | null | undefined) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const current = await prisma.post.findUnique({ where: { id: Number(id) }, include: { images: true } });
    if (!current) return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    if (!canManagePost(current, user)) return NextResponse.json({ error: '只能编辑自己的动态' }, { status: 403 });

    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      const body = await request.json().catch(() => ({}));
      const content = String(body.content || '').trim().slice(0, 2000);
      const mood = String(body.mood || '').trim().slice(0, 16);
      if (!content && current.images.length === 0 && !current.video) {
        return NextResponse.json({ error: '动态不能为空' }, { status: 400 });
      }
      const post = await prisma.post.update({ where: { id: current.id }, data: { content, mood }, include: postInclude });
      return NextResponse.json({ post: serializePost(post, user.id) });
    }

    const form = await request.formData();
    const content = String(form.get('content') || '').trim().slice(0, 2000);
    const mood = String(form.get('mood') || '').trim().slice(0, 16);
    const removeImageIds = Array.from(new Set([
      ...parseRemoveImageIds(form.get('removeImageIds')),
      ...parseRemoveImageIds(form.get('remove_image_ids')),
      ...parseRemoveImageIds(form.get('removeImages')),
      ...parseRemoveImageIds(form.get('remove_images'))
    ]));
    const removeVideo = isEnabled(form.get('removeVideo')) || isEnabled(form.get('remove_video'));
    const keptImages = current.images.filter((image) => !removeImageIds.includes(image.id));
    const imageSlots = Math.max(0, 9 - keptImages.length);
    const imageFiles = form
      .getAll('images')
      .filter((item): item is File => item instanceof File && item.size > 0)
      .slice(0, imageSlots);
    const imageUrls = parseImageUrls(form.get('imageUrls') || form.get('image_urls')).slice(
      0,
      Math.max(0, imageSlots - imageFiles.length)
    );
    const videoFile = form.get('video');
    const hasNewVideo = videoFile instanceof File && videoFile.size > 0;
    const nextVideo = hasNewVideo
      ? await saveUploadedFile(videoFile, 'video', { video: true })
      : removeVideo ? '' : current.video;

    if (!content && keptImages.length === 0 && imageFiles.length === 0 && imageUrls.length === 0 && !nextVideo) {
      if (hasNewVideo) await removeUpload(nextVideo);
      return NextResponse.json({ error: '动态不能为空' }, { status: 400 });
    }

    const uploadedImages = [];
    for (const file of imageFiles) uploadedImages.push(await saveUploadedFile(file, 'post'));

    const imagesToRemove = current.images.filter((image) => removeImageIds.includes(image.id));
    const newImagePaths = uploadedImages.concat(imageUrls);
    const maxSort = keptImages.reduce((value, image) => Math.max(value, image.sort), -1);

    const post = await prisma.$transaction(async (tx) => {
      if (imagesToRemove.length) {
        await tx.postImage.deleteMany({
          where: { postId: current.id, id: { in: imagesToRemove.map((image) => image.id) } }
        });
      }

      if (newImagePaths.length) {
        await tx.postImage.createMany({
          data: newImagePaths.map((path, index) => ({
            postId: current.id,
            path,
            sort: maxSort + index + 1
          }))
        });
      }

      return tx.post.update({
        where: { id: current.id },
        data: { content, mood, video: nextVideo },
        include: postInclude
      });
    });
    await Promise.all(imagesToRemove.map((image) => removeUpload(image.path)));
    if ((removeVideo || hasNewVideo) && current.video) await removeUpload(current.video);
    return NextResponse.json({ post: serializePost(post, user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const post = await prisma.post.findUnique({ where: { id: Number(id) }, include: { images: true } });
    if (!post) return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    if (!canManagePost(post, user)) return NextResponse.json({ error: '只能删除自己的动态' }, { status: 403 });
    await prisma.post.delete({ where: { id: post.id } });
    await Promise.all(post.images.map((image) => removeUpload(image.path)));
    await removeUpload(post.video);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
