import type { AdminContentView } from '@/lib/admin-content';
import type { SiteSnapshot } from '@/lib/site';

export type { AdminContentView } from '@/lib/admin-content';

export type Stats = {
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

export type UserRole = {
  key: string;
  name: string;
  canAdmin: boolean;
};

export type ManagedUser = {
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

export type AuthProviderDraft = {
  key: string;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret?: string;
  hasSecret?: boolean;
};

export type AuthIntegrationDraft = {
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

export type EmojiPackDraft = SiteSnapshot['emojiPacks'][number];
export type EmojiItemDraft = EmojiPackDraft['items'][number];
export type SiteInfoDraft = {
  siteTitle: string;
  siteIcon: string;
  togetherSince: string;
  imageMetaEnabled: boolean;
  twikooEnvId: string;
  twikooRegion: string;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementContent: string;
  footerMessageUrl: string;
  footerRssUrl: string;
  footerRewardUrl: string;
  footerIcpNumber: string;
  footerIcpUrl: string;
  footerPoliceNumber: string;
  footerPoliceUrl: string;
  footerUptimeStatusUrl: string;
  footerUptimeStatusPageUrl: string;
};

export type AdminView = 'overview' | AdminContentView | 'site' | 'emoji' | 'profile' | 'stats' | 'users';
export type AdminLanguage = 'zh-CN' | 'en-US';
export type AdminNumericStats = {
  posts: number;
  likes: number;
  messages: number;
  events: number;
  wishlist: number;
  stories: number;
  visits: number;
};

export const contentViews: AdminContentView[] = ['posts', 'stories', 'events', 'wishlist', 'messages'];
export const userContentViews: AdminContentView[] = ['posts', 'stories', 'messages'];
export const adminOnlyViews: AdminView[] = ['site', 'emoji', 'stats', 'users', 'events', 'wishlist'];

export const adminViewHashes: Record<AdminView, string> = {
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

export const adminLanguages: Record<AdminLanguage, { label: string; description: string }> = {
  'zh-CN': { label: '中文', description: '后台按钮和设置保持中文偏好' },
  'en-US': { label: 'English', description: 'Remember English as the admin language preference' }
};

export const adminCopy = {
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

export const defaultOAuthProviders: AuthProviderDraft[] = [
  { key: 'github', name: 'GitHub', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'google', name: 'Google', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'discord', name: 'Discord', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'qq', name: 'QQ', enabled: false, clientId: '', clientSecret: '', hasSecret: false },
  { key: 'wechat', name: 'WeChat', enabled: false, clientId: '', clientSecret: '', hasSecret: false }
];

export const defaultAuthIntegrations: AuthIntegrationDraft = {
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

export function siteInfoFromSnapshot(snapshot: SiteSnapshot): SiteInfoDraft {
  return {
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
  };
}

export function siteInfoFromResponse(data: any, fallback: SiteInfoDraft): SiteInfoDraft {
  return {
    siteTitle: data.siteTitle || fallback.siteTitle,
    siteIcon: data.siteIcon || fallback.siteIcon || '/site-icon.svg',
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
  };
}

export function mergeOAuthProviders(items: AuthProviderDraft[]) {
  return defaultOAuthProviders.map((fallback) => ({
    ...fallback,
    ...(items.find((item) => item.key === fallback.key) || {}),
    clientSecret: ''
  }));
}

export function authIntegrationsFromResponse(data: any): AuthIntegrationDraft {
  return {
    registrationEmailEnabled: data.registrationEmailEnabled === true,
    smtpHost: data.smtpHost || '',
    smtpPort: data.smtpPort || '465',
    smtpSecure: data.smtpSecure !== false,
    smtpUser: data.smtpUser || '',
    smtpFrom: data.smtpFrom || '',
    smtpPass: '',
    smtpPassConfigured: data.smtpPassConfigured === true,
    oauthProviders: mergeOAuthProviders(Array.isArray(data.oauthProviders) ? data.oauthProviders : [])
  };
}

export function makeEmojiItem(value: string, fallbackLabel = '表情'): EmojiItemDraft | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    const guessedName = raw.split(/[/?#]/).filter(Boolean).pop()?.replace(/\.[a-z0-9]+$/i, '') || fallbackLabel;
    return { label: guessedName.slice(0, 24), url: raw };
  }
  return raw.slice(0, 120) as EmojiItemDraft;
}

export function emojiLabel(item: EmojiItemDraft) {
  return typeof item === 'string' ? item : item.label || item.text || '表情';
}

export function adminDashboardStats(stats: Stats, fallbackVisits = 0) {
  const numericStats: AdminNumericStats = {
    posts: Number(stats.posts || 0),
    likes: Number(stats.likes || 0),
    messages: Number(stats.messages || 0),
    events: Number(stats.events || 0),
    wishlist: Number(stats.wishlist || 0),
    stories: Number(stats.stories || 0),
    visits: Number(stats.visits || fallbackVisits || 0)
  };
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
  const visitSummary = stats.visitSummary || {
    today: 0,
    week: 0,
    month: 0,
    year: 0,
    total: numericStats.visits,
    avgDuration: 0
  };

  return {
    numericStats,
    totalContent,
    chartRows,
    maxChart,
    trendValues,
    maxTrend,
    trendPoints,
    trendArea: `0,168 ${trendPoints} 520,168`,
    visitSummary
  };
}

export function numberText(value: number | undefined) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

export function durationText(value: number | undefined) {
  const seconds = Math.max(0, Math.round(Number(value || 0) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

export function cleanRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
}

export function roleLabel(roles: UserRole[], key: string) {
  return roles.find((role) => role.key === key)?.name || key || '普通用户';
}

export function userStatusLabel(value: string | undefined) {
  return value === 'banned' ? '已封禁' : '正常';
}

export function formatAdminDate(value: string | Date | null | undefined, fallback = '未记录') {
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
