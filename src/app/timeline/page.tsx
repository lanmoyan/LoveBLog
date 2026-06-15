import { PageHeading } from '@/components/page-heading';
import { TimelineGallery } from '@/components/timeline-gallery';
import { getSiteSnapshot } from '@/lib/site';

export default async function TimelinePage() {
  const snapshot = await getSiteSnapshot();

  return (
    <>
      <PageHeading page="timeline" />
      <TimelineGallery initialEvents={snapshot.events} />
    </>
  );
}
