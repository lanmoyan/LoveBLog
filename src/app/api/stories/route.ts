import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { blogPostInclude, publicBlogWhere, serializeBlogPost, uniqueSlug } from '@/lib/blog';
import { getAuthUserFromRequest, requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { saveUploadedFile } from '@/lib/upload-storage';
import { cleanRemoteImageUrl } from '@/lib/uploads';

export const runtime = 'nodejs';

const StorySchema = z.object({
  title: z.string().trim().min(1).max(80),
  excerpt: z.string().trim().max(180).default(''),
  content: z.string().trim().min(1).max(12000),
  slug: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(18)).max(8).default([]),
  visibility: z.enum(['public', 'private']).default('public'),
  pinned: z.boolean().default(false),
  draft: z.boolean().default(false),
  coverImage: z.string().optional()
});

function parseStoryPayload(form: FormData) {
  const rawTags = String(form.get('tags') || '').trim();
  const tags = rawTags
    ? rawTags.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean)
    : [];
  return StorySchema.safeParse({
    title: form.get('title'),
    excerpt: form.get('excerpt') || '',
    content: form.get('content'),
    slug: form.get('slug') || undefined,
    tags,
    visibility: form.get('visibility') === 'private' ? 'private' : 'public',
    pinned: form.get('pinned') === '1' || form.get('pinned') === 'true',
    draft: form.get('draft') === '1' || form.get('draft') === 'true',
    coverImage: cleanRemoteImageUrl(form.get('coverImage') || form.get('cover_image'))
  });
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 80);
  const tag = (searchParams.get('tag') || '').trim().slice(0, 18);
  const scope = (searchParams.get('scope') || '').trim().toLowerCase();
  const filters: Prisma.BlogPostWhereInput[] = [];
  if (scope === 'mine') {
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    filters.push({ authorId: user.id });
  } else if (scope === 'all') {
    if (user?.roleKey !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    filters.push({});
  } else {
    filters.push(publicBlogWhere(user));
  }
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q } },
        { excerpt: { contains: q } },
        { content: { contains: q } }
      ]
    });
  }
  if (tag) filters.push({ tags: { contains: tag } });
  const where: Prisma.BlogPostWhereInput = filters.length > 1 ? { AND: filters } : filters[0];

  const stories = await prisma.blogPost.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: blogPostInclude
  });
  return NextResponse.json({ stories: stories.map(serializeBlogPost) });
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const form = await request.formData();
    const parsed = parseStoryPayload(form);
    if (!parsed.success) return NextResponse.json({ error: '故事内容不完整' }, { status: 400 });
    const duplicate = await prisma.blogPost.findFirst({
      where: { authorId: user.id, title: parsed.data.title, content: parsed.data.content },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ error: '已存在相同故事，已跳过重复内容' }, { status: 409 });
    }
    const file = form.get('cover');
    const uploadedCover = file instanceof File && file.size > 0 ? await saveUploadedFile(file, 'story-cover', { maxBytes: 8 * 1024 * 1024 }) : '';
    const coverImage = uploadedCover || parsed.data.coverImage || '';
    const slug = await uniqueSlug(parsed.data.slug || parsed.data.title);
    const story = await prisma.blogPost.create({
      data: {
        authorId: user.id,
        slug,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        content: parsed.data.content,
        coverImage,
        tags: JSON.stringify(parsed.data.tags),
        visibility: parsed.data.visibility,
        pinned: parsed.data.pinned ? 1 : 0,
        publishedAt: parsed.data.draft ? null : new Date()
      },
      include: blogPostInclude
    });
    return NextResponse.json({ story: serializeBlogPost(story) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
