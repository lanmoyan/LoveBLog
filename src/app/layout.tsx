import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { getSettingMap } from '@/lib/settings';
import { publicUploadUrl } from '@/lib/uploads';
import './globals.css';

const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem('love-next-theme');
    var preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = stored === 'dark' || stored === 'light' ? stored : preferred;
    document.documentElement.dataset.theme = theme;
  } catch (error) {}
})();
`;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingMap();
  const title = settings.get('site_title') || process.env.APP_NAME || '我们的小星球';
  const siteIcon = publicUploadUrl(settings.get('site_icon') || '/site-icon.svg');

  return {
    title,
    description: '情侣博客与私密生活记录',
    icons: {
      icon: [{ url: siteIcon }],
      shortcut: [siteIcon],
      apple: [{ url: siteIcon }]
    }
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
