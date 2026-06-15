import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_EMOJI_PACKS = [
  { name: '常用', items: ['😊', '😘', '🥰', '😍', '🤗', '😜', '🥺', '😭', '😂', '👍', '🎉', '✨'] },
  { name: '恋爱', items: ['🌹', '💐', '💖', '💕', '💗', '💞', '💋', '💌', '💘', '💝', '🫶', '💍'] },
  { name: '氛围', items: ['🌙', '⭐', '☀️', '🌈', '🍰', '🎂', '🍓', '🧸', '🎀', '🎁', '🎆', '📷'] }
];

async function main() {
  const count = await prisma.user.count();

  if (count === 0 && process.env.SEED_DEFAULT_USERS === '1') {
    const password = process.env.SEED_PASSWORD || 'love520';
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.createMany({
      data: [
        { username: 'him', passwordHash, displayName: '他', avatar: '🐻', roleKey: 'admin' },
        { username: 'her', passwordHash, displayName: '她', avatar: '🐰', roleKey: 'user' }
      ]
    });
  }

  const defaults = [
    { key: 'site_title', value: process.env.APP_NAME || '我们的小星球' },
    { key: 'site_icon', value: '/site-icon.svg' },
    { key: 'together_since', value: new Date().toISOString().slice(0, 10) },
    { key: 'home_album_images', value: '[]' },
    { key: 'special_dates', value: '[]' },
    { key: 'emoji_packs_json', value: JSON.stringify(DEFAULT_EMOJI_PACKS) },
    { key: 'image_meta_enabled', value: '1' },
    { key: 'guestbook_moderation', value: '0' },
    { key: 'footer_message_url', value: '' },
    { key: 'footer_rss_url', value: '' },
    { key: 'footer_reward_url', value: '' },
    { key: 'footer_icp_number', value: '' },
    { key: 'footer_icp_url', value: '' },
    { key: 'footer_police_number', value: '' },
    { key: 'footer_police_url', value: '' },
    { key: 'footer_uptime_status_url', value: '' },
    { key: 'footer_uptime_status_page_url', value: '' },
    { key: 'twikoo_env_id', value: process.env.NEXT_PUBLIC_TWIKOO_ENV_ID || '' },
    { key: 'twikoo_region', value: process.env.NEXT_PUBLIC_TWIKOO_REGION || 'ap-shanghai' },
    { key: 'visits', value: '0' }
  ];

  for (const item of defaults) {
    await prisma.setting.upsert({
      where: { key: item.key },
      create: item,
      update: {}
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
