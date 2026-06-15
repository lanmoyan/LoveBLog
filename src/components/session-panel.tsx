'use client';

import Link from 'next/link';
import { LogIn, LogOut, Moon, Sun } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/session-provider';

type ThemeMode = 'light' | 'dark';

export function SessionPanel() {
  const { user, refresh, loading } = useSession();
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('love-next-theme');
    const preferred: ThemeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const nextTheme: ThemeMode = stored === 'dark' || stored === 'light' ? stored : preferred;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  async function logout() {
    await signOut({ redirect: false });
    await refresh();
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('love-next-theme', nextTheme);
  }

  return (
    <section className="session-panel">
      <button
        className={theme === 'dark' ? 'icon-btn theme-toggle active' : 'icon-btn theme-toggle'}
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
        aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
        aria-pressed={theme === 'dark'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {user ? (
        <button className="icon-btn" type="button" onClick={logout} title="退出登录" aria-label="退出登录">
          <LogOut size={16} />
        </button>
      ) : (
        <Link className={loading ? 'pill-btn login-icon-link disabled' : 'pill-btn login-icon-link'} href="/login/" aria-label="登录">
          <LogIn size={16} />
          <span>登录</span>
        </Link>
      )}
    </section>
  );
}
