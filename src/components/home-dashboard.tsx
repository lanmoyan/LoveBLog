'use client';

import { BookOpenText, Bot, CalendarHeart, MessageCircle, PenLine, Target } from 'lucide-react';
import Link from 'next/link';
import { imageVariantUrl } from '@/lib/image-variants';
import type { SiteSnapshot } from '@/lib/site';

type Props = {
  snapshot: SiteSnapshot;
  days: number;
  latestPost: SiteSnapshot['posts'][number] | undefined;
  latestEvent: SiteSnapshot['events'][number] | undefined;
};

type SnapshotUser = SiteSnapshot['users'][number];

export function HomeDashboard({ snapshot, days, latestPost, latestEvent }: Props) {
  const admin = snapshot.users.find((item) => item.roleKey === 'admin') || snapshot.users[0];
  const adminPartner = admin
    ? snapshot.users.find((item) => item.id === admin.partnerId || item.partnerId === admin.id)
    : undefined;
  const featuredMembers = [admin, adminPartner].filter(
    (member, index, list): member is SnapshotUser => !!member && list.findIndex((item) => item?.id === member.id) === index
  );
  const featuredIds = new Set(featuredMembers.map((member) => member.id));
  const castMembers = snapshot.users
    .filter((member) => member.roleKey !== 'admin' && !featuredIds.has(member.id))
    .slice(0, 8);

  function avatarNode(member: SnapshotUser | undefined, fallback = '友') {
    if (!member) return <Bot size={24} strokeWidth={2.2} />;
    if (member.avatarImage) return <img src={imageVariantUrl(member.avatarImage, 240)} alt="" loading="lazy" decoding="async" />;
    return <span>{member.avatar || member.displayName.slice(0, 1) || fallback}</span>;
  }

  const cards = [
    {
      href: '/essay/',
      title: '说说',
      copy: latestPost?.content || (latestPost?.video ? '最近保存了一段视频' : '记录今天的小片段'),
      metric: `${snapshot.counts.posts} 条说说`,
      icon: PenLine
    },
    {
      href: '/stories/',
      title: '故事',
      copy: '把每个人的重要经历写成长故事，沉淀成可以反复阅读的章节。',
      metric: `${snapshot.counts.stories || 0} 篇故事`,
      icon: BookOpenText
    },
    {
      href: '/timeline/',
      title: '时光',
      copy: latestEvent?.title || '重要日子会在这里排成时间线。',
      metric: `${snapshot.counts.events} 个节点`,
      icon: CalendarHeart
    },
    {
      href: '/wishlist/',
      title: '心愿',
      copy: `完成 ${snapshot.wishlist.filter((item) => item.done).length} / ${snapshot.counts.wishlist}，继续把想做的事点亮。`,
      metric: `${snapshot.counts.wishlist ? Math.round((snapshot.wishlist.filter((item) => item.done).length / snapshot.counts.wishlist) * 100) : 0}% 已完成`,
      icon: Target
    },
    {
      href: '/comment/',
      title: '留言评论',
      copy: '游客也可以留下评论和祝福，Twikoo 会负责评论提交。',
      metric: snapshot.twikooEnvId ? '评论已开启' : `${snapshot.console.totals.comments} 条互动`,
      icon: MessageCircle
    }
  ];

  return (
    <section className="home-redesign likegirl-home">
      <div className="magazine-hero">
        <div className="magazine-copy">
          <p className="page-kicker">LOVE YOU FOREVER</p>
          <h2>欢迎来到爱情故事站</h2>
          <p>这里保存每位成员的说说、故事、心愿和悄悄话。</p>
          <div className="magazine-stats" aria-label="站点数据">
            <span><b>{days}</b> 天运行</span>
            <span><b>{snapshot.visits}</b> 次访问</span>
            <span><b>{snapshot.counts.stories}</b> 篇故事</span>
          </div>
          <div className="hero-actions">
            <Link className="primary-btn" href="/stories/">读大家的故事</Link>
            <Link className="ghost-btn" href="/comment/">留下祝福</Link>
          </div>
        </div>

        {featuredMembers.length ? (
          <aside className="magazine-featured-couple" aria-label="站主情侣">
            <span>站主情侣</span>
            <div className="magazine-couple-grid">
              {featuredMembers.map((member) => (
                <figure key={member.id} className="portrait-card magazine-couple-card">
                  <div className="portrait-image">{avatarNode(member)}</div>
                  <figcaption>
                    <b>{member.displayName}</b>
                    <small>@{member.username}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </aside>
        ) : null}

        <aside className="magazine-cast" aria-label="普通用户">
          <p>普通用户</p>
          <div className="magazine-cast-grid">
            {castMembers.length ? castMembers.map((member) => (
              <figure key={member.id} className="portrait-card magazine-cast-card">
                <div className="portrait-image">{avatarNode(member)}</div>
                <figcaption>{member.displayName}</figcaption>
              </figure>
            )) : (
              <figure className="portrait-card magazine-cast-card is-empty">
                <div className="portrait-image">{avatarNode(undefined)}</div>
                <figcaption>暂无普通用户</figcaption>
              </figure>
            )}
          </div>
        </aside>
      </div>

      <div className="home-card-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="home-jump-card">
              <span className="home-card-icon"><Icon size={22} /></span>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
              <b>{card.metric}</b>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
