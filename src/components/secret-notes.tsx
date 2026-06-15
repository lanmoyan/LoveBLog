'use client';

import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/session-provider';
import { formatDateTime } from '@/lib/dates';

export function SecretNotes() {
  const { user } = useSession();
  const [messages, setMessages] = useState<any[]>([]);

  async function load() {
    if (!user) return setMessages([]);
    const res = await fetch('/api/meta/messages/', { cache: 'no-store' });
    if (res.ok) setMessages((await res.json()).messages || []);
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  if (!user) return <div className="empty-state"><Lock size={22} /> 登录后查看悄悄话。</div>;

  return (
    <section className="secret-page">
      {messages.length ? (
        <div className="sticky-grid">
          {messages.map((message) => (
            <article key={message.id} className="sticky-note" style={{ background: message.color }}>
              <p>{message.content}</p>
              <time>{message.user.displayName} · {formatDateTime(message.createdAt)}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">还没有悄悄话。</div>
      )}
    </section>
  );
}
