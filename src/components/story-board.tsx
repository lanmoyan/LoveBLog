import Link from 'next/link';
import { Lock, Pin } from 'lucide-react';
import type { SerializedBlogPost } from '@/lib/blog';
import { formatDateTime } from '@/lib/dates';
import { imageVariantUrl } from '@/lib/image-variants';
import { estimateReadMinutes } from '@/lib/reading';

type StoryBoardProps = {
  initialStories: SerializedBlogPost[];
};

export function StoryBoard({ initialStories }: StoryBoardProps) {
  return (
    <section className="stories-page">
      {initialStories.length ? (
        <div className="story-grid story-magazine-grid">
          {initialStories.map((story) => (
            <article key={story.id} className={story.pinned ? 'story-card story-magazine-card pinned' : 'story-card story-magazine-card'}>
              <Link className="story-cover-link" href={`/stories/${story.slug}/`} aria-label={story.title}>
                {story.coverImage ? <img src={imageVariantUrl(story.coverImage, 900)} alt="" loading="lazy" decoding="async" /> : <div className="story-cover-fallback">Story</div>}
              </Link>
              <div className="story-card-copy">
                <div className="story-card-meta">
                  <span>爱情故事</span>
                  {story.pinned ? <span><Pin size={13} /> 置顶</span> : null}
                  {story.visibility === 'private' ? <span><Lock size={13} /> 私密</span> : null}
                  {story.isDraft ? <span>草稿</span> : <span>已发布</span>}
                </div>

                <h2><Link href={`/stories/${story.slug}/`}>{story.title}</Link></h2>
                <p>{story.excerpt || story.content.slice(0, 112)}</p>

                <div className="story-card-foot">
                  <div className="story-card-tags">
                    {(story.tags.length ? story.tags.slice(0, 5) : ['日常']).map((tag) => <span key={tag}># {tag}</span>)}
                    <span>{estimateReadMinutes(story.content)} 分钟读完</span>
                  </div>
                  <time>{formatDateTime(story.publishedAt || story.createdAt)}</time>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="empty-state">还没有故事。</div>}
    </section>
  );
}
