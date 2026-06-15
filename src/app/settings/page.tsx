import { SettingsPanel } from '@/components/settings-panel';
import { getAuthUserFromCookies } from '@/lib/auth';
import { getSiteSnapshot } from '@/lib/site';
import { canAdmin } from '@/lib/users';

export default async function SettingsPage() {
  const [snapshot, user] = await Promise.all([getSiteSnapshot(), getAuthUserFromCookies()]);
  const scopedSnapshot = canAdmin(user)
    ? snapshot
    : {
        ...snapshot,
        users: [],
        couple: [],
        posts: [],
        postsNextCursor: null,
        events: [],
        wishlist: [],
        messages: [],
        counts: { posts: 0, events: 0, wishlist: 0, messages: 0, likes: 0, stories: 0 }
      };

  return <SettingsPanel snapshot={scopedSnapshot} />;
}
