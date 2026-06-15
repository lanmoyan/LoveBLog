import { prisma } from '@/lib/prisma';
import { parseTags } from '@/lib/blog';
import { postInclude, serializePost } from '@/lib/posts';
import { getSettingMap, normalizeHomeAlbumImages, readEmojiPacksFromMap, readUserRolesFromMap, safeJson, type HomeAlbumImage } from '@/lib/settings';
import { publicUploadUrl } from '@/lib/uploads';
import { publicUserProfile, publicUserSelect } from '@/lib/users';
import { unstable_noStore as noStore } from 'next/cache';
import { cache } from 'react';

export type SiteSnapshot = Awaited<ReturnType<typeof getSiteSnapshot>>;

function footerSettingsFromMap(settings: Map<string, string>) {
  return {
    messageUrl: settings.get('footer_message_url') || '',
    rssUrl: settings.get('footer_rss_url') || '',
    rewardUrl: settings.get('footer_reward_url') || '',
    icpNumber: settings.get('footer_icp_number') || '',
    icpUrl: settings.get('footer_icp_url') || '',
    policeNumber: settings.get('footer_police_number') || '',
    policeUrl: settings.get('footer_police_url') || '',
    uptimeStatusUrl: settings.get('footer_uptime_status_url') || '',
    uptimeStatusPageUrl: settings.get('footer_uptime_status_page_url') || ''
  };
}

