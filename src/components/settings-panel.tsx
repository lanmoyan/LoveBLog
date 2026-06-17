'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Braces,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileText,
  Globe2,
  HeartHandshake,
  Home,
  ImageIcon,
  KeyRound,
  Languages,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Radio,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlink2,
  Upload,
  UserCog,
  Users,
  X,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AdminContentManager, type AdminContentView } from '@/components/admin-content-manager';
import { MediaDropzone } from '@/components/media-dropzone';
import { useSession } from '@/components/session-provider';
import type { SiteSnapshot } from '@/lib/site';

type Stats = {
  posts?: number;
  likes?: number;
  messages?: number;
  events?: number;
  wishlist?: number;
  stories?: number;
  visits?: number;
  hasSecurityCode?: boolean;
  visitSummary?: {
    today: number;
    week: number;
    month: number;
    year: number;
    total: number;
    avgDuration: number;
  };
  visitSeries?: Array<{ label: string; visits: number }>;
  topPages?: Array<{ path: string; views: number; avgDuration: number }>;
  regions?: Array<{ region: string; visits: number }>;
  devices?: Array<{ type: string; visits: number; detail?: string }>;
  recentVisits?: Array<{ path: string; region: string; device: string; duration: number; createdAt: string }>;
};

type UserRole = {
  key: string;
  name: string;
  canAdmin: boolean;
};

type ManagedUser = {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  avatarImage: string;
  partnerId?: number | null;
  roleKey: string;
  roleName?: string;
  status?: string;
  statusLabel?: string;
  lastLoginAt?: string | Date | null;
  createdAt?: string | Date;
};

type AuthProviderDraft = {
  key: string;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
  hasSecret?: boolean;
};

type AuthIntegrationDraft = {
  registrationEmailEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPass: string;
  smtpPassConfigured: boolean;
  oauthProviders: AuthProviderDraft[];
};

type EmojiPackDraft = SiteSnapshot['emojiPacks'][number];
type EmojiItemDraft = EmojiPackDraft['items'][number];

type AdminView = 'overview' | AdminContentView | 'site' | 'emoji' | 'profile' | 'stats' | 'users';

const contentViews: AdminContentView[] = ['posts', 'stories', 'events', 'wishlist', 'messages'];

const adminViewHashes: Record<AdminView, string> = {
  overview: 'overview',
  posts: 'content-posts',
  stories: 'content-stories',
  events: 'content-events',
  wishlist: 'content-wishlist',
  messages: 'content-messages',
  site: 'site',
  emoji: 'emoji',
  profile: 'profile',
  stats: 'stats',
  users: 'users'
};

const userContentViews: AdminContentView[] = ['posts', 'stories', 'messages'];
const adminOnlyViews: AdminView[] = ['site', 'emoji', 'stats', 'users', 'events', 'wishlist'];
type AdminLanguage = 'zh-CN' | 'en-US';

const adminLanguages: Record<AdminLanguage, { label: string; description: string }> = {
  'zh-CN': { label: '中文', description: '后台按钮和设置保持中文偏好' },
  'en-US': { label: 'English', description: 'Remember English as the admin language preference' }
};

const adminCopy = {
  'zh-CN': {
    nav: {
      overview: '仪表盘',
      data: '全站数据',
      mine: '我的内容',
      posts: '说说管理',
      stories: '故事管理',
      events: '时光管理',
      wishlist: '心愿管理',
      messages: '悄悄话',
      site: '基础信息',
      emoji: '表情商店',
      profile: '账号与安全',
      stats: '访问统计',
      users: '用户管理',
      home: '返回前台'
    },
    top: {
      guide: '教程',
      dark: '暗色',
      notice: '公告',
      visits: '访问',
      profile: '账号资料',
      home: '返回前台',
      logout: '退出登录'
    }
  },
  'en-US': {
    nav: {
      overview: 'Dashboard',
      data: 'Site Data',
      mine: 'My Content',
      posts: 'Posts',
      stories: 'Stories',
      events: 'Timeline',
      wishlist: 'Wishlist',
      messages: 'Private Notes',
      site: 'Site Basics',
      emoji: 'Emoji Store',
      profile: 'Account & Security',
      stats: 'Visit Stats',
      users: 'Users',
      home: 'Back Home'
    },
    top: {
      guide: 'Guide',
      dark: 'Dark',
      notice: 'Notice',
      visits: 'Visits',
      profile: 'Account',
      home: 'Back Home',
      logout: 'Sign Out'
    }
  }
} as const satisfies Record<AdminLanguage, {
  nav: Record<string, string>;
  top: Record<string, string>;
}>;

const defaultOAuthProviders: AuthProviderDraft[] = [
  { key: 'github', name: 'GitHub', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'google', name: 'Google', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'discord', name: 'Discord', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'qq', name: 'QQ', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'wechat', name: 'WeChat', enabled: false, clientId: '', clientSecret: '', hasSecret: false }
];

const defaultAuthIntegrations: AuthIntegrationDraft = {
  registrationEmailEnabled: false,
  smtpHost: '',
  smtpPort: '465',
  smtpSecure: true,
  smtpUser: '',
  smtpFrom: '',
  smtpPass: '',
  smtpPassConfigured: false,
  oauthProviders: defaultOAuthProviders
};

function numberText(value: number | undefined) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

