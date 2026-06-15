import { StoryBoard } from '@/components/story-board';
import { PageHeading } from '@/components/page-heading';
import { blogPostInclude, publicBlogWhere, serializeBlogPost } from '@/lib/blog';
import { getAuthUserFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type StoriesPageProps = {
  searchParams?: Promise<{ tag?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StoriesPage({ searchParams }: StoriesPageProps) {
  const user = await getAuthUserFromCookies();
  const params = searchParams ? await searchParams : {};
  const tag = (firstParam(params.tag) || '').trim().slice(0, 18);
  const filters: Prisma.BlogPostWhereInput[] = [publicBlogWhere(user)];
  if (tag) filters.push({ tags: { contains: tag } });
  const where: Prisma.BlogPostWhereInput = filters.length > 1 ? { AND: filters } : filters[0];

  const stories = await prisma.blogPost.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: blogPostInclude
  });

  return (
    <>
      <PageHeading page="stories" />
      <StoryBoard initialStories={stories.map(serializeBlogPost)} />
    </>
  );
}
