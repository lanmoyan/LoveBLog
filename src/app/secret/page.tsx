import { PageHeading } from '@/components/page-heading';
import { SecretNotes } from '@/components/secret-notes';

export default async function SecretPage() {
  return (
    <>
      <PageHeading page="secret" />
      <SecretNotes />
    </>
  );
}
