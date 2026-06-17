'use client';

import {
  CalendarDays,
  Check,
  Download,
  Edit3,
  FileText,
  Heart,
  ImageIcon,
  ListChecks,
  MessageSquare,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  Video,
  X,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppDialogs } from '@/components/app-dialogs';
import { EmojiPicker } from '@/components/emoji-picker';
import { MediaDropzone } from '@/components/media-dropzone';
import { useSession } from '@/components/session-provider';
import { formatDateTime } from '@/lib/dates';
import type { EmojiPack } from '@/lib/settings';

type AdminContentManagerProps = {
  initialPosts: any[];
  initialEvents: any[];
  initialWishlist: any[];
  emojiPacks: EmojiPack[];
  activeView?: AdminContentView;
  canAdmin?: boolean;
  scope?: 'mine' | 'all';
};

export type AdminContentView = 'posts' | 'stories' | 'events' | 'wishlist' | 'messages';

const wishStyleLabels = [
  ['random', '随机样式'],
  ['paper', '奶油纸'],
  ['rose', '玫瑰粉'],
  ['sun', '暖阳黄'],
  ['mint', '薄荷绿'],
  ['sky', '天空蓝'],
  ['lavender', '薰衣草'],
  ['custom', '自定义']
];

const viewCopy: Record<AdminContentView, { title: string; empty: string; add: string; editorAdd: string; editorEdit: string }> = {
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

const today = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function localDateTime(value: string | Date | null | undefined) {
  if (!value) return nowLocal();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLocal();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function sortEvents(items: any[]) {
  return items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.id || 0) - Number(b.id || 0));
}

async function jsonBody(res: Response) {
  return res.json().catch(() => ({}));
}

