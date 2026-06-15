import { EssayFeed } from '@/components/essay-feed';
import { PageHeading } from '@/components/page-heading';
import { getSiteSnapshot } from '@/lib/site';

export default async function EssayPage() {
  const snapshot = await getSiteSnapshot();

  return (
    <>
      <PageHeading page="essay" />
      <EssayFeed initialPosts={snapshot.posts} initialNextCursor={snapshot.postsNextCursor} />
    </>
  );
}
