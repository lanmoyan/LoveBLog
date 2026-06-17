'use client';

import Script from 'next/script';
import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const TWIKOO_SCRIPT = 'https://cdn.jsdelivr.net/npm/twikoo@1.7.11/dist/twikoo.min.js';

type TwikooOptions = {
  envId: string;
  el: string | HTMLElement;
  region?: string;
  path?: string;
  lang?: string;
};

declare global {
  interface Window {
    twikoo?: {
      init: (options: TwikooOptions) => void;
    };
  }
}

type TwikooCommentsProps = {
  envId?: string;
  region?: string;
  path?: string;
  title?: string;
  emptyText?: string;
};

export function TwikooComments({
  envId,
  region,
  path,
  title = '评论',
  emptyText = '还没配置Twikoo评论系统。'
}: TwikooCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const cleanEnvId = envId?.trim();
  const cleanRegion = cleanEnvId?.startsWith('http') ? '' : region?.trim();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !cleanEnvId || !window.twikoo) return;

    container.innerHTML = '';
    window.twikoo.init({
      envId: cleanEnvId,
      el: container,
      region: cleanRegion || undefined,
      path: path || window.location.pathname,
      lang: 'zh-CN'
    });
  }, [cleanEnvId, cleanRegion, path, scriptReady]);

  if (!cleanEnvId) {
    return <div className="empty-state twikoo-empty-state">{emptyText}</div>;
  }

  return (
    <section className="twikoo-card">
      <header>
        <div>
          <p className="page-kicker">Twikoo</p>
          <h2><MessageCircle size={22} />{title}</h2>
        </div>
      </header>
      <Script
        src={TWIKOO_SCRIPT}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
        onError={() => setScriptError(true)}
      />
      {scriptError ? <p className="twikoo-error">Twikoo 脚本加载失败，请稍后重试。</p> : null}
      <div ref={containerRef} id="tcomment" />
    </section>
  );
}
