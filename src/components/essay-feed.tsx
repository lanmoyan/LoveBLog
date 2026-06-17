'use client';

import { ChevronDown, ChevronUp, Heart, ImageIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ImageViewerPortal } from '@/components/image-viewer-portal';
import { useSession } from '@/components/session-provider';
import { formatDateTime } from '@/lib/dates';
import { imageVariantUrl } from '@/lib/image-variants';
import { renderRichText } from '@/lib/rich-text';

type EssayFeedProps = {
  initialPosts: any[];
  initialNextCursor?: number | null;
};

type PostImage = {
  id?: number | string;
  path: string;
};

function MoodFoldStack({
  postId,
  images,
  stackStart,
  onRotate,
  onPreview
}: {
  postId: number;
  images: PostImage[];
  stackStart: number;
  onRotate: (postId: number, direction: number, imageCount: number) => void;
  onPreview: (path: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wheelAt = useRef(0);
  const imageCount = images.length;
  const stackedImages = Array.from({ length: Math.min(imageCount, 5) }, (_, index) => images[(stackStart + index) % imageCount]);

  const switchFromWheel = useCallback((deltaX: number, deltaY: number) => {
    const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    if (Math.abs(delta) < 8 || imageCount < 2) return false;

    const now = Date.now();
    if (now - wheelAt.current >= 220) {
      wheelAt.current = now;
      onRotate(postId, delta > 0 ? 1 : -1, imageCount);
    }
    return true;
  }, [imageCount, onRotate, postId]);

  function keepPagePosition(scrollX: number, scrollY: number) {
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    });
  }

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const onWheel = (event: globalThis.WheelEvent) => {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      if (!switchFromWheel(event.deltaX, event.deltaY)) return;
      event.preventDefault();
      event.stopPropagation();
      keepPagePosition(scrollX, scrollY);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [switchFromWheel]);

  function onStackKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    onRotate(postId, event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1, imageCount);
  }

  return (
    <div
      ref={stageRef}
      className="mood-stack-stage"
      aria-label="折叠图片堆叠"
      tabIndex={0}
      onKeyDown={onStackKeyDown}
    >
      {stackedImages.map((image, index) => (
        <button
          key={`${image.id || image.path}-${index}-${stackStart}`}
          className={`mood-stack-card stack-${index}${index === 0 ? ' main' : ''}`}
          type="button"
          onClick={() => onPreview(image.path)}
        >
          <img src={imageVariantUrl(image.path, 720)} alt="" loading="lazy" decoding="async" />
        </button>
      ))}
      <span className="mood-stack-counter">{stackStart + 1} / {imageCount}</span>
    </div>
  );
}

