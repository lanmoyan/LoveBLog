export type AdminContentView = 'posts' | 'stories' | 'events' | 'wishlist' | 'messages';

export const emptySelectedIds = (): Record<AdminContentView, number[]> => ({
  posts: [],
  stories: [],
  events: [],
  wishlist: [],
  messages: []
});

export const emptyPostForm = () => ({ content: '', mood: '' });

export function postFormFrom(post: any) {
  return { content: post?.content || '', mood: post?.mood || '' };
}

export const emptyPostMedia = () => ({ images: [], video: '' });

export function postMediaFrom(post: any) {
  return { images: Array.isArray(post?.images) ? post.images : [], video: post?.video || '' };
}

export const emptyStoryForm = () => ({
  title: '',
  excerpt: '',
  content: '',
  tags: '',
  coverImage: '',
  visibility: 'public',
  pinned: false,
  draft: false
});

export function storyFormFrom(story: any) {
  return {
    title: story?.title || '',
    excerpt: story?.excerpt || '',
    content: story?.content || '',
    tags: (story?.tags || []).join(', '),
    coverImage: '',
    visibility: story?.visibility || 'public',
    pinned: !!story?.pinned,
    draft: !!story?.isDraft
  };
}

export const emptyEventForm = () => ({ date: today(), title: '', description: '', imageUrl: '' });

export function eventFormFrom(event: any) {
  return {
    date: event?.date || today(),
    title: event?.title || '',
    description: event?.description || '',
    imageUrl: ''
  };
}

export const emptyWishForm = () => ({
  content: '',
  displayAt: nowLocal(),
  noteStyle: 'random',
  noteColor: '#fff4b8',
  textColor: '#3f382d'
});

export const emptyMessageForm = () => ({ content: '', color: '#fff4f6' });

export const wishStyleLabels = [
  ['random', '随机样式'],
  ['paper', '奶油纸'],
  ['rose', '玫瑰粉'],
  ['sun', '暖阳黄'],
  ['mint', '薄荷绿'],
  ['sky', '天空蓝'],
  ['lavender', '薰衣草'],
  ['custom', '自定义']
] as const;

export const viewCopy: Record<AdminContentView, { title: string; empty: string; add: string; editorAdd: string; editorEdit: string }> = {
  posts: {
    title: '说说管理',
    empty: '还没有说说，点击右上角添加一条新的动态。',
    add: '添加说说',
    editorAdd: '发布说说',
    editorEdit: '编辑说说'
  },
  stories: {
    title: '故事管理',
    empty: '还没有故事，点击右上角添加一篇新的记录。',
    add: '添加故事',
    editorAdd: '写新故事',
    editorEdit: '编辑故事'
  },
  events: {
    title: '时光管理',
    empty: '还没有时光碎片，点击右上角添加第一张照片。',
    add: '添加时光',
    editorAdd: '添加时光',
    editorEdit: '编辑时光'
  },
  wishlist: {
    title: '心愿管理',
    empty: '还没有心愿，点击右上角添加一个想一起完成的事。',
    add: '添加心愿',
    editorAdd: '添加心愿',
    editorEdit: '添加心愿'
  },
  messages: {
    title: '悄悄话管理',
    empty: '还没有悄悄话，点击右上角写下一条只给自己保存的内容。',
    add: '添加悄悄话',
    editorAdd: '添加悄悄话',
    editorEdit: '添加悄悄话'
  }
};

export const today = () => new Date().toISOString().slice(0, 10);

export const nowLocal = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function localDateTime(value: string | Date | null | undefined) {
  if (!value) return nowLocal();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLocal();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function sortEvents(items: any[]) {
  return items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.id || 0) - Number(b.id || 0));
}

export async function jsonBody(res: Response) {
  return res.json().catch(() => ({}));
}

export function imageUrlsFrom(value: any) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.path || item?.url || item?.src || item?.image || '';
    })
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeComparable(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeMediaUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://local.invalid');
    const localPath = url.pathname.startsWith('/api/uploads/') || url.pathname.startsWith('/uploads/') ? url.pathname : '';
    if (localPath) return localPath.replace(/^\/uploads\//, '/api/uploads/');
    return url.origin === 'https://local.invalid' ? url.pathname : url.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

export function mediaValuesFrom(value: any) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues
    .flatMap((item) => {
      if (typeof item === 'string') {
        const raw = item.trim();
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Keep plain newline/comma separated input.
        }
        return raw.split(/\r?\n|,/);
      }
      return [item];
    })
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.path || item?.url || item?.src || item?.image || '';
    })
    .map(normalizeMediaUrl)
    .filter(Boolean)
    .sort();
}

export function contentSignature(view: AdminContentView, item: any) {
  if (!item || typeof item !== 'object') return '';

  if (view === 'posts') {
    const content = normalizeComparable(item.content);
    const mood = normalizeComparable(item.mood).slice(0, 16);
    const images = mediaValuesFrom(item.imageUrls || item.image_urls || item.images).join('|');
    const video = normalizeMediaUrl(item.video || item.videoUrl || item.video_url);
    if (!content && !images && !video) return '';
    return ['posts', content, mood, images, video].join('::');
  }

  if (view === 'stories') {
    const title = normalizeComparable(item.title);
    const content = normalizeComparable(item.content);
    if (!title || !content) return '';
    return ['stories', title, content].join('::');
  }

  if (view === 'events') {
    const date = String(item.date || '').trim().slice(0, 10);
    const title = normalizeComparable(item.title);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return '';
    return ['events', date, title, normalizeComparable(item.description)].join('::');
  }

  if (view === 'wishlist') {
    const content = normalizeComparable(item.content);
    return content ? ['wishlist', content].join('::') : '';
  }

  const content = normalizeComparable(item.content);
  return content ? ['messages', content].join('::') : '';
}

export function itemsFromImport(view: AdminContentView, parsed: any) {
  if (Array.isArray(parsed)) return parsed;
  const candidates = [parsed?.items, parsed?.[view], parsed?.data];
  return candidates.find((item) => Array.isArray(item)) || [];
}

export function buildImportPlan(view: AdminContentView, existingItems: any[], importItems: any[]) {
  const existingSignatures = new Set(existingItems.map((item) => contentSignature(view, item)).filter(Boolean));
  const importSignatures = new Set<string>();
  const nextItems: any[] = [];
  let skippedExisting = 0;
  let skippedRepeated = 0;
  let skippedInvalid = 0;

  for (const item of importItems) {
    const signature = contentSignature(view, item);
    if (!signature) {
      skippedInvalid += 1;
      continue;
    }
    if (existingSignatures.has(signature)) {
      skippedExisting += 1;
      continue;
    }
    if (importSignatures.has(signature)) {
      skippedRepeated += 1;
      continue;
    }
    importSignatures.add(signature);
    nextItems.push(item);
  }

  return { items: nextItems, skippedExisting, skippedRepeated, skippedInvalid };
}

export function duplicateLabel(view: AdminContentView) {
  if (view === 'posts') return '说说';
  if (view === 'stories') return '故事';
  if (view === 'events') return '时光碎片';
  if (view === 'wishlist') return '心愿';
  return '悄悄话';
}
