import MiniSearch, { type SearchResult as MiniSearchResult } from 'minisearch';
import { NextResponse } from 'next/server';
import { blogPostInclude, publicBlogWhere, serializeBlogPost } from '@/lib/blog';
import { getAuthUserFromRequest } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import { searchExcerpt } from '@/lib/text';
import { publicUploadUrl } from '@/lib/uploads';
import { canAdmin } from '@/lib/users';

export const runtime = 'nodejs';

type SearchItem = {
  id: string;
  type: 'essay' | 'story' | 'timeline' | 'wishlist' | 'secret';
  label: string;
  title: string;
  excerpt: string;
  content: string;
  href: string;
  date: string;
  image?: string;
  tags?: string[];
};

type IndexedSearchItem = SearchItem & {
  tagsText: string;
};

type SearchUser = { id: number; roleKey?: string | null } | null;

type SearchIndex = {
  items: SearchItem[];
  miniSearch: MiniSearch<IndexedSearchItem>;
  expiresAt: number;
};

const SEARCH_SOURCE_LIMIT = 500;
const SEARCH_RESULT_LIMIT = 18;
const SEARCH_CACHE_TTL_MS = 30_000;
const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const SEARCH_SEGMENT_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[\p{Letter}\p{Number}]+/gu;
const searchIndexCache = new Map<string, SearchIndex>();

const searchPostInclude = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      avatarImage: true,
      partnerId: true,
      roleKey: true,
      createdAt: true
    }
  },
  images: {
    orderBy: [{ sort: 'asc' as const }, { id: 'asc' as const }],
    select: { id: true, path: true }
  }
};

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens.filter(Boolean)));
}

function searchSegments(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().match(SEARCH_SEGMENT_PATTERN) || [];
}

function cjkNgrams(value: string, minSize: number, maxSize: number) {
  const chars = Array.from(value);
  const tokens: string[] = [];

  for (let size = minSize; size <= maxSize; size += 1) {
    if (chars.length < size) continue;
    for (let index = 0; index <= chars.length - size; index += 1) {
      tokens.push(chars.slice(index, index + size).join(''));
    }
  }

  return tokens;
}

function tokenizeIndexText(value: string) {
  return uniqueTokens(
    searchSegments(value).flatMap((segment) => {
      if (!CJK_PATTERN.test(segment)) return [segment];
      return cjkNgrams(segment, 1, 3);
    })
  );
}

function tokenizeQueryText(value: string) {
  return uniqueTokens(
    searchSegments(value).flatMap((segment) => {
      if (!CJK_PATTERN.test(segment)) return [segment];
      const chars = Array.from(segment);
      return chars.length <= 3 ? [segment] : cjkNgrams(segment, 2, 3);
    })
  );
}

function toIndexedItems(items: SearchItem[]): IndexedSearchItem[] {
  return items.map((item) => ({
    ...item,
    tagsText: item.tags?.join(' ') || ''
  }));
}

function toSearchItem(result: MiniSearchResult): SearchItem {
  return {
    id: String(result.id),
    type: result.type,
    label: result.label,
    title: result.title,
    excerpt: result.excerpt,
    content: result.content || '',
    href: result.href,
    date: result.date,
    image: result.image,
    tags: Array.isArray(result.tags) ? result.tags : undefined
  };
}

function createMiniSearch() {
  return new MiniSearch<IndexedSearchItem>({
    fields: ['label', 'title', 'excerpt', 'content', 'tagsText', 'date'],
    storeFields: ['type', 'label', 'title', 'excerpt', 'content', 'href', 'date', 'image', 'tags'],
    tokenize: tokenizeIndexText,
    processTerm: (term) => term.toLocaleLowerCase(),
    searchOptions: {
      boost: {
        title: 4,
        label: 3.2,
        tagsText: 2.4,
        excerpt: 1.5,
        content: 1,
        date: 0.5
      },
      combineWith: 'AND',
      prefix: (term) => !CJK_PATTERN.test(term) && term.length >= 2,
      fuzzy: (term) => (!CJK_PATTERN.test(term) && term.length >= 5 ? 0.2 : false),
      maxFuzzy: 1,
      weights: {
        fuzzy: 0.34,
        prefix: 0.72
      }
    }
  });
}

