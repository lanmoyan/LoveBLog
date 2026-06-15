import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth';
import { getSettingMap, normalizeHomeAlbumImages, readEmojiPacksFromMap, safeJson, setSetting } from '@/lib/settings';
import { cleanExternalUrl, cleanImageUrl, publicUploadUrl } from '@/lib/uploads';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { publicUserProfile, publicUserSelect } from '@/lib/users';

const emptyToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const InfoSchema = z.object({
  siteTitle: z.string().trim().max(40).optional(),
  siteIcon: z.string().trim().max(500).optional(),
  togetherSince: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  specialDates: z.array(z.object({
    name: z.string().trim().min(1).max(20),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recurring: z.boolean().optional()
  })).max(30).optional(),
  imageMetaEnabled: z.boolean().optional(),
  twikooEnvId: z.string().max(220).optional(),
  twikooRegion: z.enum(['', 'ap-shanghai', 'ap-guangzhou']).optional(),
  announcementEnabled: z.boolean().optional(),
  announcementTitle: z.string().trim().max(40).optional(),
  announcementContent: z.string().trim().max(500).optional(),
  footerMessageUrl: z.string().trim().max(500).optional(),
  footerRssUrl: z.string().trim().max(500).optional(),
  footerRewardUrl: z.string().trim().max(500).optional(),
  footerIcpNumber: z.string().trim().max(80).optional(),
  footerIcpUrl: z.string().trim().max(500).optional(),
  footerPoliceNumber: z.string().trim().max(80).optional(),
  footerPoliceUrl: z.string().trim().max(500).optional(),
  footerUptimeStatusUrl: z.string().trim().max(500).optional(),
  footerUptimeStatusPageUrl: z.string().trim().max(500).optional()
});

function cleanTwikooEnvId(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return cleanExternalUrl(raw);
  return /^[a-zA-Z0-9_-]{1,120}$/.test(raw) ? raw : '';
}

function cleanSiteIcon(value: unknown) {
  const raw = String(value || '').trim();
  if (/^\/(?!\/)(?!.*\.\.)[a-zA-Z0-9/_-]+\.(svg|ico|png|jpe?g|webp|gif)$/i.test(raw)) return raw;
  const cleaned = cleanImageUrl(value);
  return cleaned || '';
}

function cleanFooterUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\/(?!\/)(?!.*\.\.)[a-zA-Z0-9/_~./?#[\]@!$&'()*+,;=:%-]*$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function cleanHttpUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function saveOptionalUrl(key: string, value: string | undefined, cleaner = cleanFooterUrl) {
  if (typeof value !== 'string') return null;
  const cleaned = cleaner(value);
  if (value.trim() && !cleaned) return key;
  await setSetting(key, cleaned);
  return null;
}

