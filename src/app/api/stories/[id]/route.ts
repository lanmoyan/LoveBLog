import { NextResponse } from 'next/server';
import { z } from 'zod';
import { blogPostInclude, canManageBlogPost, canReadBlogPost, serializeBlogPost, uniqueSlug } from '@/lib/blog';
import { getAuthUserFromRequest, requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload, saveUploadedFile } from '@/lib/upload-storage';
import { cleanRemoteImageUrl } from '@/lib/uploads';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

const StoryUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  excerpt: z.string().trim().max(180).default(''),
  content: z.string().trim().min(1).max(12000),
  slug: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(18)).max(8).default([]),
  visibility: z.enum(['public', 'private']).default('public'),
  pinned: z.boolean().default(false),
  draft: z.boolean().default(false),
  coverImage: z.string().optional(),
  removeCover: z.boolean().default(false)
});

function parseStoryPayload(form: FormData) {
  const rawTags = String(form.get('tags') || '').trim();
  const tags = rawTags
    ? rawTags.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean)
    : [];
  return StoryUpdateSchema.safeParse({
    title: form.get('title'),
    excerpt: form.get('excerpt') || '',
    content: form.get('content'),
    slug: form.get('slug') || undefined,
    tags,
    visibility: form.get('visibility') === 'private' ? 'private' : 'public',
    pinned: form.get('pinned') === '1' || form.get('pinned') === 'true',
    draft: form.get('draft') === '1' || form.get('draft') === 'true',
    coverImage: cleanRemoteImageUrl(form.get('coverImage') || form.get('cover_image')),
    removeCover: form.get('removeCover') === '1' || form.get('remove_cover') === '1'
  });
}

async function findStory(idOrSlug: string) {
  const id = Number(idOrSlug);
  return Number.isInteger(id) && id > 0
    ? prisma.blogPost.findUnique({ where: { id }, include: blogPostInclude })
    : prisma.blogPost.findUnique({ where: { slug: idOrSlug }, include: blogPostInclude });
}

export async function GET(request: Request, context: Context) {
  const user = await getAuthUserFromRequest(request);
  const { id } = await context.params;
  const story = await findStory(id);
  if (!story) return NextResponse.json({ error: '故事不存在' }, { status: 404 });
  if (!canReadBlogPost(story, user)) {
    return NextResponse.json({ error: '故事不存在' }, { status: 404 });
  }
  return NextResponse.json({ story: serializeBlogPost(story) });
}

export async function PUT(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const current = await findStory(id);
    if (!current) return NextResponse.json({ error: '故事不存在' }, { status: 404 });
    if (!canManageBlogPost(current, user)) return NextResponse.json({ error: '只能编辑自己的故事' }, { status: 403 });

    const form = await request.formData();
    const parsed = parseStoryPayload(form);
    if (!parsed.success) return NextResponse.json({ error: '故事内容不完整' }, { status: 400 });
    const duplicate = await prisma.blogPost.findFirst({
      where: {
        authorId: current.authorId,
        title: parsed.data.title,
        content: parsed.data.content,
        id: { not: current.id }
      },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ error: '已存在相同故事，已取消保存' }, { status: 409 });
    }

    let coverImage = current.coverImage;
    const file = form.get('cover');
    if (file instanceof File && file.size > 0) {
      await removeUpload(current.coverImage);
      coverImage = await saveUploadedFile(file, 'story-cover', { maxBytes: 8 * 1024 * 1024 });
    } else if (parsed.data.coverImage) {
      await removeUpload(current.coverImage);
      coverImage = parsed.data.coverImage;
    } else if (parsed.data.removeCover) {
      await removeUpload(current.coverImage);
      coverImage = '';
    }

    const wasPublished = !!current.publishedAt;
    const story = await prisma.blogPost.update({
      where: { id: current.id },
      data: {
        slug: await uniqueSlug(parsed.data.slug || parsed.data.title, current.id),
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        content: parsed.data.content,
        coverImage,
        tags: JSON.stringify(parsed.data.tags),
        visibility: parsed.data.visibility,
        pinned: parsed.data.pinned ? 1 : 0,
        publishedAt: parsed.data.draft ? null : wasPublished ? current.publishedAt : new Date()
      },
      include: blogPostInclude
    });
    return NextResponse.json({ story: serializeBlogPost(story) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const story = await findStory(id);
    if (!story) return NextResponse.json({ error: '故事不存在' }, { status: 404 });
    if (!canManageBlogPost(story, user)) return NextResponse.json({ error: '只能删除自己的故事' }, { status: 403 });
    await prisma.blogPost.delete({ where: { id: story.id } });
    await removeUpload(story.coverImage);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
