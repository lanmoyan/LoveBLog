import { PageHeading } from '@/components/page-heading';
import { TwikooComments } from '@/components/twikoo-comments';
import { getSiteSnapshot } from '@/lib/site';

export default async function CommentPage() {
  const snapshot = await getSiteSnapshot();

  return (
    <>
      <PageHeading page="comment" />
      <section className="comment-page">
        <TwikooComments
          envId={snapshot.twikooEnvId}
          region={snapshot.twikooRegion}
          path="/comment/"
          title="留言评论"
          emptyText="还没配置Twikoo评论系统。"
        />
      </section>
    </>
  );
}