export function EssayFeed({ initialPosts, initialNextCursor = null }: EssayFeedProps) {
  const { user } = useSession();
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preview, setPreview] = useState('');
  const [expandedImageGroups, setExpandedImageGroups] = useState<Record<number, boolean>>({});
  const [stackIndexes, setStackIndexes] = useState<Record<number, number>>({});

  async function loadPosts(cursor?: number | null) {
    const params = new URLSearchParams({ limit: '8' });
    if (cursor) params.set('cursor', String(cursor));
    const res = await fetch(`/api/posts/?${params}`, { cache: 'no-store' });
    const data = await res.json();
    return { posts: data.posts || [], nextCursor: data.nextCursor || null };
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await loadPosts(nextCursor);
      setPosts((current) => current.concat(data.posts));
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleLike(postId: number) {
    const res = await fetch(`/api/posts/${postId}/like/`, { method: 'POST' });
    if (!res.ok) return alert('登录后才能点赞');
    const data = await res.json();
    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId || !user) return post;
        const likes = post.likes || [];
        return {
          ...post,
          likedByMe: data.liked,
          likes: data.liked ? likes.filter((item: any) => item.id !== user.id).concat(user) : likes.filter((item: any) => item.id !== user.id)
        };
      })
    );
  }

  function toggleImageGroup(postId: number, expanded: boolean) {
    setExpandedImageGroups((current) => ({ ...current, [postId]: expanded }));
  }

  const rotateStack = useCallback((postId: number, direction: number, imageCount: number) => {
    if (imageCount < 2) return;
    setStackIndexes((current) => ({
      ...current,
      [postId]: ((current[postId] ?? 0) + direction + imageCount) % imageCount
    }));
  }, []);

  return (
    <section className="feed-page">
      {posts.length > 0 ? (
        <div className="notes-grid mood-card-grid">
          {posts.map((post) => {
          const images = post.images || [];
          const imageGroupExpanded = !!expandedImageGroups[post.id];
          const stackStart = images.length ? (stackIndexes[post.id] ?? 0) % images.length : 0;
          const expandedImages = images.slice(0, Math.min(images.length, 5));
          const extraImageCount = Math.max(images.length - 5, 0);
          return (
            <article key={post.id} id={`post-${post.id}`} className="moment-card note-card mood-card">
              <header className="mood-card-head">
                <span className="avatar-lg mood-avatar">
                  {post.author.avatarImage ? <img src={imageVariantUrl(post.author.avatarImage, 160)} alt="" loading="lazy" decoding="async" /> : post.author.avatar}
                </span>
                <div className="mood-author">
                  <h3>{post.author.displayName}</h3>
                  <p>{formatDateTime(post.createdAt)}</p>
                </div>
                {post.mood && <span className="mood-badge">{post.mood}</span>}
                {images.length > 1 && (
                  <button className="mood-image-toggle" type="button" onClick={() => toggleImageGroup(post.id, !imageGroupExpanded)}>
                    {imageGroupExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {imageGroupExpanded ? '收起图片' : '展开图片'}
                  </button>
                )}
              </header>

              {post.content && <p className="moment-content mood-content">{renderRichText(post.content)}</p>}
              {post.video && <video className="moment-video mood-video" src={post.video} controls />}
              {images.length === 1 && (
                <div className="moment-media mood-media single">
                  <button className="note-image-button mood-image-button" type="button" onClick={() => setPreview(images[0].path)}>
                    <img src={imageVariantUrl(images[0].path, 960)} alt="" loading="lazy" decoding="async" />
                  </button>
                </div>
              )}
              {images.length > 1 && (
                <div className={imageGroupExpanded ? 'mood-fold-gallery expanded' : 'mood-fold-gallery'}>
                  {imageGroupExpanded ? (
                    <div className="moment-media mood-media mood-fold-grid mood-expanded-grid">
                      {expandedImages.map((image: any, index: number) => (
                        <button
                          key={image.id || image.path}
                          className={index === 4 && extraImageCount > 0 ? 'note-image-button mood-image-button mood-expanded-overflow' : 'note-image-button mood-image-button'}
                          type="button"
                          onClick={() => setPreview(image.path)}
                        >
                          <img src={imageVariantUrl(image.path, 640)} alt="" loading="lazy" decoding="async" />
                          {index === 4 && extraImageCount > 0 && <span>+{extraImageCount}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <MoodFoldStack
                      postId={post.id}
                      images={images}
                      stackStart={stackStart}
                      onRotate={rotateStack}
                      onPreview={setPreview}
                    />
                  )}
                </div>
              )}

              <div className="moment-stats mood-actions">
                <button type="button" onClick={() => toggleLike(post.id)} className={post.likedByMe ? 'liked' : ''}>
                  <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} />
                  <span>{post.likes?.length || 0}</span>
                </button>
                {images.length === 1 && (
                  <span className="mood-media-count">
                    <ImageIcon size={15} />
                    {images.length} 张
                  </span>
                )}
              </div>

              {post.likes?.length > 0 && <div className="like-strip mood-like-strip">喜欢：{post.likes.map((item: any) => item.displayName).join('、')}</div>}
            </article>
          );
          })}
        </div>
      ) : (
        <EmptyState>还没有说说。</EmptyState>
      )}

      {nextCursor && (
        <div className="feed-more">
          <button className="ghost-btn" type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '加载中' : '加载更多'}
          </button>
        </div>
      )}

      {preview && <ImageViewerPortal src={preview} onClose={() => setPreview('')} />}
    </section>
  );
}
