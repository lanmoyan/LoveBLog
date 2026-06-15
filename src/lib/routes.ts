import {
  LogIn,
  Sparkles
} from 'lucide-react';

export const pageMeta = {
  home: { kicker: 'Overview', title: '生活桌面', subtitle: '两个头像、几个入口，把你们的小星球整理成清晰的首页。', chip: 'Private Planet' },
  essay: { kicker: 'Mood Notes', title: '说说', subtitle: '把日常片段整理成轻量卡片，文字、图片和视频都可以快速浏览。', chip: 'Mood Cards' },
  stories: { kicker: 'Stories', title: '爱情博客', subtitle: '把重要经历写成长故事，支持封面、标签、草稿和私密文章。', chip: 'Love Blog' },
  timeline: { kicker: 'Timeline', title: '时光碎片', subtitle: '重要日子会按瀑布流自然排列，图片参数在查看器里统一展示。', chip: 'Milestones' },
  album: { kicker: 'Gallery', title: '相册图库', subtitle: '照片墙、轮播、外部图库接入和图片上传会集中在这里。', chip: 'Photos' },
  wishlist: { kicker: 'Wishlist', title: '便利贴心愿', subtitle: '想一起完成的事情会用便利贴方式陈列。', chip: 'Sticky Notes' },
  comment: { kicker: 'Guestbook', title: '留言评论', subtitle: '游客也可以在这里留下评论和祝福，评论由 Twikoo 提供。', chip: 'Twikoo' },
  secret: { kicker: 'Secret', title: '悄悄话', subtitle: '只有登录后的两个人可以看到和管理这些私密便签。', chip: 'Private' },
  settings: { kicker: 'Control', title: '设置工作台', subtitle: '资料、相册、纪念日、安全码和表情包配置都在这里维护。', chip: 'Admin' },
  login: { kicker: 'Login', title: '登录小星球', subtitle: '回到你们的私密后台，继续整理说说、照片和心愿。', chip: 'Account' }
} as const;

export type PageKey = keyof typeof pageMeta;

export const brandIcon = Sparkles;
export const loginIcon = LogIn;
