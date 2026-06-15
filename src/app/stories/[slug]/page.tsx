import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock, Pin } from 'lucide-react';
import { TwikooComments } from '@/components/twikoo-comments';
import { blogPostInclude, canReadBlogPost, serializeBlogPost } from '@/lib/blog';
import { getAuthUserFromCookies } from '@/lib/auth';
import { formatDateTime } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import { estimateReadMinutes } from '@/lib/reading';
import { getSettingMap } from '@/lib/settings';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoryDetailPage({ params }: PageProps) {
  const user = await getAuthUserFromCookies();
  const { slug } = await params;
  const rawStory = await prisma.blogPost.findUnique({ where: { slug }, include: blogPostInclude });
  if (!rawStory) notFound();
  if (!canReadBlogPost(rawStory, user)) notFound();
  const story = serializeBlogPost(rawStory);
  const settings = await getSettingMap();
  const twikooEnvId = settings.get('twikoo_env_id') || process.env.NEXT_PUBLIC_TWIKOO_ENV_ID || '';
  const twikooRegion = settings.get('twikoo_region') ?? process.env.NEXT_PUBLIC_TWIKOO_REGION ?? 'ap-shanghai';

  return (
    <article className="story-detail">
      <Link className="ghost-btn story-back" href="/stories/"><ArrowLeft size={16} /> 返回故事</Link>
      {story.coverImage && <img className="story-detail-cover" src={story.coverImage} alt="" />}
      <header>
        <p className="page-kicker">Love Story</p>
        <h1>{story.title}</h1>
        <div className="story-detail-meta">
          {story.pinned ? <span><Pin size={14} /> 置顶</span> : null}
          {story.visibility === 'private' ? <span><Lock size={14} /> 私密</span> : null}
          {story.isDraft ? <span>草稿</span> : null}
          <span>{story.author.displayName}</span>
          <time>{formatDateTime(story.publishedAt || story.createdAt)}</time>
          <span>{estimateReadMinutes(story.content)} 分钟阅读</span>
        </div>
        {story.excerpt && <p className="story-lead">{story.excerpt}</p>}
        {story.tags.length > 0 && (
          <div className="story-tags compact">
            {story.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
      </header>
      <div className="story-prose">
        {story.content.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <TwikooComments
        envId={twikooEnvId}
        region={twikooRegion}
        path={`/stories/${story.slug}/`}
        title="故事评论"
        emptyText="故事评论暂未配置"
      />
    </article>
  );
}