async function loadSiteSnapshot() {
  noStore();
  const settings = await getSettingMap();
  const twikooRegion = settings.get('twikoo_region') ?? process.env.NEXT_PUBLIC_TWIKOO_REGION ?? 'ap-shanghai';
  const footer = footerSettingsFromMap(settings);

  try {
    const [users, posts, totalPosts, events, wishlist, likes, messageCount, storyCount, commentCount, guestbookCount, recentComments, recentGuestbook, publicStories] = await Promise.all([
      prisma.user.findMany({ orderBy: { id: 'asc' }, select: publicUserSelect }),
      prisma.post.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 9,
        include: postInclude
      }),
      prisma.post.count(),
      prisma.event.findMany({ orderBy: [{ date: 'asc' }, { id: 'asc' }], take: 50 }),
      prisma.wishlistItem.findMany({ orderBy: [{ done: 'asc' }, { createdAt: 'desc' }], take: 50 }),
      prisma.like.count(),
      prisma.message.count(),
      prisma.blogPost.count({ where: { publishedAt: { not: null }, visibility: 'public' } }),
      prisma.comment.count(),
      prisma.guestbookEntry.count({ where: { approved: 1 } }),
      prisma.comment.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
        include: {
          user: { select: publicUserSelect },
          post: {
            include: {
              author: { select: publicUserSelect }
            }
          }
        }
      }),
      prisma.guestbookEntry.findMany({
        where: { approved: 1 },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8
      }),
      prisma.blogPost.findMany({
        where: { publishedAt: { not: null }, visibility: 'public' },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 160,
        select: {
          id: true,
          slug: true,
          title: true,
          tags: true,
          publishedAt: true,
          createdAt: true
        }
      })
    ]);
    const pagePosts = posts.slice(0, 8);
    const publicUsers = users.map((user) => ({ ...publicUserProfile(user), avatarImage: publicUploadUrl(user.avatarImage) }));
    const couple = publicUsers.filter((user) => user.partnerId || publicUsers.some((item) => item.partnerId === user.id));
    const siteIcon = publicUploadUrl(settings.get('site_icon') || '/site-icon.svg');
    const consoleComments = recentComments.map((comment) => ({
      id: `post-${comment.id}`,
      content: comment.content,
      author: comment.user?.displayName || comment.guestNick || '访客',
      avatar: comment.user?.avatar || '',
      avatarImage: publicUploadUrl(comment.user?.avatarImage || ''),
      date: comment.createdAt,
      href: '/comment/',
      postTitle: comment.post.mood || comment.post.content.slice(0, 32) || comment.post.author.displayName
    })).concat(recentGuestbook.map((entry) => ({
      id: `guest-${entry.id}`,
      content: entry.content,
      author: entry.nickname || '访客',
      avatar: '',
      avatarImage: '',
      date: entry.createdAt,
      href: '/comment/',
      postTitle: '留言评论'
    })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
    const storyTagCounts = new Map<string, number>();
    const storyYearCounts = new Map<string, number>();
    publicStories.forEach((story) => {
      parseTags(story.tags).forEach((tag) => storyTagCounts.set(tag, (storyTagCounts.get(tag) || 0) + 1));
      const year = (story.publishedAt || story.createdAt).getFullYear().toString();
      storyYearCounts.set(year, (storyYearCounts.get(year) || 0) + 1);
    });

    return {
      ready: true,
      title: settings.get('site_title') || process.env.APP_NAME || '我们的小星球',
      siteIcon,
      togetherSince: settings.get('together_since') || '',
      homeAlbumImages: normalizeHomeAlbumImages(safeJson(settings.get('home_album_images'), [])).map((image) => ({
        ...image,
        path: publicUploadUrl(image.path)
      })),
      specialDates: safeJson<Array<{ name: string; date: string; recurring?: boolean }>>(settings.get('special_dates'), []),
      imageMetaEnabled: settings.get('image_meta_enabled') !== '0',
      twikooEnvId: settings.get('twikoo_env_id') || process.env.NEXT_PUBLIC_TWIKOO_ENV_ID || '',
      twikooRegion,
      announcementEnabled: settings.get('announcement_enabled') === '1',
      announcementTitle: settings.get('announcement_title') || '',
      announcementContent: settings.get('announcement_content') || '',
      footer,
      emojiPacks: readEmojiPacksFromMap(settings),
      visits: Number(settings.get('visits') || '0'),
      userRoles: readUserRolesFromMap(settings),
      users: publicUsers,
      couple,
      posts: pagePosts.map((post) => serializePost(post)),
      postsNextCursor: posts.length > 8 ? pagePosts[pagePosts.length - 1]?.id ?? null : null,
      events: events.map((event) => ({ ...event, image: publicUploadUrl(event.image), imageMeta: safeJson(event.imageMeta, {}) })),
      wishlist,
      messages: [],
      console: {
        recentComments: consoleComments,
        tags: Array.from(storyTagCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
          .slice(0, 48),
        years: Array.from(storyYearCounts.entries())
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => Number(b.year) - Number(a.year)),
        randomStories: publicStories.slice(0, 80).map((story) => ({
          id: story.id,
          title: story.title,
          href: `/stories/${story.slug}/`
        })),
        totals: {
          stories: storyCount,
          comments: commentCount + guestbookCount
        }
      },
      counts: {
        posts: totalPosts,
        events: events.length,
        wishlist: wishlist.length,
        messages: messageCount,
        likes,
        stories: storyCount
      }
    };
  } catch {
    return {
      ready: false,
      title: settings.get('site_title') || process.env.APP_NAME || '我们的小星球',
      siteIcon: publicUploadUrl(settings.get('site_icon') || '/site-icon.svg'),
      togetherSince: settings.get('together_since') || '',
      homeAlbumImages: [] as HomeAlbumImage[],
      specialDates: [] as Array<{ name: string; date: string; recurring?: boolean }>,
      imageMetaEnabled: true,
      twikooEnvId: settings.get('twikoo_env_id') || process.env.NEXT_PUBLIC_TWIKOO_ENV_ID || '',
      twikooRegion,
      announcementEnabled: settings.get('announcement_enabled') === '1',
      announcementTitle: settings.get('announcement_title') || '',
      announcementContent: settings.get('announcement_content') || '',
      footer,
      emojiPacks: readEmojiPacksFromMap(settings),
      visits: Number(settings.get('visits') || '0'),
      userRoles: readUserRolesFromMap(settings),
      users: [],
      couple: [],
      posts: [],
      postsNextCursor: null as number | null,
      events: [],
      wishlist: [],
      messages: [],
      console: {
        recentComments: [],
        tags: [],
        years: [],
        randomStories: [],
        totals: { stories: 0, comments: 0 }
      },
      counts: { posts: 0, events: 0, wishlist: 0, messages: 0, likes: 0, stories: 0 }
    };
  }
}

export const getSiteSnapshot = cache(loadSiteSnapshot);
