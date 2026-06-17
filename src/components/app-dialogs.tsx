'use client';

import { AlertTriangle, CheckCircle2, Info, Trash2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type DialogTone = 'info' | 'success' | 'warning' | 'danger';

type AlertOptions = {
  title?: string;
  message: string;
  tone?: DialogTone;
  confirmText?: string;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
};

type DialogState =
  | (AlertOptions & { kind: 'alert'; resolve: () => void })
  | (ConfirmOptions & { kind: 'confirm'; resolve: (value: boolean) => void });

type AppDialogsValue = {
  alert: (options: string | AlertOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AppDialogsContext = createContext<AppDialogsValue | null>(null);

function toneFromMessage(message: string): DialogTone {
  if (/失败|错误|异常|不可恢复/.test(message)) return 'danger';
  if (/已|成功|完成|保存|导入|更新/.test(message)) return 'success';
  if (/删除|移除|清空/.test(message)) return 'danger';
  if (/请|需要|不能为空|未识别/.test(message)) return 'warning';
  return 'info';
}

function titleFromTone(tone: DialogTone) {
  if (tone === 'success') return '操作完成';
  if (tone === 'danger') return '需要确认';
  if (tone === 'warning') return '请留意';
  return '提示';
}

function DialogIcon({ tone }: { tone: DialogTone }) {
  if (tone === 'success') return <CheckCircle2 size={24} />;
  if (tone === 'danger') return <Trash2 size={24} />;
  if (tone === 'warning') return <AlertTriangle size={24} />;
  return <Info size={24} />;
}

export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const close = useCallback((value?: boolean) => {
    setDialog((current) => {
      if (!current) return null;
      if (current.kind === 'confirm') current.resolve(!!value);
      if (current.kind === 'alert') current.resolve();
      return null;
    });
  }, []);

  const alert = useCallback((options: string | AlertOptions) => {
    const normalized = typeof options === 'string' ? { message: options } : options;
    const tone = normalized.tone || toneFromMessage(normalized.message);
    return new Promise<void>((resolve) => {
      setDialog({
        kind: 'alert',
        title: normalized.title || titleFromTone(tone),
        message: normalized.message,
        tone,
        confirmText: normalized.confirmText || '知道了',
        resolve
      });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    const tone = options.tone || 'danger';
    return new Promise<boolean>((resolve) => {
      setDialog({
        kind: 'confirm',
        title: options.title || titleFromTone(tone),
        message: options.message,
        tone,
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        resolve
      });
    });
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      void alert(String(message ?? ''));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [alert]);

  useEffect(() => {
    function onAppAlert(event: Event) {
      const detail = (event as CustomEvent<string | AlertOptions>).detail;
      if (typeof detail === 'string') {
        void alert(detail);
      } else if (detail?.message) {
        void alert(detail);
      }
    }

    window.addEventListener('app-dialog:alert', onAppAlert);
    return () => window.removeEventListener('app-dialog:alert', onAppAlert);
  }, [alert]);

  useEffect(() => {
    if (!dialog) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, dialog]);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);
  const tone = dialog?.tone || 'info';

  return (
    <AppDialogsContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
          <section className={`app-dialog tone-${tone}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
            <button className="app-dialog-close" type="button" onClick={() => close(false)} aria-label="关闭弹窗">
              <X size={18} />
            </button>
            <div className="app-dialog-icon">
              <DialogIcon tone={tone} />
            </div>
            <div className="app-dialog-copy">
              <h2 id="app-dialog-title">{dialog.title || titleFromTone(tone)}</h2>
              <p>{dialog.message}</p>
            </div>
            <div className="app-dialog-actions">
              {dialog.kind === 'confirm' && (
                <button className="app-dialog-button ghost" type="button" onClick={() => close(false)}>
                  {dialog.cancelText || '取消'}
                </button>
              )}
              <button className="app-dialog-button primary" type="button" onClick={() => close(true)}>
                {dialog.confirmText || '确定'}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppDialogsContext.Provider>
  );
}

export function useAppDialogs() {
  const value = useContext(AppDialogsContext);
  if (!value) throw new Error('useAppDialogs must be used inside AppDialogsProvider');
  return value;
}
