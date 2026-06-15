import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicUserSelect } from '@/lib/users';

export async function GET() {
  const rows = await prisma.postImage.findMany({
    orderBy: [{ post: { createdAt: 'desc' } }, { id: 'desc' }],
    include: { post: { include: { author: { select: publicUserSelect } } } }
  });
  return NextResponse.json({
    images: rows.map((row) => ({
      id: row.id,
      path: row.path,
      createdAt: row.post.createdAt,
      author: row.post.author.displayName,
      postId: row.postId
    }))
  });
}
