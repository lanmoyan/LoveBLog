'use client';

import type { ReactNode, WheelEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Home,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { StoryRail } from '@/components/story-rail';
import type { SiteSnapshot } from '@/lib/site';

const footerColumns = [
  {
    title: '记录',
    links: [
      { href: '/essay/', label: '说说' },
      { href: '/stories/', label: '爱情博客' },
      { href: '/timeline/', label: '时光碎片' },
      { href: '/album/', label: '相册图库' }
    ]
  },
  {
    title: '互动',
    links: [
      { href: '/wishlist/', label: '心愿清单' },
      { href: '/comment/', label: '留言评论' },
      { href: '/secret/', label: '悄悄话' }
    ]
  },
  {
    title: '管理',
    links: [
      { href: '/settings/', label: '设置工作台' },
      { href: '/login/', label: '账号登录' }
    ]
  }
] as const;

function daysSince(value: string) {
  if (!value) return 0;
  const start = new Date(`${value}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target={isExternalUrl(href) ? '_blank' : undefined} rel={isExternalUrl(href) ? 'noreferrer' : undefined}>
      {children}
    </Link>
  );
}

function PostTicker({ posts }: { posts: SiteSnapshot['posts'] }) {
  const items = useMemo(
    () => posts
      .map((post) => ({
        id: post.id,
        text: String(post.content || post.mood || (post.video ? '最近保存了一段视频' : '写下了一条说说')).replace(/\s+/g, ' ').trim()
      }))
      .filter((post) => post.text),
    [posts]
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % items.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [active, items.length]);

  function switchItem(direction: number) {
    if (items.length < 2) return;
    setActive((current) => (current + direction + items.length) % items.length);
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) < 8 && Math.abs(event.deltaX) < 8) return;
    event.preventDefault();
    switchItem(event.deltaY + event.deltaX > 0 ? 1 : -1);
  }

  if (!items.length) return null;

  const current = items[active];

  return (
    <div className="post-ticker-shell route-transition" onWheel={onWheel}>
      <div className="post-ticker">
        <span className="post-ticker-label"><MessageCircle size={16} /> 最新说说</span>
        <Link className="post-ticker-text" href="/essay/" aria-label="前往说说页面">
          <b key={current.id}>{current.text}</b>
        </Link>
        <Link className="post-ticker-arrow" href="/essay/" aria-label="前往说说页面">
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

function FooterHealth({ enabled, statusPageUrl }: { enabled: boolean; statusPageUrl: string }) {
  const [health, setHealth] = useState({ status: 'unknown', label: '状态检测中' });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch('/api/meta/uptime-status/', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!alive || !data?.configured) return;
        setHealth({ status: String(data.status || 'unknown'), label: String(data.label || '状态检测中') });
      })
      .catch(() => {
        if (alive) setHealth({ status: 'down', label: '站点状态异常' });
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  if (!enabled) return <span className="footer-health-placeholder" aria-hidden="true" />;

  const content = (
    <span className={`footer-health ${health.status}`}>
      <i />
      {health.label}
    </span>
  );

  return statusPageUrl ? <FooterLink href={statusPageUrl}>{content}</FooterLink> : content;
}

function SiteFooter({ snapshot }: { snapshot: SiteSnapshot }) {
  const togetherDays = daysSince(snapshot.togetherSince);
  const contentCount = snapshot.counts.posts + snapshot.counts.stories + snapshot.counts.events + snapshot.counts.wishlist;
  const footer = snapshot.footer;
  const actionLinks = [
    footer.messageUrl ? { href: footer.messageUrl, label: '留言' } : null,
    footer.rssUrl ? { href: footer.rssUrl, label: 'RSS 订阅' } : null,
    footer.rewardUrl ? { href: footer.rewardUrl, label: '打赏' } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;
  const recordLinks = [
    footer.icpNumber ? { href: footer.icpUrl || 'https://beian.miit.gov.cn/', label: footer.icpNumber } : null,
    footer.policeNumber ? { href: footer.policeUrl, label: footer.policeNumber } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <section className="footer-brand-panel">
          <span className="footer-brand-mark">
            <Sparkles size={22} />
          </span>
          <div>
            <h2>{snapshot.title}</h2>
            <p>把说说、照片、故事、心愿和留言都放在同一颗小星球里。</p>
            {recordLinks.length ? (
              <div className="footer-record-links footer-brand-records">
                {recordLinks.map((item) => (
                  <span className="footer-record-item" key={`${item.label}-${item.href || 'plain'}`}>
                    {item.href ? <FooterLink href={item.href}>{item.label}</FooterLink> : <span>{item.label}</span>}
                  </span>
                ))}
              </div>
            ) : null}
            {actionLinks.length ? (
              <nav className="footer-action-links" aria-label="页脚操作入口">
                {actionLinks.map((item) => <FooterLink key={`${item.label}-${item.href}`} href={item.href}>{item.label}</FooterLink>)}
              </nav>
            ) : null}
          </div>
        </section>

        {footerColumns.map((column) => (
          <section key={column.title} className="footer-link-column">
            <h3>{column.title}</h3>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </section>
        ))}

        <section className="footer-status-column">
          <h3>状态</h3>
          <span><b>{compactNumber(togetherDays)}</b> 天运行</span>
          <span><b>{compactNumber(snapshot.visits)}</b> 次访问</span>
          <span><b>{compactNumber(contentCount)}</b> 条记录</span>
          <FooterHealth enabled={Boolean(footer.uptimeStatusUrl)} statusPageUrl={footer.uptimeStatusPageUrl} />
        </section>
      </div>
    </footer>
  );
}

export function ShellFrame({ children, snapshot }: { children: ReactNode; snapshot: SiteSnapshot }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/settings');
  const isLogin = pathname.startsWith('/login');
  const isHome = pathname === '/';
  const isAlbum = pathname.startsWith('/album');

  if (isAdmin) {
    return (
      <div className="admin-shell-root">
        <main className="admin-workspace">{children}</main>
      </div>
    );
  }

  if (isLogin) {
    const year = new Date().getFullYear();

    return (
      <div className="login-shell">
        <header className="login-topbar">
          <Link className="login-shell-brand" href="/" aria-label="返回首页" title="返回首页">
            <span className="login-shell-logo">
              {snapshot.siteIcon ? <img src={snapshot.siteIcon} alt="" /> : <Sparkles size={22} />}
            </span>
            <strong>
              <b>{snapshot.title}</b>
              <small>私密生活记录</small>
            </strong>
          </Link>
          <nav className="login-shell-actions" aria-label="登录页导航">
            <Link href="/"><Home size={16} /><span>首页</span></Link>
          </nav>
        </header>
        <main className="login-shell-main">{children}</main>
        <footer className="login-shell-footer">© {year} {snapshot.title}. All rights reserved.</footer>
      </div>
    );
  }

  if (isAlbum) {
    return (
      <div className="app-shell album-shell album-shell-standalone">
        <main className="workspace album-workspace">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <StoryRail snapshot={snapshot} />
      {isHome ? <PostTicker posts={snapshot.posts} /> : null}
      <main className="workspace">{children}</main>
      <SiteFooter snapshot={snapshot} />
    </div>
  );
}
