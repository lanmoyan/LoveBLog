import type { BlogPost, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publicUploadUrl } from '@/lib/uploads';
import { canAdmin, publicUserProfile, publicUserSelect } from '@/lib/users';

export const blogPostInclude = {
  author: { select: publicUserSelect }
} satisfies Prisma.BlogPostInclude;

export type HydratedBlogPost = Prisma.BlogPostGetPayload<{ include: typeof blogPostInclude }>;

export function slugifyTitle(title: string) {
  const ascii = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '-')
    .toLowerCase()
    .slice(0, 60);
  return ascii || `story-${Date.now().toString(36)}`;
}

export async function uniqueSlug(input: string, ignoreId?: number) {
  const base = slugifyTitle(input);
  let slug = base;
  let index = 2;
  while (await prisma.blogPost.findFirst({ where: { slug, id: ignoreId ? { not: ignoreId } : undefined }, select: { id: true } })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

export function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function serializeBlogPost(post: HydratedBlogPost) {
  return {
    ...post,
    coverImage: publicUploadUrl(post.coverImage),
    author: { ...publicUserProfile(post.author), avatarImage: publicUploadUrl(post.author.avatarImage) },
    tags: parseTags(post.tags),
    isDraft: !post.publishedAt
  };
}

export function publicBlogWhere(user?: { id: number; roleKey?: string | null } | null): Prisma.BlogPostWhereInput {
  if (canAdmin(user)) return {};
  const publicWhere: Prisma.BlogPostWhereInput = { publishedAt: { not: null }, visibility: 'public' };
  if (!user) return publicWhere;
  return { OR: [publicWhere, { authorId: user.id }] };
}

export function canReadBlogPost(post: BlogPost, user?: { id: number; roleKey?: string | null } | null) {
  if (post.publishedAt && post.visibility === 'public') return true;
  return canAdmin(user) || (!!user && post.authorId === user.id);
}

export function canManageBlogPost(post: BlogPost, user?: { id: number; roleKey?: string | null } | null) {
  return canAdmin(user) || (!!user && post.authorId === user.id);
}

export type SerializedBlogPost = ReturnType<typeof serializeBlogPost>;
