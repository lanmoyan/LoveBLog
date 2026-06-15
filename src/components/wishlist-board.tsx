import { formatDateTime } from '@/lib/dates';

export function WishlistBoard({ initialItems }: { initialItems: any[] }) {
  return (
    <section className="wishlist-page">
      {initialItems.length ? (
        <div className="sticky-grid">
          {initialItems.map((item) => (
            <article
              key={item.id}
              className={`sticky-note ${item.done ? 'done' : ''} note-${item.noteStyle}`}
              style={item.noteStyle === 'custom' ? { background: item.noteColor, color: item.textColor } : undefined}
            >
              <p>{item.content}</p>
              <time>{formatDateTime(item.displayAt || item.createdAt)}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">还没有心愿。</div>
      )}
    </section>
  );
}