function imageUrlsFrom(value: any) {
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

function mediaValuesFrom(value: any) {
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
          // keep plain newline/comma separated input
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

function contentSignature(view: AdminContentView, item: any) {
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

function duplicateLabel(view: AdminContentView) {
  if (view === 'posts') return '说说';
  if (view === 'stories') return '故事';
  if (view === 'events') return '时光碎片';
  if (view === 'wishlist') return '心愿';
  return '悄悄话';
}

export function AdminContentManager({ initialPosts, initialEvents, initialWishlist, emojiPacks, activeView = 'posts', canAdmin = false, scope = canAdmin ? 'all' : 'mine' }: AdminContentManagerProps) {
  const router = useRouter();
  const dialogs = useAppDialogs();
  const { user } = useSession();
  const initialScopedPosts = canAdmin ? initialPosts : [];
  const initialScopedEvents = canAdmin ? initialEvents : [];
  const initialScopedWishlist = canAdmin ? initialWishlist : [];
  const [posts, setPosts] = useState(initialScopedPosts);
  const [stories, setStories] = useState<any[]>([]);
  const [events, setEvents] = useState(initialScopedEvents);
  const [wishlist, setWishlist] = useState(initialScopedWishlist);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [postEditingId, setPostEditingId] = useState<number | null>(null);
  const [postForm, setPostForm] = useState({ content: '', mood: '' });
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [postUrls, setPostUrls] = useState('');
  const [postVideo, setPostVideo] = useState<File | null>(null);
  const [postExistingMedia, setPostExistingMedia] = useState<{ images: any[]; video: string }>({ images: [], video: '' });
  const [postConfirmRemoveImageIds, setPostConfirmRemoveImageIds] = useState<number[]>([]);
  const [postConfirmRemoveVideo, setPostConfirmRemoveVideo] = useState(false);
  const [postBusy, setPostBusy] = useState(false);

  const [storyEditingId, setStoryEditingId] = useState<number | null>(null);
  const [storyForm, setStoryForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    tags: '',
    coverImage: '',
    visibility: 'public',
    pinned: false,
    draft: false
  });
  const [storyCover, setStoryCover] = useState<File | null>(null);
  const [storyExistingCover, setStoryExistingCover] = useState('');
  const [storyConfirmRemoveCover, setStoryConfirmRemoveCover] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);

  const [eventEditingId, setEventEditingId] = useState<number | null>(null);
  const [eventForm, setEventForm] = useState({ date: today(), title: '', description: '', imageUrl: '' });
  const [eventFiles, setEventFiles] = useState<File[]>([]);
  const [eventExistingImage, setEventExistingImage] = useState('');
  const [eventConfirmRemoveImage, setEventConfirmRemoveImage] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);

  const [wishForm, setWishForm] = useState({
    content: '',
    displayAt: nowLocal(),
    noteStyle: 'random',
    noteColor: '#fff4b8',
    textColor: '#3f382d'
  });
  const [wishBusy, setWishBusy] = useState(false);

  const [messageForm, setMessageForm] = useState({ content: '', color: '#fff4f6' });
  const [messageBusy, setMessageBusy] = useState(false);
  const [editorView, setEditorView] = useState<AdminContentView | null>(null);
  const [importingView, setImportingView] = useState<AdminContentView | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<AdminContentView, number[]>>({
    posts: [],
    stories: [],
    events: [],
    wishlist: [],
    messages: []
  });

  useEffect(() => {
    setEditorView(null);
    void reloadActiveView(activeView);
  }, [activeView]);

  async function reloadActiveView(view: AdminContentView) {
    setLoading(true);
    try {
      if (view === 'posts') await reloadPosts();
      if (view === 'stories') await reloadStories();
      if (view === 'events') await reloadEvents();
      if (view === 'wishlist') await reloadWishlist();
      if (view === 'messages') await reloadMessages();
    } finally {
      setLoading(false);
    }
  }

  async function reloadPosts() {
    const res = await fetch(`/api/posts/?limit=100&scope=${scope}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setPosts(data.posts || []);
  }

  async function reloadStories() {
    const res = await fetch(`/api/stories/?scope=${scope}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setStories(data.stories || []);
  }

  async function reloadEvents() {
    const res = await fetch(`/api/events/?scope=${scope}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setEvents(data.events || []);
  }

  async function reloadWishlist() {
    const res = await fetch(`/api/meta/wishlist/?scope=${scope}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setWishlist(data.items || []);
  }

  async function reloadMessages() {
    const res = await fetch(`/api/meta/messages/?scope=${scope}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
  }

  function resetPostForm() {
    setPostEditingId(null);
    setPostForm({ content: '', mood: '' });
    setPostFiles([]);
    setPostUrls('');
    setPostVideo(null);
    setPostExistingMedia({ images: [], video: '' });
    setPostConfirmRemoveImageIds([]);
    setPostConfirmRemoveVideo(false);
  }

  function editPost(post: any) {
    setPostEditingId(post.id);
    setPostForm({ content: post.content || '', mood: post.mood || '' });
    setPostFiles([]);
    setPostUrls('');
    setPostVideo(null);
    setPostExistingMedia({ images: Array.isArray(post.images) ? post.images : [], video: post.video || '' });
    setPostConfirmRemoveImageIds([]);
    setPostConfirmRemoveVideo(false);
  }

  async function submitPost() {
    if (!postFiles.length && !postVideo) {
      const images = postExistingMedia.images.concat(mediaValuesFrom(postUrls).map((path) => ({ path })));
      if (findDuplicateItem('posts', { content: postForm.content, mood: postForm.mood, images, video: postExistingMedia.video }, postEditingId)) {
        warnDuplicate('posts');
        return;
      }
    }

    setPostBusy(true);
    try {
      const form = new FormData();
      form.set('content', postForm.content);
      form.set('mood', postForm.mood);
      form.set('imageUrls', postUrls);
      postFiles.forEach((file) => form.append('images', file));
      if (postVideo) form.set('video', postVideo);
      if (postEditingId) {
        const res = await fetch(`/api/posts/${postEditingId}/`, {
          method: 'PUT',
          body: form
        });
        const data = await jsonBody(res);
        if (!res.ok) {
          void dialogs.alert({ message: data.error || '说说保存失败', tone: 'danger' });
          return;
        }
        setPosts((current) => current.map((post) => post.id === postEditingId ? data.post : post));
      } else {
        const res = await fetch('/api/posts/', { method: 'POST', body: form });
        const data = await jsonBody(res);
        if (!res.ok) {
          void dialogs.alert({ message: data.error || '说说发布失败', tone: 'danger' });
          return;
        }
        setPosts((current) => [data.post, ...current]);
      }
      resetPostForm();
      setEditorView(null);
      router.refresh();
    } finally {
      setPostBusy(false);
    }
  }

  async function removePostMedia(options: { imageId?: number; video?: boolean }) {
    if (!postEditingId || postBusy) return;
    setPostBusy(true);
    try {
      const res = await fetch(`/api/posts/${postEditingId}/media/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.video ? { video: true } : { imageId: options.imageId })
      });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '媒体删除失败', tone: 'danger' });
        return;
      }
      setPosts((current) => current.map((post) => post.id === postEditingId ? data.post : post));
      setPostExistingMedia({
        images: Array.isArray(data.post?.images) ? data.post.images : [],
        video: data.post?.video || ''
      });
      if (options.imageId) {
        setPostConfirmRemoveImageIds((current) => current.filter((id) => id !== options.imageId));
      }
      if (options.video) setPostConfirmRemoveVideo(false);
      router.refresh();
    } finally {
      setPostBusy(false);
    }
  }

  async function deletePost(post: any, ask = true) {
    if (ask && !(await dialogs.confirm({
      title: '删除说说',
      message: '确定删除这条说说吗？删除后无法恢复。',
      confirmText: '删除',
      tone: 'danger'
    }))) return false;
    const res = await fetch(`/api/posts/${post.id}/`, { method: 'DELETE' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '说说删除失败', tone: 'danger' });
      return false;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
    setSelectedIds((current) => ({ ...current, posts: current.posts.filter((id) => id !== post.id) }));
    if (postEditingId === post.id) resetPostForm();
    router.refresh();
    return true;
  }

  function resetStoryForm() {
    setStoryEditingId(null);
    setStoryForm({
      title: '',
      excerpt: '',
      content: '',
      tags: '',
      coverImage: '',
      visibility: 'public',
      pinned: false,
      draft: false
    });
    setStoryCover(null);
    setStoryExistingCover('');
    setStoryConfirmRemoveCover(false);
  }

  function editStory(story: any) {
    setStoryEditingId(story.id);
    setStoryForm({
      title: story.title || '',
      excerpt: story.excerpt || '',
      content: story.content || '',
      tags: (story.tags || []).join(', '),
      coverImage: '',
      visibility: story.visibility || 'public',
      pinned: !!story.pinned,
      draft: !!story.isDraft
    });
    setStoryCover(null);
    setStoryExistingCover(story.coverImage || '');
    setStoryConfirmRemoveCover(false);
  }

  async function submitStory() {
    if (findDuplicateItem('stories', storyForm, storyEditingId)) {
      warnDuplicate('stories');
      return;
    }

    setStoryBusy(true);
    try {
      const form = new FormData();
      form.set('title', storyForm.title);
      form.set('excerpt', storyForm.excerpt);
      form.set('content', storyForm.content);
      form.set('tags', storyForm.tags);
      form.set('coverImage', storyForm.coverImage);
      form.set('visibility', storyForm.visibility);
      form.set('pinned', storyForm.pinned ? '1' : '0');
      form.set('draft', storyForm.draft ? '1' : '0');
      if (storyCover) form.set('cover', storyCover);
      const res = await fetch(storyEditingId ? `/api/stories/${storyEditingId}/` : '/api/stories/', {
        method: storyEditingId ? 'PUT' : 'POST',
        body: form
      });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '故事保存失败', tone: 'danger' });
        return;
      }
      setStories((current) => storyEditingId
        ? current.map((story) => story.id === storyEditingId ? data.story : story)
        : [data.story, ...current]);
      resetStoryForm();
      setEditorView(null);
      router.refresh();
    } finally {
      setStoryBusy(false);
    }
  }

  async function removeStoryCover() {
    if (!storyEditingId || storyBusy) return;
    setStoryBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyEditingId}/cover/`, { method: 'DELETE' });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '封面删除失败', tone: 'danger' });
        return;
      }
      setStories((current) => current.map((story) => story.id === storyEditingId ? data.story : story));
      setStoryExistingCover(data.story?.coverImage || '');
      setStoryConfirmRemoveCover(false);
      router.refresh();
    } finally {
      setStoryBusy(false);
    }
  }

  async function deleteStory(story: any, ask = true) {
    if (ask && !(await dialogs.confirm({
      title: '删除故事',
      message: '确定删除这篇故事吗？删除后无法恢复。',
      confirmText: '删除',
      tone: 'danger'
    }))) return false;
    const res = await fetch(`/api/stories/${story.id}/`, { method: 'DELETE' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '故事删除失败', tone: 'danger' });
      return false;
    }
    setStories((current) => current.filter((item) => item.id !== story.id));
    setSelectedIds((current) => ({ ...current, stories: current.stories.filter((id) => id !== story.id) }));
    if (storyEditingId === story.id) resetStoryForm();
    router.refresh();
    return true;
  }

  function resetEventForm() {
    setEventEditingId(null);
    setEventForm({ date: today(), title: '', description: '', imageUrl: '' });
    setEventFiles([]);
    setEventExistingImage('');
    setEventConfirmRemoveImage(false);
  }

  function editEvent(event: any) {
    setEventEditingId(event.id);
    setEventForm({ date: event.date || today(), title: event.title || '', description: event.description || '', imageUrl: '' });
    setEventFiles([]);
    setEventExistingImage(event.image || '');
    setEventConfirmRemoveImage(false);
  }

  async function submitEvent() {
    if (findDuplicateItem('events', eventForm, eventEditingId)) {
      warnDuplicate('events');
      return;
    }

    setEventBusy(true);
    try {
      const form = new FormData();
      form.set('date', eventForm.date);
      form.set('title', eventForm.title);
      form.set('description', eventForm.description);
      form.set('imageUrl', eventForm.imageUrl);
      if (eventFiles[0]) form.set('image', eventFiles[0]);
      const res = await fetch(eventEditingId ? `/api/events/${eventEditingId}/` : '/api/events/', {
        method: eventEditingId ? 'PUT' : 'POST',
        body: form
      });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '时光保存失败', tone: 'danger' });
        return;
      }
      setEvents((current) => sortEvents(eventEditingId
        ? current.map((event) => event.id === eventEditingId ? data.event : event)
        : current.concat(data.event)));
      resetEventForm();
      setEditorView(null);
      router.refresh();
    } finally {
      setEventBusy(false);
    }
  }

  async function removeEventImage() {
    if (!eventEditingId || eventBusy) return;
    setEventBusy(true);
    try {
      const res = await fetch(`/api/events/${eventEditingId}/image/`, { method: 'DELETE' });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '图片删除失败', tone: 'danger' });
        return;
      }
      setEvents((current) => sortEvents(current.map((event) => event.id === eventEditingId ? data.event : event)));
      setEventExistingImage(data.event?.image || '');
      setEventConfirmRemoveImage(false);
      router.refresh();
    } finally {
      setEventBusy(false);
    }
  }

  async function deleteEvent(event: any, ask = true) {
    if (ask && !(await dialogs.confirm({
      title: '删除时光碎片',
      message: '确定删除这个时光碎片吗？删除后无法恢复。',
      confirmText: '删除',
      tone: 'danger'
    }))) return false;
    const res = await fetch(`/api/events/${event.id}/`, { method: 'DELETE' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '时光删除失败', tone: 'danger' });
      return false;
    }
    setEvents((current) => current.filter((item) => item.id !== event.id));
    setSelectedIds((current) => ({ ...current, events: current.events.filter((id) => id !== event.id) }));
    if (eventEditingId === event.id) resetEventForm();
    router.refresh();
    return true;
  }

  function resetWishForm() {
    setWishForm({
      content: '',
      displayAt: nowLocal(),
      noteStyle: 'random',
      noteColor: '#fff4b8',
      textColor: '#3f382d'
    });
  }

  async function submitWish() {
    if (findDuplicateItem('wishlist', wishForm)) {
      warnDuplicate('wishlist');
      return;
    }

    setWishBusy(true);
    try {
      const res = await fetch('/api/meta/wishlist/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wishForm)
      });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '心愿添加失败', tone: 'danger' });
        return;
      }
      setWishlist((current) => [data.item, ...current]);
      resetWishForm();
      setEditorView(null);
      router.refresh();
    } finally {
      setWishBusy(false);
    }
  }

  async function toggleWish(item: any) {
    const res = await fetch(`/api/meta/wishlist/${item.id}/toggle/`, { method: 'PUT' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '心愿状态更新失败', tone: 'danger' });
      return;
    }
    setWishlist((current) => current.map((wish) => wish.id === item.id ? data.item : wish));
    router.refresh();
  }

  async function deleteWish(item: any, ask = true) {
    if (ask && !(await dialogs.confirm({
      title: '删除心愿',
      message: '确定删除这个心愿吗？删除后无法恢复。',
      confirmText: '删除',
      tone: 'danger'
    }))) return false;
    const res = await fetch(`/api/meta/wishlist/${item.id}/`, { method: 'DELETE' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '心愿删除失败', tone: 'danger' });
      return false;
    }
    setWishlist((current) => current.filter((wish) => wish.id !== item.id));
    setSelectedIds((current) => ({ ...current, wishlist: current.wishlist.filter((id) => id !== item.id) }));
    router.refresh();
    return true;
  }

  function resetMessageForm() {
    setMessageForm({ content: '', color: '#fff4f6' });
  }

  async function submitMessage() {
    if (findDuplicateItem('messages', messageForm)) {
      warnDuplicate('messages');
      return;
    }

    setMessageBusy(true);
    try {
      const res = await fetch('/api/meta/messages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageForm)
      });
      const data = await jsonBody(res);
      if (!res.ok) {
        void dialogs.alert({ message: data.error || '悄悄话发布失败', tone: 'danger' });
        return;
      }
      setMessages((current) => [data.message, ...current]);
      resetMessageForm();
      setEditorView(null);
      router.refresh();
    } finally {
      setMessageBusy(false);
    }
  }

  async function deleteMessage(message: any, ask = true) {
    if (ask && !(await dialogs.confirm({
      title: '删除悄悄话',
      message: '确定删除这条悄悄话吗？删除后无法恢复。',
      confirmText: '删除',
      tone: 'danger'
    }))) return false;
    const res = await fetch(`/api/meta/messages/${message.id}/`, { method: 'DELETE' });
    const data = await jsonBody(res);
    if (!res.ok) {
      void dialogs.alert({ message: data.error || '悄悄话删除失败', tone: 'danger' });
      return false;
    }
    setMessages((current) => current.filter((item) => item.id !== message.id));
    setSelectedIds((current) => ({ ...current, messages: current.messages.filter((id) => id !== message.id) }));
    router.refresh();
    return true;
  }

  function viewIcon(view: AdminContentView, size = 18) {
    if (view === 'posts') return <MessageSquare size={size} />;
    if (view === 'stories') return <FileText size={size} />;
    if (view === 'events') return <CalendarDays size={size} />;
    if (view === 'wishlist') return <ListChecks size={size} />;
    return <ImageIcon size={size} />;
  }

  function getItems(view: AdminContentView) {
    if (view === 'posts') return posts;
    if (view === 'stories') return stories;
    if (view === 'events') return events;
    if (view === 'wishlist') return wishlist;
    return messages;
  }

  function canManageItem(view: AdminContentView, item: any) {
    if (!user) return false;
    if (canAdmin) return true;
    if (view === 'posts') return user.id === item.authorId || user.id === item.author?.id;
    if (view === 'stories') return user.id === item.authorId || user.id === item.author?.id;
    if (view === 'messages') return user.id === item.userId || user.id === item.user?.id;
    return false;
  }

  function canCreateInView(view: AdminContentView) {
    return !!user && (canAdmin || view === 'posts' || view === 'stories' || view === 'messages');
  }

  function findDuplicateItem(view: AdminContentView, item: any, ignoreId?: number | null) {
    const signature = contentSignature(view, item);
    if (!signature) return false;
    return getItems(view).some((existing) => {
      if (ignoreId && Number(existing.id) === ignoreId) return false;
      return contentSignature(view, existing) === signature;
    });
  }

  function warnDuplicate(view: AdminContentView) {
    void dialogs.alert({
      title: '发现重复内容',
      message: `${duplicateLabel(view)}中已存在相同内容，已取消保存。`,
      tone: 'warning'
    });
  }

  function buildImportPlan(view: AdminContentView, items: any[]) {
    const existingSignatures = new Set(getItems(view).map((item) => contentSignature(view, item)).filter(Boolean));
    const importSignatures = new Set<string>();
    const nextItems: any[] = [];
    let skippedExisting = 0;
    let skippedRepeated = 0;
    let skippedInvalid = 0;

    for (const item of items) {
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

  function toggleSelected(view: AdminContentView, id: number, checked: boolean) {
    setSelectedIds((current) => ({
      ...current,
      [view]: checked
        ? Array.from(new Set(current[view].concat(id)))
        : current[view].filter((itemId) => itemId !== id)
    }));
  }

  function toggleSelectAll(view: AdminContentView) {
    const manageableIds = getItems(view)
      .filter((item) => canManageItem(view, item))
      .map((item) => Number(item.id))
      .filter(Boolean);
    const allSelected = manageableIds.length > 0 && manageableIds.every((id) => selectedIds[view].includes(id));
    setSelectedIds((current) => ({ ...current, [view]: allSelected ? [] : manageableIds }));
  }

  function rowSelector(view: AdminContentView, item: any) {
    const id = Number(item.id);
    const canManage = canManageItem(view, item);
    return (
      <label className="admin-row-check" aria-label="选择内容">
        <input
          type="checkbox"
          checked={selectedIds[view].includes(id)}
          disabled={!canManage}
          onChange={(event) => toggleSelected(view, id, event.target.checked)}
        />
      </label>
    );
  }

  function openCreate(view: AdminContentView) {
    if (!canCreateInView(view)) return;
    if (view === 'posts') resetPostForm();
    if (view === 'stories') resetStoryForm();
    if (view === 'events') resetEventForm();
    if (view === 'wishlist') resetWishForm();
    if (view === 'messages') resetMessageForm();
    setEditorView(view);
  }

  function openEditor(view: AdminContentView, item: any) {
    if (!canManageItem(view, item)) return;
    if (view === 'posts') editPost(item);
    if (view === 'stories') editStory(item);
    if (view === 'events') editEvent(item);
    setEditorView(view);
  }

  function closeEditor() {
    if (editorView === 'posts') resetPostForm();
    if (editorView === 'stories') resetStoryForm();
    if (editorView === 'events') resetEventForm();
    if (editorView === 'wishlist') resetWishForm();
    if (editorView === 'messages') resetMessageForm();
    setEditorView(null);
  }

  function exportCurrent(view: AdminContentView) {
    const exportItems = canAdmin ? getItems(view) : getItems(view).filter((item) => canManageItem(view, item));
    const payload = {
      type: view,
      title: viewCopy[view].title,
      exportedAt: new Date().toISOString(),
      items: exportItems
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${view}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function itemsFromImport(view: AdminContentView, parsed: any) {
    if (Array.isArray(parsed)) return parsed;
    const candidates = [parsed?.items, parsed?.[view], parsed?.data];
    return candidates.find((item) => Array.isArray(item)) || [];
  }

  async function importItem(view: AdminContentView, item: any) {
    if (!canCreateInView(view)) return false;
    if (!item || typeof item !== 'object') return false;

    if (view === 'posts') {
      const imageUrls = imageUrlsFrom(item.imageUrls || item.image_urls || item.images);
      if (!String(item.content || '').trim() && !imageUrls) return false;
      const form = new FormData();
      form.set('content', String(item.content || ''));
      form.set('mood', String(item.mood || '').slice(0, 16));
      form.set('imageUrls', imageUrls);
      const res = await fetch('/api/posts/', { method: 'POST', body: form });
      return res.ok;
    }

    if (view === 'stories') {
      if (!String(item.title || '').trim() || !String(item.content || '').trim()) return false;
      const form = new FormData();
      form.set('title', String(item.title || ''));
      form.set('excerpt', String(item.excerpt || ''));
      form.set('content', String(item.content || ''));
      form.set('tags', Array.isArray(item.tags) ? item.tags.join(', ') : String(item.tags || ''));
      form.set('coverImage', String(item.coverImage || item.cover_image || ''));
      form.set('visibility', item.visibility === 'private' ? 'private' : 'public');
      form.set('pinned', item.pinned ? '1' : '0');
      form.set('draft', item.draft || item.isDraft ? '1' : '0');
      const res = await fetch('/api/stories/', { method: 'POST', body: form });
      return res.ok;
    }

    if (view === 'events') {
      const date = String(item.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !String(item.title || '').trim()) return false;
      const form = new FormData();
      form.set('date', date);
      form.set('title', String(item.title || ''));
      form.set('description', String(item.description || ''));
      form.set('imageUrl', String(item.imageUrl || item.image_url || item.image || ''));
      const res = await fetch('/api/events/', { method: 'POST', body: form });
      return res.ok;
    }

    if (view === 'wishlist') {
      if (!String(item.content || '').trim()) return false;
      const noteStyle = wishStyleLabels.some(([value]) => value === item.noteStyle) ? item.noteStyle : 'random';
      const res = await fetch('/api/meta/wishlist/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: String(item.content || ''),
          displayAt: localDateTime(item.displayAt || item.createdAt),
          noteStyle,
          noteColor: item.noteColor || '',
          textColor: item.textColor || ''
        })
      });
      return res.ok;
    }

    if (!String(item.content || '').trim()) return false;
    const res = await fetch('/api/meta/messages/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: String(item.content || ''), color: item.color || '#fff4f6' })
    });
    return res.ok;
  }

  async function importCurrent(view: AdminContentView, file: File) {
    setImportingView(view);
    try {
      const parsed = JSON.parse(await file.text());
      const items = itemsFromImport(view, parsed);
      if (!items.length) {
        void dialogs.alert({ message: '没有识别到可导入的内容，请选择导出的 JSON 文件。', tone: 'warning' });
        return;
      }
      const plan = buildImportPlan(view, items);
      const skippedBeforeImport = plan.skippedExisting + plan.skippedRepeated + plan.skippedInvalid;
      if (!plan.items.length) {
        void dialogs.alert({
          title: '没有新内容',
          message: `共读取 ${items.length} 条内容，已存在 ${plan.skippedExisting} 条，文件内重复 ${plan.skippedRepeated} 条，无效 ${plan.skippedInvalid} 条。`,
          tone: 'warning'
        });
        return;
      }
      if (!(await dialogs.confirm({
        title: '导入内容',
        message: `共读取 ${items.length} 条内容，将导入 ${plan.items.length} 条新内容，跳过 ${skippedBeforeImport} 条重复或无效内容。继续吗？`,
        confirmText: '开始导入',
        tone: 'info'
      }))) return;
      let imported = 0;
      let failed = 0;
      for (const item of plan.items) {
        if (await importItem(view, item)) imported += 1;
        else failed += 1;
      }
      await reloadActiveView(view);
      router.refresh();
      void dialogs.alert({
        message: `已导入 ${imported} 条内容${skippedBeforeImport + failed ? `，跳过 ${skippedBeforeImport + failed} 条` : ''}`,
        tone: 'success'
      });
    } catch (error) {
      void dialogs.alert({
        message: error instanceof Error ? `导入失败：${error.message}` : '导入失败',
        tone: 'danger'
      });
    } finally {
      setImportingView(null);
    }
  }

  async function deleteSelected(view: AdminContentView) {
    const selected = selectedIds[view];
    if (!selected.length) {
      void dialogs.alert({ message: '请先勾选需要删除的内容。', tone: 'warning' });
      return;
    }
    if (!(await dialogs.confirm({
      title: '批量删除内容',
      message: `确定删除已选中的 ${selected.length} 条内容吗？此操作不可恢复。`,
      confirmText: '删除',
      tone: 'danger'
    }))) return;
    const targets = getItems(view).filter((item) => selected.includes(Number(item.id)) && canManageItem(view, item));
    let deleted = 0;
    for (const item of targets) {
      if (view === 'posts' && await deletePost(item, false)) deleted += 1;
      if (view === 'stories' && await deleteStory(item, false)) deleted += 1;
      if (view === 'events' && await deleteEvent(item, false)) deleted += 1;
      if (view === 'wishlist' && await deleteWish(item, false)) deleted += 1;
      if (view === 'messages' && await deleteMessage(item, false)) deleted += 1;
    }
    setSelectedIds((current) => ({ ...current, [view]: [] }));
    void dialogs.alert({ message: `已删除 ${deleted} 条内容`, tone: 'success' });
  }

  function toolbar(view: AdminContentView) {
    const selected = selectedIds[view].length;
    const importing = importingView === view;
    const canCreate = canCreateInView(view);
    return (
      <div className="admin-panel-toolbar">
        {canCreate && (
        <button className="admin-tool-button primary" type="button" onClick={() => openCreate(view)}>
          <Plus size={16} />
          添加
        </button>
        )}
        <button className="admin-tool-button danger" type="button" onClick={() => void deleteSelected(view)} disabled={!selected}>
          <Trash2 size={16} />
          删除{selected ? ` ${selected}` : ''}
        </button>
        <button className="admin-tool-button" type="button" onClick={() => exportCurrent(view)}>
          <Download size={16} />
          导出
        </button>
        {canCreate && (
        <label className={`admin-tool-button ${importing ? 'is-busy' : ''}`}>
          <Upload size={16} />
          {importing ? '导入中' : '导入'}
          <input
            type="file"
            accept=".json,application/json"
            disabled={!!importingView}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) void importCurrent(view, file);
            }}
          />
        </label>
        )}
      </div>
    );
  }

  function renderPanel(view: AdminContentView, children: ReactNode) {
    const items = getItems(view);
    const manageableCount = items.filter((item) => canManageItem(view, item)).length;
    const selected = selectedIds[view].length;
    const allSelected = manageableCount > 0 && selected === manageableCount;

    return (
      <article id={`content-${view}`} className="admin-panel admin-content-manager">
        <header className="admin-manager-head action-only">
          {toolbar(view)}
        </header>
        <div className="admin-manager-grid">
          <section className="admin-manager-list">
            <div className="admin-list-toolbar">
              <span>{loading ? '加载中' : `${items.length} 条内容`}</span>
              <button type="button" onClick={() => toggleSelectAll(view)} disabled={!manageableCount}>
                {allSelected ? '取消全选' : '全选可管理项'}
              </button>
            </div>
            {items.length ? children : (
              <div className="admin-empty-state">
                <Heart size={22} />
                <b>{viewCopy[view].empty}</b>
              </div>
            )}
          </section>
        </div>
      </article>
    );
  }

  function renderEditor() {
    if (!editorView) return null;
    if (editorView === 'posts') {
      const hasExistingMedia = !!postExistingMedia.video || postExistingMedia.images.length > 0;
      return (
        <section className="admin-manager-form admin-post-editor">
          <label className="admin-field full"><span>内容</span><textarea value={postForm.content} onChange={(event) => setPostForm({ ...postForm, content: event.target.value })} placeholder="记录一段新的动态" /></label>
          <div className="admin-form-grid compact">
            <label className="admin-field"><span>心情标签</span><input value={postForm.mood} onChange={(event) => setPostForm({ ...postForm, mood: event.target.value })} placeholder="开心 / 纪念 / 日常" /></label>
            {!postEditingId && (
              <label className="admin-file-button">
                <Video size={15} />
                <input type="file" accept="video/*" onChange={(event) => setPostVideo(event.target.files?.[0] || null)} />
                {postVideo ? postVideo.name : '上传视频'}
              </label>
            )}
          </div>
          {postEditingId && (
            <label className="admin-file-button admin-video-replace">
              <Video size={15} />
              <input type="file" accept="video/*" onChange={(event) => setPostVideo(event.target.files?.[0] || null)} />
              {postVideo ? postVideo.name : '添加 / 替换视频'}
            </label>
          )}
          {postEditingId && hasExistingMedia && (
            <section className="admin-existing-media" aria-label="已发布媒体">
              <div className="admin-existing-media-head">
                <span>已发布媒体</span>
                <b>{postExistingMedia.images.length} 张图片{postExistingMedia.video ? ' · 1 个视频' : ''}</b>
              </div>
              <div className="admin-existing-media-grid">
                {postExistingMedia.video && (
                  <figure className={`video ${postConfirmRemoveVideo ? 'is-removing' : ''}`}>
                    <button
                      className={`admin-media-remove ${postConfirmRemoveVideo ? 'confirm' : ''}`}
                      type="button"
                      onClick={() => {
                        if (postConfirmRemoveVideo) {
                          void removePostMedia({ video: true });
                        } else {
                          setPostConfirmRemoveVideo(true);
                        }
                      }}
                      disabled={postBusy}
                    >
                      <Trash2 size={13} />
                      {postBusy && postConfirmRemoveVideo ? '删除中' : postConfirmRemoveVideo ? '确认' : '删除'}
                    </button>
                    <video src={postExistingMedia.video} controls />
                    <figcaption><Video size={14} />视频</figcaption>
                  </figure>
                )}
                {postExistingMedia.images.map((image, index) => {
                  const imageId = Number(image.id);
                  const confirmRemove = postConfirmRemoveImageIds.includes(imageId);
                  return (
                  <figure key={image.id || image.path || index} className={confirmRemove ? 'is-removing' : undefined}>
                    {Number.isInteger(Number(image.id)) && Number(image.id) > 0 && (
                      <button
                        className={`admin-media-remove ${confirmRemove ? 'confirm' : ''}`}
                        type="button"
                        onClick={() => {
                          if (confirmRemove) {
                            void removePostMedia({ imageId });
                          } else {
                            setPostConfirmRemoveImageIds((current) => current.concat(imageId));
                          }
                        }}
                        disabled={postBusy}
                      >
                        <Trash2 size={13} />
                        {postBusy && confirmRemove ? '删除中' : confirmRemove ? '确认' : '删除'}
                      </button>
                    )}
                    <img src={image.path || image.url || image.src} alt="" />
                    <figcaption><ImageIcon size={14} />图片 {index + 1}</figcaption>
                  </figure>
                  );
                })}
              </div>
            </section>
          )}
          <div className="admin-post-media-compact">
            <MediaDropzone
              files={postFiles}
              onFiles={setPostFiles}
              urls={postUrls}
              onUrls={setPostUrls}
              fieldLabel="图片链接"
              label="上传图片"
            />
          </div>
          <div className="admin-inline-actions">
            <EmojiPicker packs={emojiPacks} onPick={(value) => setPostForm((current) => ({ ...current, content: `${current.content}${value}` }))} />
            <button className="admin-primary-action" type="button" onClick={submitPost} disabled={postBusy}>
              {postEditingId ? <Save size={16} /> : <Send size={16} />}
              {postBusy ? '保存中' : postEditingId ? '保存说说' : '发布说说'}
            </button>
            <button type="button" onClick={closeEditor}><XCircle size={16} />取消</button>
          </div>
        </section>
      );
    }

    if (editorView === 'stories') {
      return (
        <section className="admin-manager-form">
          <div className="admin-form-grid compact">
            <label className="admin-field"><span>标题</span><input value={storyForm.title} onChange={(event) => setStoryForm({ ...storyForm, title: event.target.value })} /></label>
            <label className="admin-field"><span>标签</span><input value={storyForm.tags} onChange={(event) => setStoryForm({ ...storyForm, tags: event.target.value })} placeholder="旅行, 纪念日" /></label>
            <label className="admin-field full"><span>摘要</span><input value={storyForm.excerpt} onChange={(event) => setStoryForm({ ...storyForm, excerpt: event.target.value })} /></label>
            <label className="admin-field full"><span>正文</span><textarea className="admin-large-editor" value={storyForm.content} onChange={(event) => setStoryForm({ ...storyForm, content: event.target.value })} /></label>
          </div>
          {storyEditingId && storyExistingCover && (
            <section className="admin-existing-media" aria-label="已发布媒体">
              <div className="admin-existing-media-head">
                <span>已发布媒体</span>
                <b>1 张封面</b>
              </div>
              <div className="admin-existing-media-grid">
                <figure className={storyConfirmRemoveCover ? 'is-removing' : undefined}>
                  <button
                    className={`admin-media-remove ${storyConfirmRemoveCover ? 'confirm' : ''}`}
                    type="button"
                    onClick={() => {
                      if (storyConfirmRemoveCover) {
                        void removeStoryCover();
                      } else {
                        setStoryConfirmRemoveCover(true);
                      }
                    }}
                    disabled={storyBusy}
                  >
                    <Trash2 size={13} />
                    {storyBusy && storyConfirmRemoveCover ? '删除中' : storyConfirmRemoveCover ? '确认' : '删除'}
                  </button>
                  <img src={storyExistingCover} alt="" />
                  <figcaption><ImageIcon size={14} />封面</figcaption>
                </figure>
              </div>
            </section>
          )}
          <MediaDropzone
            files={storyCover ? [storyCover] : []}
            onFiles={(files) => setStoryCover(files[0] || null)}
            urls={storyForm.coverImage}
            onUrls={(value) => setStoryForm({ ...storyForm, coverImage: value })}
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={false}
            fieldLabel="封面 URL"
            label="上传封面"
            urlLabel="粘贴封面 URL"
          />
          <div className="admin-switch-row inline">
            <label><input type="checkbox" checked={storyForm.pinned} onChange={(event) => setStoryForm({ ...storyForm, pinned: event.target.checked })} />置顶</label>
            <label><input type="checkbox" checked={storyForm.draft} onChange={(event) => setStoryForm({ ...storyForm, draft: event.target.checked })} />保存草稿</label>
            <select value={storyForm.visibility} onChange={(event) => setStoryForm({ ...storyForm, visibility: event.target.value })}>
              <option value="public">公开</option>
              <option value="private">私密</option>
            </select>
          </div>
          <div className="admin-inline-actions">
            <button className="admin-primary-action" type="button" onClick={submitStory} disabled={storyBusy}><Save size={16} />{storyBusy ? '保存中' : '保存故事'}</button>
            <button type="button" onClick={closeEditor}><XCircle size={16} />取消</button>
          </div>
        </section>
      );
    }

    if (editorView === 'events') {
      return (
        <section className="admin-manager-form">
          <div className="admin-form-grid compact">
            <label className="admin-field"><span>日期</span><input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} /></label>
            <label className="admin-field"><span>标题</span><input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} /></label>
            <label className="admin-field full"><span>描述</span><textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></label>
          </div>
          {eventEditingId && eventExistingImage && (
            <section className="admin-existing-media" aria-label="已发布媒体">
              <div className="admin-existing-media-head">
                <span>已发布媒体</span>
                <b>1 张图片</b>
              </div>
              <div className="admin-existing-media-grid">
                <figure className={eventConfirmRemoveImage ? 'is-removing' : undefined}>
                  <button
                    className={`admin-media-remove ${eventConfirmRemoveImage ? 'confirm' : ''}`}
                    type="button"
                    onClick={() => {
                      if (eventConfirmRemoveImage) {
                        void removeEventImage();
                      } else {
                        setEventConfirmRemoveImage(true);
                      }
                    }}
                    disabled={eventBusy}
                  >
                    <Trash2 size={13} />
                    {eventBusy && eventConfirmRemoveImage ? '删除中' : eventConfirmRemoveImage ? '确认' : '删除'}
                  </button>
                  <img src={eventExistingImage} alt="" />
                  <figcaption><ImageIcon size={14} />图片</figcaption>
                </figure>
              </div>
            </section>
          )}
          <MediaDropzone
            files={eventFiles}
            onFiles={setEventFiles}
            urls={eventForm.imageUrl}
            onUrls={(value) => setEventForm({ ...eventForm, imageUrl: value })}
            multiple={false}
            fieldLabel="图片 URL"
            label="上传图片"
            urlLabel={eventEditingId ? '留空则保留原图；填入 URL 会替换图片' : '粘贴图片 URL'}
          />
          <div className="admin-inline-actions">
            <button className="admin-primary-action" type="button" onClick={submitEvent} disabled={eventBusy}><Save size={16} />{eventBusy ? '保存中' : '保存时光'}</button>
            <button type="button" onClick={closeEditor}><XCircle size={16} />取消</button>
          </div>
        </section>
      );
    }

    if (editorView === 'wishlist') {
      return (
        <section className="admin-manager-form">
          <label className="admin-field full"><span>心愿内容</span><input value={wishForm.content} onChange={(event) => setWishForm({ ...wishForm, content: event.target.value })} placeholder="想一起完成的事" /></label>
          <div className="admin-form-grid compact">
            <label className="admin-field"><span>展示时间</span><input type="datetime-local" value={wishForm.displayAt} onChange={(event) => setWishForm({ ...wishForm, displayAt: event.target.value })} /></label>
            <label className="admin-field"><span>便利贴样式</span><select value={wishForm.noteStyle} onChange={(event) => setWishForm({ ...wishForm, noteStyle: event.target.value })}>{wishStyleLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {wishForm.noteStyle === 'custom' && (
            <div className="admin-color-row">
              <label>背景 <input type="color" value={wishForm.noteColor} onChange={(event) => setWishForm({ ...wishForm, noteColor: event.target.value })} /></label>
              <label>文字 <input type="color" value={wishForm.textColor} onChange={(event) => setWishForm({ ...wishForm, textColor: event.target.value })} /></label>
            </div>
          )}
          <div className="admin-inline-actions">
            <button className="admin-primary-action" type="button" onClick={submitWish} disabled={wishBusy}><Plus size={16} />{wishBusy ? '添加中' : '添加心愿'}</button>
            <button type="button" onClick={closeEditor}><XCircle size={16} />取消</button>
          </div>
        </section>
      );
    }

    return (
      <section className="admin-manager-form">
        <label className="admin-field full"><span>内容</span><textarea value={messageForm.content} onChange={(event) => setMessageForm({ ...messageForm, content: event.target.value })} placeholder="只给自己保存的内容" /></label>
        <div className="admin-color-row">
          <label>便签颜色 <input type="color" value={messageForm.color} onChange={(event) => setMessageForm({ ...messageForm, color: event.target.value })} /></label>
        </div>
        <div className="admin-inline-actions">
          <button className="admin-primary-action" type="button" onClick={submitMessage} disabled={messageBusy}><Send size={16} />{messageBusy ? '发布中' : '发布悄悄话'}</button>
          <button type="button" onClick={closeEditor}><XCircle size={16} />取消</button>
        </div>
      </section>
    );
  }

  return (
    <section id="content" className="admin-content-sections admin-content-single" aria-busy={loading}>
      {activeView === 'posts' && renderPanel('posts', posts.map((post) => {
        const canManage = canManageItem('posts', post);
        return (
          <article key={post.id} className={`admin-list-row selectable ${selectedIds.posts.includes(Number(post.id)) ? 'selected' : ''}`}>
            {rowSelector('posts', post)}
            <div className="admin-list-main">
              <b>{post.mood || '未标记心情'}</b>
              <p>{post.content || `${post.images?.length || 0} 张图片 / ${post.video ? '含视频' : '无文字'}`}</p>
              <span>{post.author?.displayName} · {formatDateTime(post.createdAt)}</span>
            </div>
            {canManage && (
              <div className="admin-row-actions">
                <button type="button" onClick={() => openEditor('posts', post)}><Edit3 size={14} />编辑</button>
                <button type="button" className="danger" onClick={() => void deletePost(post)}><Trash2 size={14} />删除</button>
              </div>
            )}
          </article>
        );
      }))}

      {activeView === 'stories' && renderPanel('stories', stories.map((story) => {
        const canManage = canManageItem('stories', story);
        return (
          <article key={story.id} className={`admin-list-row selectable ${selectedIds.stories.includes(Number(story.id)) ? 'selected' : ''}`}>
            {rowSelector('stories', story)}
            {story.coverImage && <img src={story.coverImage} alt="" />}
            <div className="admin-list-main">
              <b>{story.title}</b>
              <p>{story.excerpt || story.content.slice(0, 96)}</p>
              <span>{story.isDraft ? '草稿' : '已发布'} · {story.visibility === 'private' ? '私密' : '公开'} · {formatDateTime(story.publishedAt || story.createdAt)}</span>
            </div>
            {canManage && (
              <div className="admin-row-actions">
                <button type="button" onClick={() => openEditor('stories', story)}><Edit3 size={14} />编辑</button>
                <button type="button" className="danger" onClick={() => void deleteStory(story)}><Trash2 size={14} />删除</button>
              </div>
            )}
          </article>
        );
      }))}

      {activeView === 'events' && renderPanel('events', events.map((event) => {
        const canManage = canManageItem('events', event);
        return (
          <article key={event.id} className={`admin-list-row selectable ${selectedIds.events.includes(Number(event.id)) ? 'selected' : ''}`}>
            {rowSelector('events', event)}
            {event.image && <img src={event.image} alt="" />}
            <div className="admin-list-main">
              <b>{event.title}</b>
              <p>{event.description || '暂无描述'}</p>
              <span>{event.date}</span>
            </div>
            {canManage && (
              <div className="admin-row-actions">
                <button type="button" onClick={() => openEditor('events', event)}><Edit3 size={14} />编辑</button>
                <button type="button" className="danger" onClick={() => void deleteEvent(event)}><Trash2 size={14} />删除</button>
              </div>
            )}
          </article>
        );
      }))}

      {activeView === 'wishlist' && renderPanel('wishlist', wishlist.map((item) => {
        const canManage = canManageItem('wishlist', item);
        return (
          <article key={item.id} className={`admin-list-row selectable ${selectedIds.wishlist.includes(Number(item.id)) ? 'selected' : ''}`}>
            {rowSelector('wishlist', item)}
            <div className="admin-list-main">
              <b>{item.done ? '已完成' : '未完成'}</b>
              <p>{item.content}</p>
              <span>{formatDateTime(item.displayAt || item.createdAt)}</span>
            </div>
            {canManage && (
              <div className="admin-row-actions">
                <button type="button" onClick={() => toggleWish(item)}><Check size={14} />{item.done ? '取消' : '完成'}</button>
                <button type="button" className="danger" onClick={() => void deleteWish(item)}><Trash2 size={14} />删除</button>
              </div>
            )}
          </article>
        );
      }))}

      {activeView === 'messages' && renderPanel('messages', messages.map((message) => {
        const canDelete = canManageItem('messages', message);
        return (
          <article key={message.id} className={`admin-list-row selectable ${selectedIds.messages.includes(Number(message.id)) ? 'selected' : ''}`}>
            {rowSelector('messages', message)}
            <i className="admin-color-dot" style={{ background: message.color }} />
            <div className="admin-list-main">
              <b>{message.user?.displayName || '成员'}</b>
              <p>{message.content}</p>
              <span>{formatDateTime(message.createdAt)}</span>
            </div>
            {canDelete && (
              <div className="admin-row-actions">
                <button type="button" className="danger" onClick={() => void deleteMessage(message)}><Trash2 size={14} />删除</button>
              </div>
            )}
          </article>
        );
      }))}

      {editorView && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section className="admin-editor-modal" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
            <header className="admin-editor-head">
              <div>
                <h3 id="admin-editor-title">{viewIcon(editorView)}{editorView === 'posts' && postEditingId ? viewCopy[editorView].editorEdit : editorView === 'stories' && storyEditingId ? viewCopy[editorView].editorEdit : editorView === 'events' && eventEditingId ? viewCopy[editorView].editorEdit : viewCopy[editorView].editorAdd}</h3>
              </div>
              <button className="admin-modal-close" type="button" onClick={closeEditor} aria-label="关闭表单">
                <X size={18} />
              </button>
            </header>
            <div className="admin-editor-body">
              {renderEditor()}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