function createSearchIndex(items: SearchItem[]): SearchIndex {
  const miniSearch = createMiniSearch();
  miniSearch.addAll(toIndexedItems(items));
  return {
    items,
    miniSearch,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS
  };
}

function searchCacheKey(user: SearchUser) {
  if (!user) return 'anonymous';
  return canAdmin(user) ? 'admin' : `user:${user.id}`;
}

async function getSearchIndex(user: SearchUser) {
  const key = searchCacheKey(user);
  const cached = searchIndexCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const next = createSearchIndex(await loadSearchItems(user));
  searchIndexCache.set(key, next);
  return next;
}

function searchItems(index: SearchIndex, q: string) {
  const queryTokens = tokenizeQueryText(q);
  if (!queryTokens.length) return index.items;
  return index.miniSearch.search(q, { tokenize: tokenizeQueryText }).map(toSearchItem);
}

async function loadSearchItems(user: SearchUser) {
  const [posts, stories, events, wishlist, messages] = await Promise.all([
    prisma.post.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SEARCH_SOURCE_LIMIT,
      include: searchPostInclude
    }),
    prisma.blogPost.findMany({
      where: publicBlogWhere(user),
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: SEARCH_SOURCE_LIMIT,
      include: blogPostInclude
    }),
    prisma.event.findMany({
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: SEARCH_SOURCE_LIMIT
    }),
    prisma.wishlistItem.findMany({
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: SEARCH_SOURCE_LIMIT
    }),
    user
      ? prisma.message.findMany({
          where: canAdmin(user) ? undefined : { userId: user.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: SEARCH_SOURCE_LIMIT,
          include: { user: true }
        })
      : Promise.resolve([])
  ]);

  const essayItems: SearchItem[] = posts.map((post) => {
    return {
      id: `essay-${post.id}`,
      type: 'essay',
      label: '说说',
      title: post.mood || post.author.displayName || '说说',
      excerpt: searchExcerpt(post.content, post.images.length ? `${post.images.length} 张图片` : '说说内容'),
      content: `${post.content} ${post.mood} ${post.author.displayName}`,
      href: `/essay/#post-${post.id}`,
      date: formatDateTime(post.createdAt),
      image: publicUploadUrl(post.images[0]?.path)
    };
  });

  const storyItems: SearchItem[] = stories.map((story) => {
    const item = serializeBlogPost(story);
    return {
      id: `story-${item.id}`,
      type: 'story',
      label: '故事',
      title: item.title,
      excerpt: searchExcerpt(item.excerpt || item.content),
      content: `${item.title} ${item.excerpt} ${item.content} ${item.tags.join(' ')} ${item.author.displayName}`,
      href: `/stories/${item.slug}/`,
      date: formatDateTime(item.publishedAt || item.createdAt),
      image: item.coverImage,
      tags: item.tags
    };
  });

  const eventItems: SearchItem[] = events.map((event) => ({
    id: `timeline-${event.id}`,
    type: 'timeline',
    label: '时光',
    title: event.title,
    excerpt: searchExcerpt(event.description, event.date),
    content: `${event.title} ${event.description} ${event.date}`,
    href: '/timeline/',
    date: formatDate(event.date),
    image: publicUploadUrl(event.image)
  }));

  const wishItems: SearchItem[] = wishlist.map((item) => ({
    id: `wishlist-${item.id}`,
    type: 'wishlist',
    label: item.done ? '已完成心愿' : '心愿',
    title: item.content,
    excerpt: item.done ? '这个心愿已经完成' : '还在计划中的心愿',
    content: item.content,
    href: '/wishlist/',
    date: formatDateTime(item.displayAt || item.createdAt)
  }));

  const secretItems: SearchItem[] = messages.map((message) => ({
    id: `secret-${message.id}`,
    type: 'secret',
    label: '悄悄话',
    title: message.user.displayName,
    excerpt: searchExcerpt(message.content),
    content: `${message.content} ${message.user.displayName}`,
    href: '/secret/',
    date: formatDateTime(message.createdAt)
  }));

  return [...essayItems, ...storyItems, ...eventItems, ...wishItems, ...secretItems];
}

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 80);
  const index = await getSearchIndex(user);
  const results = q ? searchItems(index, q) : index.items;

  return NextResponse.json({
    results: results.slice(0, SEARCH_RESULT_LIMIT),
    total: results.length,
    engine: 'MiniSearch'
  });
}
