import { PageHeading } from '@/components/page-heading';
import { WishlistBoard } from '@/components/wishlist-board';
import { getSiteSnapshot } from '@/lib/site';

export default async function WishlistPage() {
  const snapshot = await getSiteSnapshot();

  return (
    <>
      <PageHeading page="wishlist" />
      <WishlistBoard initialItems={snapshot.wishlist} />
    </>
  );
}
