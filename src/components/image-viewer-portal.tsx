'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ImageViewerPortalProps = {
  src: string;
  onClose: () => void;
  children?: ReactNode;
};

export function ImageViewerPortal({ src, onClose, children }: ImageViewerPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="image-viewer" role="dialog" aria-modal="true">
      <button className="viewer-close" type="button" onClick={onClose} aria-label="关闭图片预览">
        <X size={22} />
      </button>
      <img src={src} alt="" />
      {children}
    </div>,
    document.body
  );
}
