'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  avatarImage: string;
  partnerId?: number | null;
  roleKey: string;
  status?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
};

type SessionState = {
  user: SessionUser | null;
  users: SessionUser[];
  couple: SessionUser[];
  partner: SessionUser | null;
  partnerCandidates: SessionUser[];
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [partner, setPartner] = useState<SessionUser | null>(null);
  const [partnerCandidates, setPartnerCandidates] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/auth/me/', { cache: 'no-store' });
    const data = await res.json();
    setUser(data.user || null);
    setUsers(data.users || data.couple || []);
    setPartner(data.partner || null);
    setPartnerCandidates(data.partnerCandidates || data.partner_candidates || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const value = useMemo(
    () => ({ user, users, couple: users, partner, partnerCandidates, loading, refresh, setUser }),
    [user, users, partner, partnerCandidates, loading, refresh]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
