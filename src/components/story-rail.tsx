'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  BookOpenText,
  ChevronDown,
  Command,
  Heart,
  Hourglass,
  ImageIcon,
  LogIn,
  LogOut,
  MessageCircle,
  PenLine,
  Settings,
  Shuffle,
  Sparkles,
  Target,
  UserRound,
  X
} from 'lucide-react';
import type { FocusEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { brandIcon } from '@/lib/routes';
import { GlobalSearch } from '@/components/global-search';
import type { SiteSnapshot } from '@/lib/site';
import { useSession } from '@/components/session-provider';
import { VisitTracker } from '@/components/visit-tracker';

type ThemeMode = 'light' | 'dark';

const navGroups = [
  {
    key: 'library',
    label: '文库',
    icon: BookOpenText,
    items: [
      { href: '/essay/', label: '说说', icon: PenLine },
      { href: '/stories/', label: '故事', icon: BookOpenText }
    ]
  },
  {
    key: 'memory',
    label: '回忆',
    icon: ImageIcon,
    items: [
      { href: '/timeline/', label: '时光', icon: Hourglass },
      { href: '/album/', label: '相册', icon: ImageIcon }
    ]
  },
  {
    key: 'interaction',
    label: '互动',
    icon: MessageCircle,
    items: [
      { href: '/wishlist/', label: '心愿', icon: Target },
      { href: '/comment/', label: '评论', icon: MessageCircle }
    ]
  },
  {
    key: 'mine',
    label: '我的',
    icon: UserRound,
    items: [
      { href: '/secret/', label: '悄悄话', icon: Heart },
      { href: '/settings/', label: '设置', icon: Settings, auth: true }
    ]
  }
] as const;

function formatShortDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function clampText(value: string, fallback: string) {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  return text.length > 58 ? `${text.slice(0, 58)}...` : text;
}

function formatConsoleNumber(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`;
  return String(value);
}

export function StoryRail({ snapshot }: { snapshot: SiteSnapshot }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh, loading } = useSession();
  const BrandIcon = brandIcon;
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleClosing, setConsoleClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(null);
  const consoleData = snapshot.console;

  const totalStoryYears = useMemo(
    () => consoleData.years.reduce((sum, item) => sum + item.count, 0),
    [consoleData.years]
  );
  const yearTiles = useMemo(() => {
    const items = consoleData.years.slice(0, 7);
    if (consoleData.years.length > 7) {
      const rest = consoleData.years.slice(7).reduce((sum, item) => sum + item.count, 0);
      return items.concat({ year: '更早', count: rest });
    }
    return items;
  }, [consoleData.years]);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem('love-next-theme');
    const preferred: ThemeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const nextTheme: ThemeMode = stored === 'dark' || stored === 'light' ? stored : preferred;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    if (!consoleOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeConsole();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [consoleOpen]);

  function closeConsole() {
    setConsoleClosing(true);
    window.setTimeout(() => {
      setConsoleOpen(false);
      setConsoleClosing(false);
    }, 180);
  }

  function openConsole() {
    setConsoleClosing(false);
    setConsoleOpen(true);
  }

  async function logout() {
    await signOut({ redirect: false });
    await refresh();
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('love-next-theme', nextTheme);
  }

  function randomStory() {
    const stories = consoleData.randomStories;
    if (!stories.length) {
      router.push('/stories/');
      return;
    }
    const story = stories[Math.floor(Math.random() * stories.length)];
    router.push(story.href);
  }

  function activeGroup(items: readonly { href: string }[]) {
    return items.some((item) => pathname.startsWith(item.href));
  }

  function navGroupHandlers(key: string) {
    return {
      onMouseEnter: () => setOpenNavGroup(key),
      onMouseLeave: () => setOpenNavGroup((current) => current === key ? null : current),
      onFocus: () => setOpenNavGroup(key),
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpenNavGroup((current) => current === key ? null : current);
        }
      }
    };
  }

  const consoleGroups = navGroups.map((group) => ({
    key: group.key,
    label: group.label,
    icon: group.icon,
    items: group.items.filter((item) => !('auth' in item) || user)
  }));
  const deviceStats = [
    { key: 'posts', label: '说说', value: snapshot.counts.posts, icon: PenLine },
    { key: 'stories', label: '故事', value: snapshot.counts.stories, icon: BookOpenText },
    { key: 'wishes', label: '心愿', value: snapshot.counts.wishlist, icon: Target },
    { key: 'comments', label: '互动', value: consoleData.totals.comments, icon: MessageCircle }
  ];

  const dashboard = (
    <div
      className={consoleClosing ? 'console-overlay is-closing' : 'console-overlay'}
      role="dialog"
      aria-modal="true"
      aria-label="站点中控台"
      onClick={closeConsole}
    >
      <div className="console-floating-rail" onClick={(event) => event.stopPropagation()}>
        <Link href="/" className="brand" aria-label="返回首页" title="返回首页" onClick={closeConsole}>
          <span className="brand-logo">
            <BrandIcon size={22} strokeWidth={2.4} />
          </span>
          <span className="brand-title">{snapshot.title}</span>
        </Link>

        <nav className="tabs segmented-nav desktop-segmented-nav" aria-label="页面导航">
          {navGroups.map((group) => {
            const groupItems = group.items.filter((item) => !('auth' in item) || user);
            const active = activeGroup(groupItems);
            const open = openNavGroup === group.key;
            return (
              <div key={group.key} className={`nav-group${active ? ' active' : ''}${open ? ' open' : ''}`} {...navGroupHandlers(group.key)}>
                <button type="button" className="nav-group-trigger" aria-haspopup="true" aria-expanded={open}>
                  <span>{group.label}</span>
                </button>
                <div className="nav-dropdown" role="menu">
                  {groupItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="nav-dropdown-item" role="menuitem" onClick={closeConsole}>
                        <span><ItemIcon size={15} /></span>
                        <b>{item.label}</b>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="nav-actions">
          <button className="icon-btn" type="button" onClick={randomStory} title="随机故事" aria-label="随机故事">
            <Shuffle size={16} />
          </button>
          <GlobalSearch />
          <button className="icon-btn console-launch active" type="button" onClick={closeConsole} title="中控台" aria-label="中控台">
            <Command size={17} />
          </button>
        </div>
      </div>

      <section className="site-console liquid-glass-panel" onClick={(event) => event.stopPropagation()}>
        <div className="console-desktop-view">
          <div className="console-grid">
            <section className="console-comments">
              <p className="console-kicker">互动</p>
              <div className="console-section-head">
                <h2>最近评论</h2>
                <Link href="/comment/" onClick={() => setConsoleOpen(false)} aria-label="查看全部评论">
                  <ChevronDown size={16} />
                </Link>
              </div>
              <div className="comment-tile-grid">
                {consoleData.recentComments.length ? consoleData.recentComments.map((comment) => (
                  <Link key={comment.id} className="comment-tile" href={comment.href} onClick={() => setConsoleOpen(false)}>
                    <span className="comment-avatar">
                      {comment.avatarImage ? <img src={comment.avatarImage} alt="" /> : comment.avatar || comment.author.slice(0, 1)}
                    </span>
                    <span className="comment-title-row">
                      <b>{comment.author}</b>
                      <time>{formatShortDate(comment.date)}</time>
                    </span>
                    <span className="comment-copy">{clampText(comment.content, '写下了一条评论')}</span>
                    <small><MessageCircle size={12} />{clampText(comment.postTitle, '说说')}</small>
                  </Link>
                )) : (
                  <div className="console-empty">
                    <MessageCircle size={22} />
                    <span>还没有本地评论</span>
                  </div>
                )}
              </div>
            </section>

            <section className="console-tags">
              <p className="console-kicker">标签</p>
              <h2>寻找感兴趣的领域</h2>
              <div className="tag-cloud">
                {consoleData.tags.length ? consoleData.tags.map((tag) => (
                  <Link key={tag.name} href={`/stories/?tag=${encodeURIComponent(tag.name)}`} onClick={() => setConsoleOpen(false)}>
                    {tag.name}<sup>{tag.count}</sup>
                  </Link>
                )) : (
                  <span className="tag-empty">发布故事后会显示标签</span>
                )}
              </div>
            </section>
          </div>

          <div className="console-year-grid">
            {yearTiles.map((item) => (
              <Link key={item.year} href="/stories/" className="year-stat" onClick={() => setConsoleOpen(false)}>
                <span>{item.year}</span>
                <b>{item.count}<small>篇</small></b>
              </Link>
            ))}
            <Link href="/stories/" className="year-stat total" onClick={() => setConsoleOpen(false)}>
              <span>全部故事</span>
              <b>{totalStoryYears || snapshot.counts.stories}<small>篇</small></b>
            </Link>
          </div>

          <footer className="console-dock">
            <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}>
              <Sparkles size={18} />
            </button>
            <button type="button" onClick={randomStory} aria-label="随机故事">
              <Shuffle size={18} />
            </button>
            <button className="active" type="button" aria-label="中控台">
              <Command size={19} />
            </button>
            <Link href="/comment/" onClick={() => setConsoleOpen(false)} aria-label="评论">
              <MessageCircle size={18} />
            </Link>
            <Link href={user ? '/settings/' : '/login/'} onClick={() => setConsoleOpen(false)} aria-label={user ? '设置' : '登录'}>
              {user ? <Settings size={18} /> : <LogIn size={18} />}
            </Link>
          </footer>
        </div>

        <div className="console-device-view">
          <header className="device-console-head">
            <Link className="device-console-brand" href="/" title="返回首页" onClick={() => setConsoleOpen(false)}>
              <span><BrandIcon size={18} /></span>
              <strong>
                <b>{snapshot.title}</b>
                <small>{snapshot.visits ? `${formatConsoleNumber(snapshot.visits)} 次访问` : '站点中控台'}</small>
              </strong>
            </Link>
            <button className="device-console-close" type="button" aria-label="关闭中控台" onClick={closeConsole}>
              <X size={22} />
            </button>
          </header>

          <section className="device-console-stats" aria-label="站点数据概览">
            {deviceStats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div key={stat.key} className="device-stat-pill">
                  <span><StatIcon size={15} /></span>
                  <b>{formatConsoleNumber(stat.value)}</b>
                  <small>{stat.label}</small>
                </div>
              );
            })}
          </section>

          <section className="device-console-records">
            <header className="device-record-title">
              <div>
                <h2>最近互动记录</h2>
                <p>来自说说与留言数据，点击可跳转源内容</p>
              </div>
              <Link href="/comment/" onClick={() => setConsoleOpen(false)}>全部</Link>
            </header>
            <div className="device-record-head" aria-hidden="true">
              <span>来源</span>
              <span>成员</span>
              <span>日期</span>
              <span>内容</span>
            </div>
            <div className="device-record-list">
              {consoleData.recentComments.length ? consoleData.recentComments.slice(0, 4).map((comment) => (
                <Link key={comment.id} href={comment.href} className="device-record-row" onClick={() => setConsoleOpen(false)}>
                  <span className="device-record-source"><MessageCircle size={14} />{clampText(comment.postTitle, '评论')}</span>
                  <span className="device-record-user">
                    <span className="comment-avatar">
                      {comment.avatarImage ? <img src={comment.avatarImage} alt="" /> : comment.avatar || comment.author.slice(0, 1)}
                    </span>
                    <b>{comment.author}</b>
                  </span>
                  <time>{formatShortDate(comment.date)}</time>
                  <small>{clampText(comment.content, '写下了一条评论')}</small>
                </Link>
              )) : (
                <p className="device-console-empty">还没有本地评论</p>
              )}
            </div>
          </section>

          <nav className="device-console-nav" aria-label="移动端中控台导航">
            {consoleGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <section key={group.key} className="device-nav-group">
                  <h3><GroupIcon size={17} /><span>{group.label}</span></h3>
                  <div className="device-app-grid">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setConsoleOpen(false)}>
                          <span className="device-app-icon"><ItemIcon size={17} /></span>
                          <b>{item.label}</b>
                        </Link>
                      );
                    })}
                    {group.key === 'mine' && !user && (
                      <Link href="/login/" className={loading ? 'disabled' : ''} onClick={() => setConsoleOpen(false)}>
                        <span className="device-app-icon"><LogIn size={17} /></span>
                        <b>登录</b>
                      </Link>
                    )}
                    {group.key === 'mine' && user && (
                      <button type="button" onClick={logout}>
                        <span className="device-app-icon"><LogOut size={17} /></span>
                        <b>退出</b>
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </nav>

          <section className="device-console-index">
            <div className="device-index-title">
              <div>
                <h2>故事索引</h2>
                <p>按标签与年份快速翻找记录</p>
              </div>
              <Link href="/stories/" onClick={() => setConsoleOpen(false)}>故事库</Link>
            </div>
            <div className="device-tag-cloud">
              {consoleData.tags.length ? consoleData.tags.slice(0, 12).map((tag) => (
                <Link key={tag.name} href={`/stories/?tag=${encodeURIComponent(tag.name)}`} onClick={() => setConsoleOpen(false)}>
                  {tag.name}<sup>{tag.count}</sup>
                </Link>
              )) : (
                <span>发布故事后会显示标签</span>
              )}
            </div>
            <div className="device-year-row">
              {yearTiles.slice(0, 3).map((item) => (
                <Link key={item.year} href="/stories/" onClick={() => setConsoleOpen(false)}>
                  <span>{item.year}</span>
                  <b>{item.count}</b>
                </Link>
              ))}
              <Link href="/stories/" className="total" onClick={() => setConsoleOpen(false)}>
                <span>全部</span>
                <b>{totalStoryYears || snapshot.counts.stories}</b>
              </Link>
            </div>
          </section>

          <footer className="device-console-dock">
            <button type="button" onClick={randomStory} aria-label="随机故事"><Shuffle size={17} /></button>
            <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}><Sparkles size={17} /></button>
            <Link href="/comment/" onClick={() => setConsoleOpen(false)} aria-label="评论"><MessageCircle size={17} /></Link>
            <Link href={user ? '/settings/' : '/login/'} onClick={() => setConsoleOpen(false)} aria-label={user ? '设置' : '登录'}>
              {user ? <Settings size={17} /> : <LogIn size={17} />}
            </Link>
          </footer>
        </div>
      </section>
    </div>
  );

  return (
    <header className="story-rail">
      <Link href="/" className="brand" aria-label="返回首页" title="返回首页">
        <span className="brand-logo">
          <BrandIcon size={22} strokeWidth={2.4} />
        </span>
        <span className="brand-title">{snapshot.title}</span>
      </Link>

      <nav className="tabs segmented-nav desktop-segmented-nav" aria-label="页面导航">
        {navGroups.map((group) => {
          const groupItems = group.items.filter((item) => !('auth' in item) || user);
          const active = activeGroup(groupItems);
          const open = openNavGroup === group.key;
          return (
            <div key={group.key} className={`nav-group${active ? ' active' : ''}${open ? ' open' : ''}`} {...navGroupHandlers(group.key)}>
              <button type="button" className="nav-group-trigger" aria-haspopup="true" aria-expanded={open}>
                <span>{group.label}</span>
              </button>
              <div className="nav-dropdown" role="menu">
                {groupItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="nav-dropdown-item" role="menuitem">
                      <span><ItemIcon size={16} /></span>
                      <b>{item.label}</b>
                    </Link>
                  );
                })}
                {group.key === 'mine' && (
                  <>
                    {!user && (
                      <Link href="/login/" className={loading ? 'nav-dropdown-item disabled' : 'nav-dropdown-item'} role="menuitem">
                        <span><LogIn size={16} /></span>
                        <b>登录</b>
                      </Link>
                    )}
                    {user && (
                      <button type="button" className="nav-dropdown-item logout-item" onClick={logout} role="menuitem">
                        <span><LogOut size={16} /></span>
                        <b>退出</b>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="nav-actions">
        <button className="icon-btn" type="button" onClick={randomStory} title="随机故事" aria-label="随机故事">
          <Shuffle size={16} />
        </button>
        <GlobalSearch />
        <button className="icon-btn console-launch" type="button" onClick={openConsole} title="中控台" aria-label="中控台">
          <Command size={17} />
        </button>
      </div>
      {consoleOpen && mounted ? createPortal(dashboard, document.body) : null}
      <VisitTracker />
    </header>
  );
}
