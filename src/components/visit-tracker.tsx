'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function sessionId() {
  const key = 'love-next-visit-session';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(key, next);
  return next;
}

function screenLabel() {
  return `${window.innerWidth}x${window.innerHeight}`;
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const startedAt = performance.now();
    const currentPath = `${pathname || '/'}${window.location.search || ''}`;
    const basePayload = {
      sessionId: sessionId(),
      path: currentPath,
      title: document.title,
      referrer: document.referrer,
      screen: screenLabel()
    };
    let closed = false;

    fetch('/api/meta/visit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload)
    }).catch(() => {});

    const closeVisit = () => {
      if (closed) return;
      closed = true;
      const payload = {
        ...basePayload,
        title: document.title,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt))
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/meta/visit/', new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch('/api/meta/visit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    };

    window.addEventListener('pagehide', closeVisit);
    return () => {
      closeVisit();
      window.removeEventListener('pagehide', closeVisit);
    };
  }, [pathname]);

  return null;
}
