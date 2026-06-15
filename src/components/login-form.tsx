'use client';

import { BadgeCheck, Eye, EyeOff, LockKeyhole, LogIn, Mail, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/session-provider';

export function LoginForm({ siteIcon, title }: { siteIcon: string; title: string }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<Array<{ key: string; name: string }>>([]);

  useEffect(() => {
    fetch('/api/auth/register-options/', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        setEmailVerificationEnabled(data.emailVerificationEnabled === true);
        setOauthProviders(Array.isArray(data.oauthProviders) ? data.oauthProviders : []);
      })
      .catch(() => {});
  }, []);

  async function sendCode() {
    const email = String((document.querySelector('input[name="email"]') as HTMLInputElement | null)?.value || '').trim();
    if (!email) {
      setError('请先填写邮箱');
      return;
    }
    setCodeBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register-code/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || '验证码发送失败');
      setError('验证码已发送，请查看邮箱');
    } catch {
      setError('验证码发送失败，请稍后重试');
    } finally {
      setCodeBusy(false);
    }
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setError('');
    try {
      const username = String(formData.get('username') || '').trim();
      const password = String(formData.get('password') || '');
      if (mode === 'register') {
        const res = await fetch('/api/auth/register/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            displayName: formData.get('displayName'),
            password,
            email: formData.get('email'),
            code: formData.get('code')
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setError(data.error || '注册失败，请检查服务配置');
      }
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false
      });
      if (!result?.ok) return setError(mode === 'register' ? '注册成功，但自动登录失败，请重新登录' : '账号或密码不正确');
      await refresh();
      router.push('/settings/');
    } catch {
      setError(mode === 'register' ? '注册失败，请稍后重试' : '登录失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-auth-stage">
      <div className="login-auth-brand">
        <span className="login-auth-logo">
          {siteIcon ? <img src={siteIcon} alt="" /> : <Sparkles size={30} />}
        </span>
        <h1>{title}</h1>
        <p>{mode === 'register' ? '创建账号加入小星球' : '欢迎回来'}</p>
      </div>
      <form className="login-form" action={submit}>
        <header className="login-card-head">
          <h2>{mode === 'register' ? '创建账号' : '欢迎回来'}</h2>
          <p>{mode === 'register' ? '填写资料后即可进入后台' : '登录你的账号以继续'}</p>
        </header>
        <label>
          <span>账号</span>
          <i className="login-input-shell">
            <UserRound size={18} />
            <input name="username" placeholder="3-32 位英文、数字或下划线" autoComplete="username" />
          </i>
        </label>
        {mode === 'register' && (
          <label>
            <span>昵称</span>
            <i className="login-input-shell">
              <UserPlus size={18} />
              <input name="displayName" placeholder="展示给大家看的名字" autoComplete="nickname" />
            </i>
          </label>
        )}
        {mode === 'register' && emailVerificationEnabled && (
          <>
            <label>
              <span>邮箱</span>
              <i className="login-input-shell">
                <Mail size={18} />
                <input name="email" type="email" placeholder="用于接收注册验证码" autoComplete="email" />
              </i>
            </label>
            <label>
              <span>验证码</span>
              <i className="login-input-shell with-action">
                <BadgeCheck size={18} />
                <input name="code" inputMode="numeric" placeholder="6 位邮箱验证码" autoComplete="one-time-code" />
                <button type="button" onClick={sendCode} disabled={codeBusy}>
                  {codeBusy ? '发送中' : '发送'}
                </button>
              </i>
            </label>
          </>
        )}
        <label>
          <span>密码</span>
          <i className="login-input-shell with-action">
            <LockKeyhole size={18} />
            <input
              name="password"
              placeholder={mode === 'register' ? '至少 6 位密码' : '输入密码'}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              title={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </i>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="login-submit" disabled={busy}>
          <LogIn size={18} />
          {busy ? (mode === 'register' ? '注册中' : '登录中') : (mode === 'register' ? '注册并进入' : '进入小星球')}
        </button>
      </form>
      {oauthProviders.length > 0 && (
        <div className="oauth-login-panel" aria-label="第三方登录">
          <span>第三方账号登录</span>
          <div className="oauth-login-grid">
            {oauthProviders.map((provider) => (
              <button key={provider.key} type="button" onClick={() => signIn(provider.key, { callbackUrl: '/settings/' })}>
                <LogIn size={17} />
                {provider.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="login-mode-switch">
        {mode === 'register' ? '已有账号？' : '还没有账号？'}
        <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
          {mode === 'register' ? '返回登录' : '注册'}
        </button>
      </p>
    </section>
  );
}
