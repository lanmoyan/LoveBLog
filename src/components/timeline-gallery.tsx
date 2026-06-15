'use client';

import { Camera } from 'lucide-react';
import { useState } from 'react';
import { ImageViewerPortal } from '@/components/image-viewer-portal';
import { imageVariantUrl } from '@/lib/image-variants';

export function TimelineGallery({ initialEvents }: { initialEvents: any[] }) {
  const [active, setActive] = useState<any>(null);

  return (
    <section className="timeline-page">
      {initialEvents.length ? (
        <div className="photo-grid">
          {initialEvents.map((event) => (
            <article key={event.id} className="time-card photo-card">
              {event.image && <button type="button" onClick={() => setActive(event)}><img src={imageVariantUrl(event.image, 960)} alt="" loading="lazy" decoding="async" /></button>}
              <div className="time-copy photo-copy">
                <span>{event.date}</span>
                <h3>{event.title}</h3>
                {event.description && <p>{event.description}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">还没有时光碎片。</div>
      )}
      {active && <ImageViewer event={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function ImageViewer({ event, onClose }: { event: any; onClose: () => void }) {
  const meta = event.imageMeta || event.image_meta || {};
  const left = [meta.model || meta.make, meta.taken_at || [meta.date, meta.time].filter(Boolean).join(' ')]
    .filter(Boolean);
  const right = [meta.focal_length, meta.aperture, meta.exposure, meta.iso].filter(Boolean);

  return (
    <ImageViewerPortal src={imageVariantUrl(event.image, 1800)} onClose={onClose}>
      <div className="viewer-meta left">{left.map((item) => <span key={item}><Camera size={13} />{item}</span>)}</div>
      <div className="viewer-meta right">{right.map((item) => <span key={item}>{item}</span>)}</div>
    </ImageViewerPortal>
  );
}
