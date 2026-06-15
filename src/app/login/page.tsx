import { LoginForm } from '@/components/login-form';
import { getSiteSnapshot } from '@/lib/site';

export default async function LoginPage() {
  const snapshot = await getSiteSnapshot();

  return <LoginForm siteIcon={snapshot.siteIcon} title={snapshot.title} />;
}
