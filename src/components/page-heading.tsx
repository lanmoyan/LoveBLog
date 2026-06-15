import { pageMeta, type PageKey } from '@/lib/routes';

export function PageHeading({ page }: { page: PageKey }) {
  const meta = pageMeta[page];

  return (
    <header className="view-head">
      <div>
        <p className="page-kicker">{meta.kicker}</p>
        <h1>{meta.title}</h1>
        <p>{meta.subtitle}</p>
      </div>
      <span className="view-chip">{meta.chip}</span>
    </header>
  );
}
