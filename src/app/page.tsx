import { HomeDashboard } from '@/components/home-dashboard';
import { daysTogether } from '@/lib/dates';
import { getSiteSnapshot } from '@/lib/site';

export default async function HomePage() {
  const snapshot = await getSiteSnapshot();
  const latestPost = snapshot.posts[0];
  const latestEvent = snapshot.events.at(-1);

  return (
    <>
      <HomeDashboard
        days={daysTogether(snapshot.togetherSince) || 0}
        latestPost={latestPost}
        latestEvent={latestEvent}
        snapshot={snapshot}
      />
    </>
  );
}