export async function GET() {
  const settings = await getSettingMap();
  const twikooRegion = settings.get('twikoo_region') ?? process.env.NEXT_PUBLIC_TWIKOO_REGION ?? 'ap-shanghai';
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: publicUserSelect });
  const publicUsers = users.map((user) => ({ ...publicUserProfile(user), avatarImage: publicUploadUrl(user.avatarImage) }));
  const couple = publicUsers.filter((user) => user.partnerId || publicUsers.some((item) => item.partnerId === user.id));
  return NextResponse.json({
    siteTitle: settings.get('site_title') || process.env.APP_NAME || '我们的小星球',
    siteIcon: publicUploadUrl(settings.get('site_icon') || '/site-icon.svg'),
    togetherSince: settings.get('together_since') || '',
    specialDates: safeJson(settings.get('special_dates'), []),
    homeAlbumImages: normalizeHomeAlbumImages(safeJson(settings.get('home_album_images'), [])).map((image) => ({
      ...image,
      path: publicUploadUrl(image.path)
    })),
    imageMetaEnabled: settings.get('image_meta_enabled') !== '0',
    twikooEnvId: settings.get('twikoo_env_id') || process.env.NEXT_PUBLIC_TWIKOO_ENV_ID || '',
    twikooRegion,
    announcementEnabled: settings.get('announcement_enabled') === '1',
    announcementTitle: settings.get('announcement_title') || '',
    announcementContent: settings.get('announcement_content') || '',
    footerMessageUrl: settings.get('footer_message_url') || '',
    footerRssUrl: settings.get('footer_rss_url') || '',
    footerRewardUrl: settings.get('footer_reward_url') || '',
    footerIcpNumber: settings.get('footer_icp_number') || '',
    footerIcpUrl: settings.get('footer_icp_url') || '',
    footerPoliceNumber: settings.get('footer_police_number') || '',
    footerPoliceUrl: settings.get('footer_police_url') || '',
    footerUptimeStatusUrl: settings.get('footer_uptime_status_url') || '',
    footerUptimeStatusPageUrl: settings.get('footer_uptime_status_page_url') || '',
    emojiPacks: readEmojiPacksFromMap(settings),
    visits: Number(settings.get('visits') || '0'),
    users: publicUsers,
    couple
  });
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = InfoSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '设置格式不正确' }, { status: 400 });
    const data = parsed.data;

    if (typeof data.siteTitle === 'string') await setSetting('site_title', data.siteTitle || '我们的小星球');
    if (typeof data.siteIcon === 'string') {
      const cleaned = cleanSiteIcon(data.siteIcon);
      if (data.siteIcon.trim() && !cleaned) {
        return NextResponse.json({ error: '站点图标只能填写 http/https 图片地址或本地上传图片地址' }, { status: 400 });
      }
      await setSetting('site_icon', cleaned || '/site-icon.svg');
    }
    if (typeof data.togetherSince === 'string') await setSetting('together_since', data.togetherSince);
    if (data.specialDates) await setSetting('special_dates', JSON.stringify(data.specialDates));
    if (typeof data.imageMetaEnabled === 'boolean') await setSetting('image_meta_enabled', data.imageMetaEnabled ? '1' : '0');
    if (typeof data.twikooEnvId === 'string') {
      const cleaned = cleanTwikooEnvId(data.twikooEnvId);
      if (data.twikooEnvId.trim() && !cleaned) {
        return NextResponse.json({ error: 'Twikoo 环境 ID 只能填写腾讯云环境 ID 或 http/https 服务地址' }, { status: 400 });
      }
      await setSetting('twikoo_env_id', cleaned);
    }
    if (typeof data.twikooRegion === 'string') await setSetting('twikoo_region', data.twikooRegion);
    if (typeof data.announcementEnabled === 'boolean') await setSetting('announcement_enabled', data.announcementEnabled ? '1' : '0');
    if (typeof data.announcementTitle === 'string') await setSetting('announcement_title', data.announcementTitle);
    if (typeof data.announcementContent === 'string') await setSetting('announcement_content', data.announcementContent);
    const badUrl = await saveOptionalUrl('footer_message_url', data.footerMessageUrl)
      || await saveOptionalUrl('footer_rss_url', data.footerRssUrl)
      || await saveOptionalUrl('footer_reward_url', data.footerRewardUrl)
      || await saveOptionalUrl('footer_icp_url', data.footerIcpUrl)
      || await saveOptionalUrl('footer_police_url', data.footerPoliceUrl)
      || await saveOptionalUrl('footer_uptime_status_url', data.footerUptimeStatusUrl, cleanHttpUrl)
      || await saveOptionalUrl('footer_uptime_status_page_url', data.footerUptimeStatusPageUrl, cleanFooterUrl);
    if (badUrl) return NextResponse.json({ error: `${badUrl} 链接格式不正确` }, { status: 400 });
    if (typeof data.footerIcpNumber === 'string') await setSetting('footer_icp_number', data.footerIcpNumber.trim());
    if (typeof data.footerPoliceNumber === 'string') await setSetting('footer_police_number', data.footerPoliceNumber.trim());

    return GET();
  } catch (error) {
    return jsonError(error);
  }
}
