import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest, requireAuthUser } from '@/lib/auth';
import { lookupRegion, encryptIp, normalizeIp } from '@/lib/ip';
import { canManagePost, hasDuplicatePostContent, postInclude, serializePost } from '@/lib/posts';
import { jsonError } from '@/lib/responses';
import { parseImageUrls } from '@/lib/settings';
import { removeUpload, saveUploadedFile } from '@/lib/upload-storage';
import { publicUploadUrl } from '@/lib/uploads';
import { canAdmin, publicUserProfile, publicUserSelect } from '@/lib/users';

export const runtime = 'nodejs';

const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 80);
  const mood = (searchParams.get('mood') || '').trim().slice(0, 16);
  const authorId = Number(searchParams.get('authorId') || searchParams.get('author_id') || 0);
  const scope = (searchParams.get('scope') || '').trim().toLowerCase();
  const cursor = Number(searchParams.get('cursor') || 0);
  const requestedLimit = Number(searchParams.get('limit') || DEFAULT_PAGE_SIZE);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const where: Prisma.PostWhereInput = {};
  if (q) {
    where.OR = [
      { content: { contains: q } },
      { mood: { contains: q } },
      { author: { displayName: { contains: q } } }
    ];
  }
  if (mood) where.mood = mood;
  if (Number.isInteger(authorId) && authorId > 0) where.authorId = authorId;
  if (scope === 'mine') {
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    where.authorId = user.id;
  } else if (scope === 'all') {
    if (!canAdmin(user)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    cursor: Number.isInteger(cursor) && cursor > 0 ? { id: cursor } : undefined,
    skip: Number.isInteger(cursor) && cursor > 0 ? 1 : 0,
    take: limit + 1,
    include: postInclude
  });
  const pagePosts = posts.slice(0, limit);
  const [authors, moodRows] = await Promise.all([
    prisma.user.findMany({
      where: scope === 'mine' && user ? { id: user.id, posts: { some: {} } } : { posts: { some: {} } },
      orderBy: { id: 'asc' },
      select: publicUserSelect
    }),
    prisma.post.findMany({
      distinct: ['mood'],
      where: { ...(scope === 'mine' && user ? { authorId: user.id } : {}), mood: { not: '' } },
      orderBy: { mood: 'asc' },
      select: { mood: true }
    })
  ]);
  return NextResponse.json({
    posts: pagePosts.map((post) => serializePost(post, user?.id)),
    nextCursor: posts.length > limit ? pagePosts[pagePosts.length - 1]?.id ?? null : null,
    filters: {
      authors: authors.map((author) => ({ ...publicUserProfile(author), avatarImage: publicUploadUrl(author.avatarImage) })),
      moods: moodRows.map((item) => item.mood).filter(Boolean)
    }
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const form = await request.formData();
    const content = String(form.get('content') || '').trim().slice(0, 2000);
    const mood = String(form.get('mood') || '').trim().slice(0, 16);
    const imageFiles = form.getAll('images').filter((item): item is File => item instanceof File && item.size > 0).slice(0, 9);
    const imageUrls = parseImageUrls(form.get('imageUrls') || form.get('image_urls')).slice(0, Math.max(0, 9 - imageFiles.length));
    const videoFile = form.get('video');
    const video = videoFile instanceof File && videoFile.size > 0 ? await saveUploadedFile(videoFile, 'video', { video: true }) : '';

    if (!content && !imageFiles.length && !imageUrls.length && !video) {
      return NextResponse.json({ error: '写点什么、选张照片或视频吧' }, { status: 400 });
    }
    if (!imageFiles.length && await hasDuplicatePostContent({ authorId: user.id, content, mood, video, imagePaths: imageUrls })) {
      return NextResponse.json({ error: '已存在相同说说，已跳过重复内容' }, { status: 409 });
    }

    const uploadedImages = [];
    for (const file of imageFiles) uploadedImages.push(await saveUploadedFile(file, 'post'));

    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        content,
        mood,
        video,
        images: {
          create: uploadedImages.concat(imageUrls).map((url, sort) => ({ path: url, sort }))
        }
      },
      include: postInclude
    });
    return NextResponse.json({ post: serializePost(post, user.id) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const id = Number(new URL(request.url).searchParams.get('id'));
    const post = await prisma.post.findUnique({ where: { id }, include: { images: true } });
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
