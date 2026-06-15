import type { Prisma } from '@prisma/client';
import { publicUploadUrl } from '@/lib/uploads';
import { canAdmin, publicUserProfile, publicUserSelect } from '@/lib/users';

export const postInclude = {
  author: { select: publicUserSelect },
  images: { orderBy: [{ sort: 'asc' as const }, { id: 'asc' as const }] },
  likes: { include: { user: { select: publicUserSelect } }, orderBy: { createdAt: 'asc' as const } }
} satisfies Prisma.PostInclude;

type HydratedPost = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export function serializePost(post: HydratedPost, currentUserId?: number | null) {
  const author = { ...publicUserProfile(post.author), avatarImage: publicUploadUrl(post.author.avatarImage) };
  return {
    ...post,
    author,
    video: publicUploadUrl(post.video),
    images: post.images.map((image) => ({ ...image, path: publicUploadUrl(image.path) })),
    likes: post.likes.map((like) => ({ ...publicUserProfile(like.user), avatarImage: publicUploadUrl(like.user.avatarImage) })),
    likedByMe: !!currentUserId && post.likes.some((like) => like.userId === currentUserId)
  };
}

export function canManagePost(post: { authorId: number }, user?: { id: number; roleKey?: string | null } | null) {
  return canAdmin(user) || (!!user && post.authorId === user.id);
}
