import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { ShellFrame } from '@/components/shell-frame';
import { getSiteSnapshot } from '@/lib/site';

export async function Shell({ children }: { children: ReactNode }) {
  const snapshot = await getSiteSnapshot();

  return (
    <SessionProvider>
      <ShellFrame snapshot={snapshot}>{children}</ShellFrame>
    </SessionProvider>
  );
}
