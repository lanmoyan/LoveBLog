import { NextResponse } from 'next/server';
import { blogPostInclude, canManageBlogPost, serializeBlogPost } from '@/lib/blog';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { removeUpload } from '@/lib/upload-storage';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuthUser(request);
    const { id } = await context.params;
    const story = await prisma.blogPost.findUnique({ where: { id: Number(id) }, include: blogPostInclude });
    if (!story) return NextResponse.json({ error: '故事不存在' }, { status: 404 });
    if (!canManageBlogPost(story, user)) return NextResponse.json({ error: '只能编辑自己的故事' }, { status: 403 });
    if (!story.coverImage) return NextResponse.json({ error: '封面不存在' }, { status: 404 });

    const updatedStory = await prisma.blogPost.update({
      where: { id: story.id },
      data: { coverImage: '' },
      include: blogPostInclude
    });
    await removeUpload(story.coverImage);
    return NextResponse.json({ story: serializeBlogPost(updatedStory) });
  } catch (error) {
    return jsonError(error);
  }
}