function durationText(value: number | undefined) {
  const seconds = Math.max(0, Math.round(Number(value || 0) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

function cleanRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
}

function roleLabel(roles: UserRole[], key: string) {
  return roles.find((role) => role.key === key)?.name || key || '普通用户';
}

function userStatusLabel(value: string | undefined) {
  return value === 'banned' ? '已封禁' : '正常';
}

function formatAdminDate(value: string | Date | null | undefined, fallback = '未记录') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function SettingsPanel({ snapshot }: { snapshot: SiteSnapshot }) {
  const { user, partner, partnerCandidates, refresh } = useSession();
  const router = useRouter();
  const [info, setInfo] = useState({
    siteTitle: snapshot.title,
    siteIcon: snapshot.siteIcon,
    togetherSince: snapshot.togetherSince,
    imageMetaEnabled: snapshot.imageMetaEnabled,
    twikooEnvId: snapshot.twikooEnvId,
    twikooRegion: snapshot.twikooRegion,
    announcementEnabled: snapshot.announcementEnabled,
    announcementTitle: snapshot.announcementTitle,
    announcementContent: snapshot.announcementContent,
    footerMessageUrl: snapshot.footer.messageUrl,
    footerRssUrl: snapshot.footer.rssUrl,
    footerRewardUrl: snapshot.footer.rewardUrl,
    footerIcpNumber: snapshot.footer.icpNumber,
    footerIcpUrl: snapshot.footer.icpUrl,
    footerPoliceNumber: snapshot.footer.policeNumber,
    footerPoliceUrl: snapshot.footer.policeUrl,
    footerUptimeStatusUrl: snapshot.footer.uptimeStatusUrl,
    footerUptimeStatusPageUrl: snapshot.footer.uptimeStatusPageUrl
  });
  const [stats, setStats] = useState<Stats>({});
  const [emojiPacks, setEmojiPacks] = useState<EmojiPackDraft[]>(snapshot.emojiPacks);
  const [emojiImport, setEmojiImport] = useState({ name: '', source: '' });
  const [emojiItemDrafts, setEmojiItemDrafts] = useState<Record<number, string>>({});
  const [emojiImportBusy, setEmojiImportBusy] = useState(false);
  const [siteIconFiles, setSiteIconFiles] = useState<File[]>([]);
  const [siteIconPreviewMode, setSiteIconPreviewMode] = useState<'current' | 'default' | 'fallback'>('current');
  const [authIntegrations, setAuthIntegrations] = useState<AuthIntegrationDraft>(defaultAuthIntegrations);
  const [authIntegrationsBusy, setAuthIntegrationsBusy] = useState(false);
  const [profile, setProfile] = useState({ displayName: '', avatar: '', password: '', securityCode: '' });
  const [avatarFiles, setAvatarFiles] = useState<File[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [roles, setRoles] = useState<UserRole[]>(snapshot.userRoles || []);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(snapshot.users as ManagedUser[]);
  const [newRole, setNewRole] = useState({ key: '', name: '' });
  const [usersBusy, setUsersBusy] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState({ roleKey: 'user', status: 'active' });
  const [confirmUserAction, setConfirmUserAction] = useState<{ userId: number; action: 'ban' | 'unban' | 'delete' } | null>(null);
  const [confirmRoleDeleteKey, setConfirmRoleDeleteKey] = useState<string | null>(null);
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [adminLanguage, setAdminLanguage] = useState<AdminLanguage>('zh-CN');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isAdmin = user?.roleKey === 'admin';
  const copy = adminCopy[adminLanguage];

  function isViewAllowed(view: AdminView) {
    if (adminOnlyViews.includes(view)) return isAdmin;
    if (contentViews.includes(view as AdminContentView)) {
      return isAdmin || userContentViews.includes(view as AdminContentView);
    }
    return true;
  }

  useEffect(() => {
    if (user) setProfile((value) => ({ ...value, displayName: user.displayName, avatar: user.avatar || '' }));
  }, [user]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const nextView = (Object.keys(adminViewHashes) as AdminView[]).find((view) => adminViewHashes[view] === hash);
      if (nextView && isViewAllowed(nextView)) setActiveView(nextView);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    fetch(isAdmin ? '/api/meta/stats/' : '/api/meta/stats/?scope=mine')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setStats(data));
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!user || isViewAllowed(activeView)) return;
    setActiveView('overview');
    window.history.replaceState(null, '', '#overview');
  }, [user?.id, isAdmin, activeView]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadManagedUsers(false);
    void loadAuthIntegrations();
  }, [isAdmin]);

  useEffect(() => {
    if (!editingUserId) return;
    const current = managedUsers.find((item) => item.id === editingUserId);
    if (!current) {
      setEditingUserId(null);
      return;
    }
    setEditingUserDraft({ roleKey: current.roleKey, status: current.status || 'active' });
  }, [editingUserId, managedUsers]);

  useEffect(() => {
    if (partner) {
      setSelectedPartnerId(String(partner.id));
      return;
    }
    setSelectedPartnerId((value) => (
      value && partnerCandidates.some((item) => String(item.id) === value)
        ? value
        : String(partnerCandidates[0]?.id || '')
    ));
  }, [partner, partnerCandidates]);

  useEffect(() => {
    const stored = window.localStorage.getItem('love-next-admin-language');
    const nextLanguage = stored === 'zh-CN' || stored === 'en-US' ? stored : 'zh-CN';
    setAdminLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === 'en-US' ? 'en' : 'zh-CN';
    setSidebarCollapsed(window.localStorage.getItem('love-next-admin-sidebar') === 'collapsed');
  }, []);

  useEffect(() => {
    function closeFloatingPanels(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.admin-menu-wrap')) {
        setLanguageOpen(false);
        setUserMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setLanguageOpen(false);
      setUserMenuOpen(false);
      setNoticeOpen(false);
      setRoleManagerOpen(false);
      setEditingUserId(null);
      setConfirmUserAction(null);
      setConfirmRoleDeleteKey(null);
    }

    document.addEventListener('click', closeFloatingPanels);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeFloatingPanels);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const numericStats = useMemo(() => ({
    posts: Number(stats.posts || 0),
    likes: Number(stats.likes || 0),
    messages: Number(stats.messages || 0),
    events: Number(stats.events || 0),
    wishlist: Number(stats.wishlist || 0),
    stories: Number(stats.stories || 0),
    visits: Number(stats.visits || snapshot.visits || 0)
  }), [stats, snapshot.visits]);

  const totalContent = numericStats.posts + numericStats.events + numericStats.wishlist + numericStats.stories + numericStats.messages;
  const chartRows = [
    { label: '说说', value: numericStats.posts, tone: 'blue' },
    { label: '故事', value: numericStats.stories, tone: 'violet' },
    { label: '时光', value: numericStats.events, tone: 'teal' },
    { label: '心愿', value: numericStats.wishlist, tone: 'green' },
    { label: '悄悄话', value: numericStats.messages, tone: 'orange' }
  ];
  const maxChart = Math.max(...chartRows.map((item) => item.value), 1);
  const trendValues = [
    Math.max(1, Math.round(numericStats.posts * .36)),
    Math.max(1, Math.round(numericStats.posts * .54)),
    numericStats.events + numericStats.stories,
    totalContent,
    totalContent + Math.max(1, Math.round(numericStats.likes * .3)),
    totalContent + numericStats.likes
  ];
  const maxTrend = Math.max(...trendValues, 1);
  const trendPoints = trendValues
    .map((value, index) => `${index * 104},${168 - (value / maxTrend) * 124}`)
    .join(' ');
  const trendArea = `0,168 ${trendPoints} 520,168`;
  const editingUser = useMemo(
    () => managedUsers.find((item) => item.id === editingUserId) || null,
    [managedUsers, editingUserId]
  );
  const emojiPackCount = emojiPacks.length;
  const emojiItemCount = emojiPacks.reduce((total, pack) => total + pack.items.length, 0);
  const visitSummary = stats.visitSummary || {
    today: 0,
    week: 0,
    month: 0,
    year: 0,
    total: numericStats.visits,
    avgDuration: 0
  };
  const visitSeries = stats.visitSeries || [];
  const maxVisitSeries = Math.max(...visitSeries.map((item) => item.visits), 1);
  const topPages = stats.topPages || [];
  const regions = stats.regions || [];
  const devices = stats.devices || [];
  const recentVisits = stats.recentVisits || [];

  if (!user) {
    return (
      <section className="admin-login-gate">
        <div className="admin-login-card">
          <span><Shield size={22} /></span>
          <h1>进入管理控制台</h1>
          <p>登录后可以维护站点资料、账号安全和内容配置。</p>
          <Link className="admin-primary-action" href="/login/">去登录</Link>
        </div>
      </section>
    );
  }

  async function saveInfo(message = '站点设置已保存') {
    let payload = info;
    if (siteIconFiles[0]) {
      const form = new FormData();
      form.set('file', siteIconFiles[0]);
      const iconRes = await fetch('/api/meta/site-icon/', { method: 'POST', body: form });
      const iconData = await iconRes.json().catch(() => ({}));
      if (!iconRes.ok) {
        alert(iconData.error || '站点图标上传失败');
        return false;
      }
      payload = { ...info, siteIcon: iconData.siteIcon || info.siteIcon };
    }

    const res = await fetch('/api/meta/info/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '保存失败');
      return false;
    }
    if (res.ok) {
      setInfo({
        siteTitle: data.siteTitle || info.siteTitle,
        siteIcon: data.siteIcon || payload.siteIcon || '/site-icon.svg',
        togetherSince: data.togetherSince || '',
        imageMetaEnabled: data.imageMetaEnabled !== false,
        twikooEnvId: data.twikooEnvId || '',
        twikooRegion: data.twikooRegion ?? 'ap-shanghai',
        announcementEnabled: data.announcementEnabled === true,
        announcementTitle: data.announcementTitle || '',
        announcementContent: data.announcementContent || '',
        footerMessageUrl: data.footerMessageUrl || '',
        footerRssUrl: data.footerRssUrl || '',
        footerRewardUrl: data.footerRewardUrl || '',
        footerIcpNumber: data.footerIcpNumber || '',
        footerIcpUrl: data.footerIcpUrl || '',
        footerPoliceNumber: data.footerPoliceNumber || '',
        footerPoliceUrl: data.footerPoliceUrl || '',
        footerUptimeStatusUrl: data.footerUptimeStatusUrl || '',
        footerUptimeStatusPageUrl: data.footerUptimeStatusPageUrl || ''
      });
      setSiteIconFiles([]);
      setSiteIconPreviewMode('current');
      router.refresh();
    }
    if (message) alert(message);
    return true;
  }

  async function saveAnnouncement() {
    const saved = await saveInfo('公告设置已保存');
    if (saved) setNoticeOpen(false);
  }

  function mergeOAuthProviders(items: AuthProviderDraft[]) {
    return defaultOAuthProviders.map((fallback) => ({
      ...fallback,
      ...(items.find((item) => item.key === fallback.key) || {}),
      clientSecret: ''
    }));
  }

  async function loadAuthIntegrations() {
    const res = await fetch('/api/meta/auth-integrations/', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data) return;
    setAuthIntegrations({
      registrationEmailEnabled: data.registrationEmailEnabled === true,
      smtpHost: data.smtpHost || '',
      smtpPort: data.smtpPort || '465',
      smtpSecure: data.smtpSecure !== false,
      smtpUser: data.smtpUser || '',
      smtpFrom: data.smtpFrom || '',
      smtpPass: '',
      smtpPassConfigured: data.smtpPassConfigured === true,
      oauthProviders: mergeOAuthProviders(Array.isArray(data.oauthProviders) ? data.oauthProviders : [])
    });
  }

  function updateOAuthProvider(key: string, patch: Partial<AuthProviderDraft>) {
    setAuthIntegrations((current) => ({
      ...current,
      oauthProviders: current.oauthProviders.map((provider) => provider.key === key ? { ...provider, ...patch } : provider)
    }));
  }

  async function saveAuthIntegrations() {
    setAuthIntegrationsBusy(true);
    try {
      const res = await fetch('/api/meta/auth-integrations/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authIntegrations)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '认证配置保存失败');
      setAuthIntegrations({
        registrationEmailEnabled: data.registrationEmailEnabled === true,
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort || '465',
        smtpSecure: data.smtpSecure !== false,
        smtpUser: data.smtpUser || '',
        smtpFrom: data.smtpFrom || '',
        smtpPass: '',
        smtpPassConfigured: data.smtpPassConfigured === true,
        oauthProviders: mergeOAuthProviders(Array.isArray(data.oauthProviders) ? data.oauthProviders : [])
      });
      alert('登录与注册配置已保存');
    } finally {
      setAuthIntegrationsBusy(false);
    }
  }

  function selectAdminLanguage(language: AdminLanguage) {
    setAdminLanguage(language);
    document.documentElement.lang = language === 'en-US' ? 'en' : 'zh-CN';
    window.localStorage.setItem('love-next-admin-language', language);
    setLanguageOpen(false);
  }

  function toggleAdminTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('love-next-theme', next);
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('love-next-admin-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }

  async function logout() {
    await signOut({ redirect: false });
    await refresh();
    router.push('/login/');
  }

  async function saveEmoji() {
    const res = await fetch('/api/meta/emoji-packs/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packs: emojiPacks })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || '表情包保存失败');
    setEmojiPacks(data.packs || []);
    router.refresh();
  }

  function makeEmojiItem(value: string, fallbackLabel = '表情'): EmojiItemDraft | null {
    const raw = value.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
      const guessedName = raw.split(/[/?#]/).filter(Boolean).pop()?.replace(/\.[a-z0-9]+$/i, '') || fallbackLabel;
      return { label: guessedName.slice(0, 24), url: raw };
    }
    return raw.slice(0, 120) as EmojiItemDraft;
  }

  function updateEmojiPack(index: number, patch: Partial<EmojiPackDraft>) {
    setEmojiPacks((current) => current.map((pack, itemIndex) => (
      itemIndex === index ? { ...pack, ...patch } : pack
    )));
  }

  function addEmojiItems(index: number) {
    const draft = emojiItemDrafts[index] || '';
    const packName = emojiPacks[index]?.name || '表情';
    const items = draft
      .split(/\r?\n|,/)
      .map((item) => makeEmojiItem(item, packName))
      .filter((item): item is EmojiItemDraft => Boolean(item));
    if (!items.length) return;
    setEmojiPacks((current) => current.map((pack, itemIndex) => (
      itemIndex === index ? { ...pack, items: pack.items.concat(items).slice(0, 120) } : pack
    )));
    setEmojiItemDrafts((current) => ({ ...current, [index]: '' }));
  }

  function removeEmojiItem(packIndex: number, itemIndex: number) {
    setEmojiPacks((current) => current
      .map((pack, index) => index === packIndex ? {
        ...pack,
        items: pack.items.filter((_, currentIndex) => currentIndex !== itemIndex)
      } : pack)
      .filter((pack) => pack.items.length));
  }

  function removeEmojiPack(index: number) {
    setEmojiPacks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function importEmojiPack() {
    const source = emojiImport.source.trim();
    if (!source) return alert('请粘贴表情包 JSON、JSON 链接或图片链接');
    setEmojiImportBusy(true);
    try {
      const res = await fetch('/api/meta/emoji-packs/import/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, name: emojiImport.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '表情包导入失败');
      const packs = Array.isArray(data.packs) ? data.packs : [];
      if (!packs.length) return alert('没有识别到可用表情项');
      setEmojiPacks((current) => current.concat(packs).slice(0, 12));
      setEmojiImport({ name: '', source: '' });
    } finally {
      setEmojiImportBusy(false);
    }
  }

  function emojiLabel(item: EmojiItemDraft) {
    return typeof item === 'string' ? item : item.label || item.text || '表情';
  }

  async function saveProfile() {
    const profilePayload: Record<string, string> = {
      displayName: profile.displayName,
      avatar: profile.avatar
    };
    if (profile.password.trim()) {
      profilePayload.password = profile.password;
      profilePayload.securityCode = profile.securityCode;
    }
    const res = await fetch('/api/auth/me/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profilePayload)
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || '保存失败');
    if (avatarFiles[0]) {
      const form = new FormData();
      form.set('avatarImage', avatarFiles[0]);
      const avatarRes = await fetch('/api/auth/me/avatar/', { method: 'POST', body: form });
      if (!avatarRes.ok) return alert((await avatarRes.json()).error || '头像上传失败');
    }
    if (avatarUrl.trim()) {
      const avatarRes = await fetch('/api/auth/me/avatar-url/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: avatarUrl })
      });
      if (!avatarRes.ok) return alert((await avatarRes.json()).error || '头像 URL 保存失败');
    }
    setAvatarFiles([]);
    setAvatarUrl('');
    setProfile((value) => ({
      ...value,
      displayName: data.user?.displayName || value.displayName,
      avatar: data.user?.avatar || value.avatar,
      password: '',
      securityCode: ''
    }));
    await refresh();
    router.refresh();
    alert('资料已保存');
  }

  async function bindPartner() {
    const partnerId = Number(selectedPartnerId);
    if (!partnerId) return alert('请选择情侣账号');
    setPartnerBusy(true);
    try {
      const res = await fetch('/api/auth/me/partner/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '情侣账号绑定失败');
      await refresh();
      router.refresh();
      alert('情侣账号已绑定');
    } finally {
      setPartnerBusy(false);
    }
  }

  async function unbindPartner() {
    if (partner && !window.confirm(`确定解除和 ${partner.displayName} 的情侣绑定吗？`)) return;
    setPartnerBusy(true);
    try {
      const res = await fetch('/api/auth/me/partner/', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '情侣账号解绑失败');
      setSelectedPartnerId('');
      await refresh();
      router.refresh();
      alert('情侣账号已解绑');
    } finally {
      setPartnerBusy(false);
    }
  }

  async function saveSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const res = await fetch('/api/meta/security-code/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentCode: formData.get('currentCode'), newCode: formData.get('newCode') })
    });
    const data = await res.json();
    if (res.ok) form.reset();
    if (!res.ok) return alert(data.error || '安全码保存失败');
    alert('安全码已更新');
  }

  async function loadManagedUsers(showBusy = true) {
    if (!isAdmin) return;
    if (showBusy) setUsersBusy(true);
    try {
      const res = await fetch('/api/admin/users/', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '用户管理加载失败');
      setRoles(data.roles || []);
      setManagedUsers(data.users || []);
    } finally {
      if (showBusy) setUsersBusy(false);
    }
  }

  async function saveRoles(nextRoles = roles, showAlert = true) {
    const cleanedRoles = nextRoles.map((role) => {
      const key = cleanRoleKey(role.key);
      return {
        key,
        name: role.name.trim().slice(0, 24),
        canAdmin: key === 'admin'
      };
    });
    if (cleanedRoles.some((role) => !role.key || !role.name)) return alert('分组标识和名称不能为空');
    if (!cleanedRoles.some((role) => role.key === 'admin')) return alert('必须保留管理员分组');

    setUsersBusy(true);
    try {
      const res = await fetch('/api/admin/users/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: cleanedRoles })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '用户分组保存失败');
      setRoles(data.roles || cleanedRoles);
      setManagedUsers(data.users || []);
      router.refresh();
      if (showAlert) alert('用户分组已保存');
    } finally {
      setUsersBusy(false);
    }
  }

  async function addRole() {
    const key = cleanRoleKey(newRole.key);
    const name = newRole.name.trim().slice(0, 24);
    if (!key || !name) return alert('请填写分组标识和名称');
    if (roles.some((role) => role.key === key)) return alert('这个分组标识已经存在');
    const nextRoles = roles.concat({ key, name, canAdmin: false });
    setNewRole({ key: '', name: '' });
    await saveRoles(nextRoles, false);
  }

  function updateRoleName(key: string, name: string) {
    setRoles((current) => current.map((role) => role.key === key ? { ...role, name } : role));
  }

  async function updateManagedUser(userId: number, payload: { roleKey?: string; status?: string }) {
    setUsersBusy(true);
    try {
      const res = await fetch('/api/admin/users/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '用户管理更新失败');
      setRoles(data.roles || roles);
      setManagedUsers(data.users || []);
      if (user && userId === user.id) await refresh();
      router.refresh();
    } finally {
      setUsersBusy(false);
    }
  }

  function openUserEditor(item: ManagedUser) {
    setConfirmUserAction(null);
    setEditingUserDraft({ roleKey: item.roleKey, status: item.status || 'active' });
    setEditingUserId(item.id);
  }

  function closeUserEditor() {
    setEditingUserId(null);
    setConfirmUserAction(null);
  }

  async function saveUserEditor() {
    if (!editingUser) return;
    await updateManagedUser(editingUser.id, {
      roleKey: editingUserDraft.roleKey,
      status: editingUserDraft.status
    });
    setEditingUserId(null);
    setConfirmUserAction(null);
  }

  async function deleteManagedUser(userId: number) {
    setUsersBusy(true);
    try {
      const res = await fetch(`/api/admin/users/?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || '删除用户失败');
      setRoles(data.roles || roles);
      setManagedUsers(data.users || []);
      closeUserEditor();
      router.refresh();
    } finally {
      setUsersBusy(false);
    }
  }

  async function runConfirmedUserAction(userId: number, action: 'ban' | 'unban' | 'delete') {
    if (confirmUserAction?.userId !== userId || confirmUserAction.action !== action) {
      setConfirmUserAction({ userId, action });
      return;
    }
    if (action === 'delete') {
      await deleteManagedUser(userId);
      return;
    }
    await updateManagedUser(userId, { status: action === 'ban' ? 'banned' : 'active' });
    setEditingUserDraft((value) => ({ ...value, status: action === 'ban' ? 'banned' : 'active' }));
    setConfirmUserAction(null);
  }

  async function removeRole(key: string) {
    if (key === 'admin' || key === 'user') return alert('基础分组不能删除');
    if (confirmRoleDeleteKey !== key) {
      setConfirmRoleDeleteKey(key);
      return;
    }
    const nextRoles = roles.filter((role) => role.key !== key);
    await saveRoles(nextRoles, false);
    setConfirmRoleDeleteKey(null);
  }

  function openAdminView(view: AdminView) {
    if (!isViewAllowed(view)) {
      setActiveView('overview');
      window.history.replaceState(null, '', '#overview');
      return;
    }
    setActiveView(view);
    window.history.replaceState(null, '', `#${adminViewHashes[view]}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isContentView = contentViews.includes(activeView as AdminContentView) && isViewAllowed(activeView);
  const contentNavItems: Array<{ view: AdminContentView; icon: ReactNode; label: string }> = [
    { view: 'posts', icon: <MessageSquare size={16} />, label: copy.nav.posts },
    { view: 'stories', icon: <FileText size={16} />, label: copy.nav.stories },
    { view: 'events', icon: <CalendarDays size={16} />, label: copy.nav.events },
    { view: 'wishlist', icon: <ListChecks size={16} />, label: copy.nav.wishlist },
    { view: 'messages', icon: <ImageIcon size={16} />, label: copy.nav.messages }
  ];
  const navButton = (view: AdminView, icon: ReactNode, label: string, className = '') => (
    <button
      key={view}
      type="button"
      aria-label={label}
      title={label}
      className={`${activeView === view ? 'active' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => openAdminView(view)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  const renderSettingsWorkbench = ({
    id,
    action,
    countLabel,
    meta,
    children,
    className = ''
  }: {
    id: string;
    action?: ReactNode;
    countLabel: string;
    meta?: ReactNode;
    children: ReactNode;
    className?: string;
  }) => (
    <section className="admin-view-grid">
      <article id={id} className={`admin-panel admin-content-manager admin-settings-workbench${className ? ` ${className}` : ''}`}>
        <header className="admin-manager-head action-only">
          {action && <div className="admin-panel-toolbar">{action}</div>}
        </header>
        <div className="admin-manager-grid">
          <section className="admin-manager-list admin-settings-list">
            <div className="admin-list-toolbar">
              <span>{countLabel}</span>
              {meta && <div className="admin-settings-toolbar-meta">{meta}</div>}
            </div>
            <div className="admin-settings-canvas">
              {children}
            </div>
          </section>
        </div>
      </article>
    </section>
  );

  return (
    <>
    <section className={sidebarCollapsed ? 'admin-console sidebar-collapsed' : 'admin-console'}>
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/">
          <span><Sparkles size={23} /></span>
          <strong>{info.siteTitle || '小星球'}</strong>
        </Link>

        <nav className="admin-side-nav" aria-label="后台导航">
          {navButton('overview', <LayoutDashboard size={18} />, copy.nav.overview)}
          <div className={`admin-nav-group ${isContentView ? 'active' : ''}`}><MessageSquare size={18} /><span>{isAdmin ? copy.nav.data : copy.nav.mine}</span></div>
          <div className="admin-sub-nav" aria-label={isAdmin ? '全站数据细分' : '我的内容细分'}>
            {contentNavItems
              .filter((item) => isViewAllowed(item.view))
              .map((item) => navButton(item.view, item.icon, item.label))}
          </div>
          {isAdmin && navButton('site', <SlidersHorizontal size={18} />, copy.nav.site)}
          {isAdmin && navButton('emoji', <Braces size={18} />, copy.nav.emoji)}
          {navButton('profile', <UserCog size={18} />, copy.nav.profile)}
          {isAdmin && navButton('stats', <BarChart3 size={18} />, copy.nav.stats)}
          {isAdmin && navButton('users', <Users size={18} />, copy.nav.users)}
          <Link className="admin-return-link" href="/" aria-label={copy.nav.home} title={copy.nav.home}><Home size={18} /><span>{copy.nav.home}</span></Link>
        </nav>
        <div className="admin-sidebar-dock">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar actions-only">
          <div className="admin-top-actions">
            <button type="button"><BookOpen size={17} />{copy.top.guide}</button>
            <div className="admin-menu-wrap">
              <button
                type="button"
                className={languageOpen ? 'active' : ''}
                onClick={() => {
                  setLanguageOpen((value) => !value);
                  setUserMenuOpen(false);
                }}
                aria-expanded={languageOpen}
                aria-haspopup="menu"
              >
                <Languages size={17} />{adminLanguages[adminLanguage].label}<ChevronDown size={15} />
              </button>
              {languageOpen && (
                <div className="admin-popover" role="menu">
                  {(Object.keys(adminLanguages) as AdminLanguage[]).map((language) => (
                    <button
                      key={language}
                      type="button"
                      className={adminLanguage === language ? 'selected' : ''}
                      onClick={() => selectAdminLanguage(language)}
                      role="menuitemradio"
                      aria-checked={adminLanguage === language}
                    >
                      <b>{adminLanguages[language].label}</b>
                      <span>{adminLanguages[language].description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={toggleAdminTheme}><Moon size={17} />{copy.top.dark}</button>
            <button
              type="button"
              className={info.announcementEnabled ? 'notice-enabled' : ''}
              onClick={() => setNoticeOpen(true)}
            >
              <Bell size={17} />{copy.top.notice}
            </button>
            <div className="admin-balance"><CreditCard size={17} /><b>{numberText(numericStats.visits)}</b><span>{copy.top.visits}</span></div>
            <div className="admin-menu-wrap user">
              <button
                type="button"
                className="admin-user-chip"
                onClick={() => {
                  setUserMenuOpen((value) => !value);
                  setLanguageOpen(false);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {user.avatarImage ? <img src={user.avatarImage} alt="" /> : <span>{user.avatar || user.displayName.slice(0, 1)}</span>}
                <b>{user.displayName}</b>
                <ChevronDown size={15} />
              </button>
              {userMenuOpen && (
                <div className="admin-popover admin-user-popover" role="menu">
                  <div className="admin-user-summary">
                    {user.avatarImage ? <img src={user.avatarImage} alt="" /> : <span>{user.avatar || user.displayName.slice(0, 1)}</span>}
                    <div>
                      <b>{user.displayName}</b>
                      <small>@{user.username}</small>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setUserMenuOpen(false); openAdminView('profile'); }} role="menuitem">
                    <UserCog size={16} />{copy.top.profile}
                  </button>
                  <Link href="/" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <Home size={16} />{copy.top.home}
                  </Link>
                  <button type="button" className="danger" onClick={logout} role="menuitem">
                    <LogOut size={16} />{copy.top.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content" id={adminViewHashes[activeView]}>
          {activeView === 'overview' && (
            <>
              <section className="admin-metric-grid">
                <article className="admin-metric-card featured">
                  <span><CreditCard size={17} />访问量</span>
                  <strong>{numberText(numericStats.visits)}</strong>
                  <small>累计站点访问</small>
                </article>
                <article className="admin-metric-card">
                  <span><MessageSquare size={17} />内容总量</span>
                  <strong>{numberText(totalContent)}</strong>
                  <small>{numberText(numericStats.posts)} 条说说</small>
                </article>
                <article className="admin-metric-card success">
                  <span><Shield size={17} />安全状态</span>
                  <strong>{stats.hasSecurityCode ? '已启用' : '待设置'}</strong>
                  <small>{stats.hasSecurityCode ? '安全码已配置' : '建议立即配置'}</small>
                </article>
                <article className="admin-metric-card compact">
                  <span><Zap size={17} />点赞数</span>
                  <strong>{numberText(numericStats.likes)}</strong>
                </article>
                <article className="admin-metric-card compact">
                  <span><Radio size={17} />时光记录</span>
                  <strong>{numberText(numericStats.events)}</strong>
                </article>
                <article className="admin-metric-card compact">
                  <span><Users size={17} />成员</span>
                  <strong>{numberText(snapshot.users.length)}</strong>
                </article>
                <article className="admin-metric-card compact">
                  <span><Globe2 size={17} />EXIF 识别</span>
                  <strong>{info.imageMetaEnabled ? '开启' : '关闭'}</strong>
                </article>
              </section>

              <section className="admin-view-grid overview">
                <article className="admin-panel chart-panel">
                  <div className="admin-line-chart">
                    <svg viewBox="0 0 520 190" role="img" aria-label="内容趋势图">
                      <polygon points={trendArea} />
                      <polyline points={trendPoints} />
                      {trendValues.map((value, index) => (
                        <circle key={`${value}-${index}`} cx={index * 104} cy={168 - (value / maxTrend) * 124} r="4" />
                      ))}
                    </svg>
                  </div>
                  <div className="admin-bar-list">
                    {chartRows.map((item) => (
                      <div key={item.label} className={`admin-bar-row ${item.tone}`}>
                        <span>{item.label}</span>
                        <i><b style={{ width: `${Math.max(8, (item.value / maxChart) * 100)}%` }} /></i>
                        <strong>{numberText(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="admin-panel system-panel">
                  <ul>
                    <li><span>数据库</span><b>Prisma / PostgreSQL</b></li>
                    <li><span>对象存储</span><b>S3 / R2</b></li>
                    <li><span>认证方案</span><b>NextAuth Credentials</b></li>
                    <li><span>图片元数据</span><b>{info.imageMetaEnabled ? '启用' : '关闭'}</b></li>
                  </ul>
                </article>
              </section>
            </>
          )}

          {isContentView && (
            <AdminContentManager
              initialPosts={snapshot.posts}
              initialEvents={snapshot.events}
              initialWishlist={snapshot.wishlist}
              emojiPacks={snapshot.emojiPacks}
              activeView={activeView as AdminContentView}
              canAdmin={isAdmin}
              scope={isAdmin ? 'all' : 'mine'}
            />
          )}

          {isAdmin && activeView === 'site' && (
            renderSettingsWorkbench({
              id: 'site',
              countLabel: '5 组基础配置',
              meta: <span>站点 / 图标 / 评论 / 页脚 / EXIF</span>,
              action: (
                <button className="admin-tool-button primary" type="button" onClick={() => void saveInfo()}>
                  <Save size={16} />保存
                </button>
              ),
              children: (
                <div className="admin-settings-section-grid">
                  <section className="admin-settings-subpanel site-identity-panel">
                    <div className="admin-section-title">
                      <h3>站点身份</h3>
                      <p>标题、纪念日和站点图标会同步到前台导航与浏览器标签。</p>
                    </div>
                    <div className="admin-form-grid compact">
                      <label className="admin-field"><span>站点标题</span><input value={info.siteTitle} onChange={(event) => setInfo({ ...info, siteTitle: event.target.value })} /></label>
                      <label className="admin-field"><span>在一起日期</span><input type="date" value={info.togetherSince} onChange={(event) => setInfo({ ...info, togetherSince: event.target.value })} /></label>
                    </div>
                    <div className="admin-site-icon-row">
                      <div className="admin-site-icon-card">
                        <span>当前站点图标</span>
                        {siteIconPreviewMode === 'fallback' ? (
                          <i className="admin-site-icon-fallback"><Sparkles size={30} /></i>
                        ) : (
                          <img
                            src={siteIconPreviewMode === 'default' ? '/site-icon.svg' : info.siteIcon || '/site-icon.svg'}
                            alt=""
                            onError={() => setSiteIconPreviewMode((current) => (
                              current === 'current' && (info.siteIcon || '/site-icon.svg') !== '/site-icon.svg' ? 'default' : 'fallback'
                            ))}
                          />
                        )}
                      </div>
                      <div className="admin-site-icon-uploader">
                        <MediaDropzone
                          files={siteIconFiles}
                          onFiles={setSiteIconFiles}
                          urls={info.siteIcon}
                          onUrls={(value) => {
                            setInfo({ ...info, siteIcon: value });
                            setSiteIconPreviewMode('current');
                          }}
                          multiple={false}
                          accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon,.ico"
                          fieldLabel="站点图标链接"
                          label="上传图标"
                          urlLabel="粘贴图标 URL，留空将使用默认图标"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="admin-settings-subpanel">
                    <div className="admin-section-title">
                      <h3>评论服务</h3>
                      <p>前台留言和故事评论会读取这里的 Twikoo 服务配置。</p>
                    </div>
                    <div className="admin-form-grid compact">
                      <label className="admin-field full"><span>Twikoo 环境 ID / 服务地址</span><input value={info.twikooEnvId} onChange={(event) => setInfo({ ...info, twikooEnvId: event.target.value })} placeholder="腾讯云 envId 或 https://xxx.vercel.app" /></label>
                      <label className="admin-field"><span>Twikoo 地域</span><select value={info.twikooRegion} onChange={(event) => setInfo({ ...info, twikooRegion: event.target.value })}>
                        <option value="ap-shanghai">ap-shanghai</option>
                        <option value="ap-guangzhou">ap-guangzhou</option>
                        <option value="">Vercel 服务地址不填</option>
                      </select></label>
                    </div>
                  </section>

                  <section className="admin-settings-subpanel">
                    <div className="admin-section-title">
                      <h3>图片功能</h3>
                      <p>控制说说和时光图片的参数识别开关。</p>
                    </div>
                    <div className="admin-switch-row inline">
                      <label><input type="checkbox" checked={info.imageMetaEnabled} onChange={(event) => setInfo({ ...info, imageMetaEnabled: event.target.checked })} />自动识别 EXIF</label>
                    </div>
                  </section>

                  <section className="admin-settings-subpanel auth-integration-panel full">
                    <div className="admin-section-title">
                      <h3>登录与注册</h3>
                      <p>配置邮箱验证码注册和第三方账号登录；Secret 留空保存时会沿用原值。</p>
                    </div>
                    <div className="admin-switch-row inline">
                      <label>
                        <input
                          type="checkbox"
                          checked={authIntegrations.registrationEmailEnabled}
                          onChange={(event) => setAuthIntegrations({ ...authIntegrations, registrationEmailEnabled: event.target.checked })}
                        />
                        新用户注册需要邮箱验证码
                      </label>
                      {authIntegrations.smtpPassConfigured && <span className="admin-muted-pill">SMTP 密码已保存</span>}
                    </div>
                    <div className="admin-form-grid compact">
                      <label className="admin-field"><span>SMTP 主机</span><input value={authIntegrations.smtpHost} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpHost: event.target.value })} placeholder="smtp.example.com" /></label>
                      <label className="admin-field"><span>SMTP 端口</span><input value={authIntegrations.smtpPort} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpPort: event.target.value })} placeholder="465" /></label>
                      <label className="admin-field"><span>SMTP 账号</span><input value={authIntegrations.smtpUser} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpUser: event.target.value })} placeholder="admin@example.com" /></label>
                      <label className="admin-field"><span>发件人</span><input value={authIntegrations.smtpFrom} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpFrom: event.target.value })} placeholder="我们的星球 <admin@example.com>" /></label>
                      <label className="admin-field"><span>SMTP 密码</span><input type="password" value={authIntegrations.smtpPass} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpPass: event.target.value })} placeholder={authIntegrations.smtpPassConfigured ? '留空沿用已保存密码' : '邮箱授权码或 SMTP 密码'} /></label>
                      <label className="admin-field checkbox-field"><span>安全连接</span><label><input type="checkbox" checked={authIntegrations.smtpSecure} onChange={(event) => setAuthIntegrations({ ...authIntegrations, smtpSecure: event.target.checked })} /> SSL/TLS</label></label>
                    </div>
                    <div className="oauth-provider-settings">
                      {authIntegrations.oauthProviders.map((provider) => (
                        <article className={provider.key === 'qq' || provider.key === 'wechat' ? 'oauth-provider-card is-reserved' : 'oauth-provider-card'} key={provider.key}>
                          <header>
                            <label>
                              <input
                                type="checkbox"
                                checked={provider.enabled}
                                onChange={(event) => updateOAuthProvider(provider.key, { enabled: event.target.checked })}
                                disabled={provider.key === 'qq' || provider.key === 'wechat'}
                              />
                              <b>{provider.name}</b>
                            </label>
                            {provider.hasSecret && <span>Secret 已保存</span>}
                          </header>
                          {provider.key === 'qq' || provider.key === 'wechat' ? (
                            <p>需要开放平台应用和专用 OAuth 适配，当前先预留入口。</p>
                          ) : (
                            <div className="admin-form-grid compact">
                              <label className="admin-field"><span>Client ID</span><input value={provider.clientId} onChange={(event) => updateOAuthProvider(provider.key, { clientId: event.target.value })} /></label>
                              <label className="admin-field"><span>Client Secret</span><input type="password" value={provider.clientSecret || ''} onChange={(event) => updateOAuthProvider(provider.key, { clientSecret: event.target.value })} placeholder={provider.hasSecret ? '留空沿用已保存 Secret' : '粘贴 Client Secret'} /></label>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="admin-inline-actions">
                      <button className="admin-tool-button primary" type="button" onClick={saveAuthIntegrations} disabled={authIntegrationsBusy}>
                        <Save size={16} />{authIntegrationsBusy ? '保存中' : '保存登录配置'}
                      </button>
                    </div>
                  </section>

                  <section className="admin-footer-settings full" aria-label="页脚配置">
                      <div className="admin-section-title">
                        <h3>页脚配置</h3>
                        <p>留言、RSS、打赏、备案与 UptimeStatus 监测均为可选项，留空则前台不显示。</p>
                      </div>
                      <div className="admin-form-grid compact">
                        <label className="admin-field"><span>留言链接</span><input value={info.footerMessageUrl} onChange={(event) => setInfo({ ...info, footerMessageUrl: event.target.value })} placeholder="/comment/" /></label>
                        <label className="admin-field"><span>RSS 订阅链接</span><input value={info.footerRssUrl} onChange={(event) => setInfo({ ...info, footerRssUrl: event.target.value })} placeholder="/rss.xml 或 https://..." /></label>
                        <label className="admin-field"><span>打赏链接</span><input value={info.footerRewardUrl} onChange={(event) => setInfo({ ...info, footerRewardUrl: event.target.value })} placeholder="打赏页或收款码页面 URL" /></label>
                        <label className="admin-field"><span>ICP备案号</span><input value={info.footerIcpNumber} onChange={(event) => setInfo({ ...info, footerIcpNumber: event.target.value })} placeholder="例如：京ICP备19051325号-2" /></label>
                        <label className="admin-field"><span>ICP备案链接</span><input value={info.footerIcpUrl} onChange={(event) => setInfo({ ...info, footerIcpUrl: event.target.value })} placeholder="https://beian.miit.gov.cn/" /></label>
                        <label className="admin-field"><span>网安备案号</span><input value={info.footerPoliceNumber} onChange={(event) => setInfo({ ...info, footerPoliceNumber: event.target.value })} placeholder="例如：京公网安备11011402054421号" /></label>
                        <label className="admin-field"><span>网安备案链接</span><input value={info.footerPoliceUrl} onChange={(event) => setInfo({ ...info, footerPoliceUrl: event.target.value })} placeholder="公安备案详情页 URL" /></label>
                        <label className="admin-field"><span>UptimeStatus 监测地址</span><input value={info.footerUptimeStatusUrl} onChange={(event) => setInfo({ ...info, footerUptimeStatusUrl: event.target.value })} placeholder="UptimeStatus 提供的 JSON / 状态 / Badge 地址" /></label>
                        <label className="admin-field full"><span>UptimeStatus 状态页链接</span><input value={info.footerUptimeStatusPageUrl} onChange={(event) => setInfo({ ...info, footerUptimeStatusPageUrl: event.target.value })} placeholder="点击状态文案时跳转的公开状态页，可留空" /></label>
                      </div>
                  </section>
                </div>
              )
            })
          )}

          {isAdmin && activeView === 'stats' && (
            renderSettingsWorkbench({
              id: 'stats',
              countLabel: '访问统计',
              meta: <span>页面 / 时长 / 地区 / 设备</span>,
              children: (
                <div className="visit-analytics">
                  <section className="visit-summary-grid">
                    <article><span>今日</span><b>{numberText(visitSummary.today)}</b></article>
                    <article><span>本周</span><b>{numberText(visitSummary.week)}</b></article>
                    <article><span>本月</span><b>{numberText(visitSummary.month)}</b></article>
                    <article><span>本年</span><b>{numberText(visitSummary.year)}</b></article>
                    <article><span>累计</span><b>{numberText(visitSummary.total)}</b></article>
                    <article><span>平均停留</span><b>{durationText(visitSummary.avgDuration)}</b></article>
                  </section>

                  <section className="visit-analytics-grid">
                    <article className="visit-panel visit-trend-panel">
                      <div className="admin-section-title">
                        <h3>每日访问</h3>
                        <p>最近 14 天访问量趋势。</p>
                      </div>
                      <div className="visit-trend-bars">
                        {visitSeries.map((item) => (
                          <div key={item.label} className="visit-trend-item">
                            <i style={{ height: `${Math.max(8, (item.visits / maxVisitSeries) * 100)}%` }} />
                            <span>{item.label}</span>
                            <b>{numberText(item.visits)}</b>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="visit-panel">
                      <div className="admin-section-title">
                        <h3>访问网页</h3>
                        <p>按访问量排序的页面。</p>
                      </div>
                      <div className="visit-list">
                        {topPages.length ? topPages.map((item) => (
                          <div key={item.path} className="visit-row">
                            <span>{item.path}</span>
                            <b>{numberText(item.views)} 次</b>
                            <small>{durationText(item.avgDuration)}</small>
                          </div>
                        )) : <div className="visit-empty">暂无页面访问明细</div>}
                      </div>
                    </article>

                    <article className="visit-panel">
                      <div className="admin-section-title">
                        <h3>访问地区</h3>
                        <p>根据部署平台提供的访问地区头统计。</p>
                      </div>
                      <div className="visit-list">
                        {regions.length ? regions.map((item) => (
                          <div key={item.region} className="visit-row">
                            <span>{item.region}</span>
                            <b>{numberText(item.visits)} 次</b>
                          </div>
                        )) : <div className="visit-empty">暂无地区数据</div>}
                      </div>
                    </article>

                    <article className="visit-panel">
                      <div className="admin-section-title">
                        <h3>设备类型</h3>
                        <p>区分移动端、平板和电脑端。</p>
                      </div>
                      <div className="visit-device-list">
                        {devices.length ? devices.map((item) => (
                          <div key={`${item.type}-${item.detail}`} className="visit-device-row">
                            <span>{item.type}</span>
                            <b>{numberText(item.visits)}</b>
                            {item.detail && <small>{item.detail}</small>}
                          </div>
                        )) : <div className="visit-empty">暂无设备数据</div>}
                      </div>
                    </article>

                    <article className="visit-panel visit-recent-panel">
                      <div className="admin-section-title">
                        <h3>最近访问</h3>
                        <p>包含访问页面、地区、设备和停留时长。</p>
                      </div>
                      <div className="visit-table">
                        {recentVisits.length ? recentVisits.map((item, index) => (
                          <div key={`${item.createdAt}-${index}`} className="visit-table-row">
                            <span>{item.path}</span>
                            <span>{item.region}</span>
                            <span>{item.device}</span>
                            <b>{durationText(item.duration)}</b>
                          </div>
                        )) : <div className="visit-empty">暂无最近访问</div>}
                      </div>
                    </article>
                  </section>
                </div>
              ),
              className: 'visit-stats-workbench'
            })
          )}

          {activeView === 'profile' && (
            renderSettingsWorkbench({
              id: 'profile',
              countLabel: isAdmin ? '4 组账号配置' : '3 组账号配置',
              meta: <span>{stats.hasSecurityCode ? '安全码已启用' : partner ? `已绑定 ${partner.displayName}` : `${partnerCandidates.length} 个可绑定账号`}</span>,
              action: (
                <button className="admin-tool-button primary" type="button" onClick={saveProfile}>
                  <Save size={16} />保存资料
                </button>
              ),
              children: (
                <div className="admin-account-grid">
                  <section className="admin-settings-subpanel">
                    <div className="admin-section-title">
                      <h3>账号资料</h3>
                      <p>维护昵称、备用表情头像和登录密码。</p>
                    </div>
                    <div className="admin-form-stack">
                      <label className="admin-field"><span>昵称</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label>
                      <label className="admin-field"><span>备用表情头像</span><input value={profile.avatar} onChange={(event) => setProfile({ ...profile, avatar: event.target.value })} /></label>
                      <label className="admin-field"><span>新密码</span><input value={profile.password} onChange={(event) => setProfile({ ...profile, password: event.target.value })} type="password" placeholder="不修改可留空" /></label>
                      <label className="admin-field"><span>安全码</span><input value={profile.securityCode} onChange={(event) => setProfile({ ...profile, securityCode: event.target.value })} type="password" placeholder="改密码时需要" /></label>
                    </div>
                  </section>

                  <section className="admin-settings-subpanel avatar-panel">
                    <div className="admin-section-title">
                      <h3>头像图片</h3>
                      <p>支持上传本地图片或粘贴网络图片链接。</p>
                    </div>
                    <MediaDropzone
                      files={avatarFiles}
                      onFiles={setAvatarFiles}
                      urls={avatarUrl}
                      onUrls={setAvatarUrl}
                      multiple={false}
                      fieldLabel="头像图片 URL"
                      label="上传头像"
                      urlLabel="粘贴头像图片 URL"
                    />
                  </section>

                  <section className="admin-settings-subpanel partner-panel">
                    <div className="admin-section-title">
                      <h3><HeartHandshake size={18} />情侣账号</h3>
                      <p>绑定后，前台会优先展示你们这组情侣账号，个人登录权限保持不变。</p>
                    </div>
                    <div className="partner-bind-body">
                      {partner ? (
                        <div className="partner-current-card">
                          <div className="user-role-avatar">
                            {partner.avatarImage ? <img src={partner.avatarImage} alt="" /> : <span>{partner.avatar || partner.displayName.slice(0, 1)}</span>}
                          </div>
                          <div className="user-role-main">
                            <b>{partner.displayName}</b>
                            <span>@{partner.username}</span>
                          </div>
                          <button className="admin-tool-button danger" type="button" onClick={unbindPartner} disabled={partnerBusy}>
                            <Unlink2 size={16} />解除绑定
                          </button>
                        </div>
                      ) : (
                        <>
                          <label className="admin-field">
                            <span>选择情侣账号</span>
                            <select value={selectedPartnerId} onChange={(event) => setSelectedPartnerId(event.target.value)} disabled={partnerBusy || partnerCandidates.length === 0}>
                              {partnerCandidates.length === 0 ? (
                                <option value="">暂无可绑定账号</option>
                              ) : partnerCandidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>{candidate.displayName} @{candidate.username}</option>
                              ))}
                            </select>
                          </label>
                          <button className="admin-tool-button primary" type="button" onClick={bindPartner} disabled={partnerBusy || !selectedPartnerId}>
                            <HeartHandshake size={16} />绑定情侣账号
                          </button>
                        </>
                      )}
                    </div>
                  </section>

                  {isAdmin && (
                    <section className="admin-settings-subpanel account-security-panel">
                      <div className="admin-section-title">
                        <h3><Shield size={18} />安全码</h3>
                        <p>安全码用于敏感资料和密码变更验证。</p>
                      </div>
                      <form id="security-code-form" onSubmit={saveSecurity} className="admin-form-stack">
                        <label className="admin-field"><span>当前安全码</span><input name="currentCode" type="password" placeholder="首次可空" /></label>
                        <label className="admin-field"><span>新安全码</span><input name="newCode" type="password" placeholder="至少 4 位" /></label>
                        <button className="admin-tool-button primary" type="submit">
                          <Save size={16} />更新安全码
                        </button>
                      </form>
                      <div className="admin-status-note">
                        <Shield size={17} />
                        <span>{stats.hasSecurityCode ? '当前安全码已启用。' : '当前未设置安全码。'}</span>
                      </div>
                    </section>
                  )}
                </div>
              )
            })
          )}

          {isAdmin && activeView === 'emoji' && (
            renderSettingsWorkbench({
              id: 'emoji',
              countLabel: `${emojiPackCount} 组表情包`,
              meta: <span>{emojiItemCount} 个表情项</span>,
              action: (
                <button className="admin-tool-button primary" type="button" onClick={saveEmoji}>
                  <Save size={16} />保存
                </button>
              ),
              children: (
                <div className="emoji-store">
                  <section className="emoji-store-import">
                    <div className="admin-section-title">
                      <h3>表情商店</h3>
                      <p>支持粘贴网络 JSON、JSON 链接、图片链接或多行表情内容。</p>
                    </div>
                    <div className="emoji-import-grid">
                      <label className="admin-field"><span>表情包名称</span><input value={emojiImport.name} onChange={(event) => setEmojiImport({ ...emojiImport, name: event.target.value })} placeholder="例如：猫猫贴纸" /></label>
                      <label className="admin-field full"><span>表情来源</span><textarea value={emojiImport.source} onChange={(event) => setEmojiImport({ ...emojiImport, source: event.target.value })} placeholder="https://example.com/emoji.json 或图片链接，多项可换行" /></label>
                      <button className="admin-tool-button primary" type="button" onClick={importEmojiPack} disabled={emojiImportBusy}>
                        <Plus size={16} />{emojiImportBusy ? '导入中' : '添加到商店'}
                      </button>
                    </div>
                  </section>

                  <div className="emoji-pack-grid">
                    {emojiPacks.map((pack, packIndex) => (
                      <article className="emoji-pack-card" key={`${pack.name}-${packIndex}`}>
                        <header>
                          <label className="admin-field">
                            <span>表情包名称</span>
                            <input value={pack.name} onChange={(event) => updateEmojiPack(packIndex, { name: event.target.value })} />
                          </label>
                          <button className="admin-tool-button danger" type="button" onClick={() => removeEmojiPack(packIndex)}>
                            <Trash2 size={15} />删除
                          </button>
                        </header>
                        <div className="emoji-store-grid">
                          {pack.items.map((item, itemIndex) => (
                            <div className="emoji-store-item" key={`${emojiLabel(item)}-${itemIndex}`}>
                              {typeof item === 'string' ? (
                                <span>{item}</span>
                              ) : (
                                <img src={item.url} alt={item.label || '表情'} loading="lazy" />
                              )}
                              <button type="button" onClick={() => removeEmojiItem(packIndex, itemIndex)} aria-label="删除表情">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="emoji-item-add">
                          <input
                            value={emojiItemDrafts[packIndex] || ''}
                            onChange={(event) => setEmojiItemDrafts((current) => ({ ...current, [packIndex]: event.target.value }))}
                            placeholder="粘贴单个或多行图片链接 / 表情"
                          />
                          <button className="admin-tool-button" type="button" onClick={() => addEmojiItems(packIndex)}>
                            <Plus size={15} />添加
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {!emojiPacks.length && (
                    <div className="admin-empty-state admin-settings-empty">
                      <Braces size={22} />
                      <b>还没有表情包。</b>
                    </div>
                  )}
                </div>
              ),
              className: 'emoji-settings-workbench'
            })
          )}

          {isAdmin && activeView === 'users' && (
            <section className="admin-view-grid">
              <article id="users" className="admin-panel wide user-management-panel">
                <header className="action-only user-management-toolbar">
                  <button className="admin-primary-action" type="button" onClick={() => setRoleManagerOpen(true)} disabled={usersBusy}>
                    <Users size={16} />分组管理
                  </button>
                </header>

                <div className="user-management-list" aria-busy={usersBusy}>
                  {managedUsers.map((item) => (
                    <article className="managed-user-card" key={item.id}>
                      <div className="managed-user-profile">
                        <div className="user-role-avatar">
                          {item.avatarImage ? <img src={item.avatarImage} alt="" /> : <span>{item.avatar || item.displayName.slice(0, 1)}</span>}
                        </div>
                        <div className="user-role-main">
                          <b>{item.displayName}</b>
                          <span>@{item.username}</span>
                        </div>
                      </div>
                      <div className="managed-user-meta">
                        <span className="managed-user-id">ID #{item.id}</span>
                        <span>用户分组：{roleLabel(roles, item.roleKey)}</span>
                        <span>注册时间：{formatAdminDate(item.createdAt)}</span>
                        <span>最后登录：{formatAdminDate(item.lastLoginAt, '从未登录')}</span>
                        <span className={item.status === 'banned' ? 'user-status-pill banned' : 'user-status-pill'}>
                          {item.statusLabel || userStatusLabel(item.status)}
                        </span>
                      </div>
                      <div className="managed-user-actions">
                        <button className="admin-tool-button" type="button" onClick={() => openUserEditor(item)} disabled={usersBusy}>
                          <Pencil size={15} />编辑
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </section>
          )}
        </main>
      </div>
    </section>
    {roleManagerOpen && (
      <div
        className="admin-modal-backdrop admin-user-modal-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setRoleManagerOpen(false);
            setConfirmRoleDeleteKey(null);
          }
        }}
      >
        <section className="admin-editor-modal admin-role-modal" role="dialog" aria-modal="true" aria-labelledby="admin-role-title">
          <header className="admin-editor-head">
            <div>
              <h3 id="admin-role-title"><Users size={18} />分组管理</h3>
              <p>管理用户分组名称，也可以新增或删除自定义分组。</p>
            </div>
            <button
              className="admin-modal-close"
              type="button"
              onClick={() => {
                setRoleManagerOpen(false);
                setConfirmRoleDeleteKey(null);
              }}
              aria-label="关闭分组管理"
            >
              <X size={18} />
            </button>
          </header>
          <div className="admin-editor-body">
            <div className="admin-role-modal-body">
              <div className="role-modal-list">
                {roles.map((role) => (
                  <div className="role-modal-row" key={role.key}>
                    <label className="admin-field">
                      <span>{role.key}{role.canAdmin ? ' · 管理权限' : ''}</span>
                      <input value={role.name} onChange={(event) => updateRoleName(role.key, event.target.value)} />
                    </label>
                    <button
                      className={`admin-tool-button danger ${confirmRoleDeleteKey === role.key ? 'confirm' : ''}`}
                      type="button"
                      onClick={() => void removeRole(role.key)}
                      disabled={usersBusy || role.key === 'admin' || role.key === 'user'}
                    >
                      <Trash2 size={15} />{confirmRoleDeleteKey === role.key ? '确认删除' : role.key === 'admin' || role.key === 'user' ? '基础分组' : '删除'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="role-modal-add">
                <label className="admin-field">
                  <span>新分组标识</span>
                  <input value={newRole.key} onChange={(event) => setNewRole({ ...newRole, key: cleanRoleKey(event.target.value) })} placeholder="member-plus" />
                </label>
                <label className="admin-field">
                  <span>新分组名称</span>
                  <input value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} placeholder="高级会员" />
                </label>
                <button className="admin-tool-button primary" type="button" onClick={addRole} disabled={usersBusy}>
                  <Plus size={16} />添加分组
                </button>
              </div>
              <div className="admin-inline-actions role-modal-actions">
                <button className="admin-primary-action" type="button" onClick={() => saveRoles()} disabled={usersBusy}>
                  <Save size={16} />保存分组
                </button>
                <button type="button" onClick={() => setRoleManagerOpen(false)}>取消</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )}
    {editingUser && (
      <div
        className="admin-modal-backdrop admin-user-modal-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeUserEditor();
        }}
      >
        <section className="admin-editor-modal admin-user-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-edit-title">
          <header className="admin-editor-head">
            <div>
              <h3 id="admin-user-edit-title"><Pencil size={18} />编辑用户</h3>
              <p>查看账号资料，调整分组和状态，或执行封禁、删除操作。</p>
            </div>
            <button className="admin-modal-close" type="button" onClick={closeUserEditor} aria-label="关闭用户编辑">
              <X size={18} />
            </button>
          </header>
          <div className="admin-editor-body">
            <div className="admin-user-edit-body">
              <div className="admin-user-edit-summary">
                <div className="user-role-avatar">
                  {editingUser.avatarImage ? <img src={editingUser.avatarImage} alt="" /> : <span>{editingUser.avatar || editingUser.displayName.slice(0, 1)}</span>}
                </div>
                <div className="user-role-main">
                  <b>{editingUser.displayName}</b>
                  <span>@{editingUser.username}</span>
                </div>
              </div>
              <div className="admin-user-detail-grid">
                <div className="admin-detail-item">
                  <span>ID</span>
                  <b>#{editingUser.id}</b>
                </div>
                <label className="admin-field">
                  <span>用户分组</span>
                  <select value={editingUserDraft.roleKey} onChange={(event) => setEditingUserDraft({ ...editingUserDraft, roleKey: event.target.value })} disabled={usersBusy}>
                    {roles.map((role) => (
                      <option key={role.key} value={role.key}>{role.name}</option>
                    ))}
                  </select>
                </label>
                <div className="admin-detail-item">
                  <span>注册时间</span>
                  <b>{formatAdminDate(editingUser.createdAt)}</b>
                </div>
                <div className="admin-detail-item">
                  <span>最后登录时间</span>
                  <b>{formatAdminDate(editingUser.lastLoginAt, '从未登录')}</b>
                </div>
                <label className="admin-field">
                  <span>状态</span>
                  <select value={editingUserDraft.status} onChange={(event) => setEditingUserDraft({ ...editingUserDraft, status: event.target.value })} disabled={usersBusy}>
                    <option value="active">正常</option>
                    <option value="banned">已封禁</option>
                  </select>
                </label>
              </div>
              <div className="admin-user-edit-actions">
                <button className="admin-primary-action" type="button" onClick={saveUserEditor} disabled={usersBusy}>
                  <Save size={16} />保存修改
                </button>
                <button
                  className={`admin-tool-button danger ${confirmUserAction?.userId === editingUser.id && (confirmUserAction.action === 'ban' || confirmUserAction.action === 'unban') ? 'confirm' : ''}`}
                  type="button"
                  onClick={() => void runConfirmedUserAction(editingUser.id, editingUser.status === 'banned' ? 'unban' : 'ban')}
                  disabled={usersBusy}
                >
                  <Shield size={15} />
                  {confirmUserAction?.userId === editingUser.id && (confirmUserAction.action === 'ban' || confirmUserAction.action === 'unban')
                    ? editingUser.status === 'banned' ? '确认解除' : '确认封禁'
                    : editingUser.status === 'banned' ? '解除封禁' : '封禁账号'}
                </button>
                <button
                  className={`admin-tool-button danger ${confirmUserAction?.userId === editingUser.id && confirmUserAction.action === 'delete' ? 'confirm' : ''}`}
                  type="button"
                  onClick={() => void runConfirmedUserAction(editingUser.id, 'delete')}
                  disabled={usersBusy}
                >
                  <Trash2 size={15} />{confirmUserAction?.userId === editingUser.id && confirmUserAction.action === 'delete' ? '确认删除' : '删除用户'}
                </button>
                <button type="button" onClick={closeUserEditor}>取消</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )}
    {noticeOpen && (
      <div
        className="admin-modal-backdrop admin-notice-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) setNoticeOpen(false);
        }}
      >
        <section className="admin-editor-modal admin-notice-modal" role="dialog" aria-modal="true" aria-labelledby="admin-notice-title">
          <header className="admin-editor-head">
            <div>
              <h3 id="admin-notice-title"><Bell size={18} />公告设置</h3>
              <p>配置后台公告入口，也可以作为前台公告内容的数据来源。</p>
            </div>
            <button className="admin-modal-close" type="button" onClick={() => setNoticeOpen(false)} aria-label="关闭公告设置">
              <X size={18} />
            </button>
          </header>
          <div className="admin-editor-body">
            <div className="admin-form-stack admin-notice-form">
              <div className="admin-switch-row notice-switch">
                <label>
                  <input
                    type="checkbox"
                    checked={info.announcementEnabled}
                    onChange={(event) => setInfo({ ...info, announcementEnabled: event.target.checked })}
                  />
                  启用公告
                </label>
              </div>
              <label className="admin-field">
                <span>公告标题</span>
                <input
                  value={info.announcementTitle}
                  onChange={(event) => setInfo({ ...info, announcementTitle: event.target.value })}
                  placeholder="今日公告"
                  maxLength={40}
                />
              </label>
              <label className="admin-field">
                <span>公告内容</span>
                <textarea
                  value={info.announcementContent}
                  onChange={(event) => setInfo({ ...info, announcementContent: event.target.value })}
                  placeholder="写一段想展示给访问者或后台成员看的公告"
                  maxLength={500}
                />
              </label>
              <div className="admin-notice-preview">
                <span>{info.announcementEnabled ? '已启用' : '未启用'}</span>
                <b>{info.announcementTitle || '公告标题预览'}</b>
                <p>{info.announcementContent || '公告内容会显示在这里，保存后会进入站点配置。'}</p>
              </div>
              <div className="admin-inline-actions notice-actions">
                <button className="admin-primary-action" type="button" onClick={saveAnnouncement}>
                  <Save size={16} />保存公告
                </button>
                <button type="button" onClick={() => setNoticeOpen(false)}>取消</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
