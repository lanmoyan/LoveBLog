'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ArrowRight, ImageIcon, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { imageVariantUrl } from '@/lib/image-variants';
import { SEARCH_EXCERPT_LIMIT, truncateText } from '@/lib/text';

type SearchResult = {
  id: string;
  type: string;
  label: string;
  title: string;
  excerpt: string;
  href: string;
  date: string;
  image?: string;
};

type SearchResponse = {
  results?: SearchResult[];
  total?: number;
  engine?: string;
};

const quickWords = ['说说', '故事', '时光', '心愿'];

function SearchResultCard({ item, onOpen }: { item: SearchResult; onOpen: () => void }) {
  const excerpt = truncateText(item.excerpt, SEARCH_EXCERPT_LIMIT);

  return (
    <Link className="search-result-card global-search-card" href={item.href} onClick={onOpen}>
      {item.image ? (
        <img className="global-search-thumb" src={imageVariantUrl(item.image, 240)} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="search-result-icon global-search-thumb">
          <ImageIcon size={17} />
        </span>
      )}
      <span className="global-search-copy">
        <span className="global-search-meta">{item.label} · {item.date}</span>
        <strong className="global-search-title" title={item.title}>{item.title}</strong>
        <small className="global-search-excerpt" title={item.excerpt}>{excerpt}</small>
      </span>
      <ArrowRight className="global-search-arrow" size={18} />
    </Link>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const displayResults = useMemo(() => results.slice(0, 12), [results]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        const res = await fetch(`/api/search/${params.size ? `?${params}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!res.ok) throw new Error('Search request failed');
        const data = (await res.json()) as SearchResponse;
        setResults(data.results || []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError('搜索暂时不可用，请稍后再试。');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 180 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const overlay = (
    <div className="search-overlay global-search-overlay" role="dialog" aria-modal="true">
      <button className="search-scrim" type="button" aria-label="关闭搜索" onClick={() => setOpen(false)} />
      <div className="search-modal global-search-modal">
        <button className="search-close" type="button" aria-label="关闭搜索" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
        <header className="global-search-header">
          <p className="page-kicker">MiniSearch</p>
          <h2>全站搜索</h2>
        </header>
        <form className="search-form" onSubmit={(event) => event.preventDefault()}>
          <Search size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索说说、故事、时光、心愿"
          />
          <span className="search-loading">{loading ? <Loader2 size={17} /> : null}</span>
        </form>
        <div className="search-tags">
          {quickWords.map((item) => (
            <button
              key={item}
              className={query.trim() === item ? 'active' : ''}
              type="button"
              onClick={() => setQuery(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="search-results global-search-results">
          {displayResults.length > 0 ? displayResults.map((item) => (
            <SearchResultCard key={item.id} item={item} onOpen={() => setOpen(false)} />
          )) : (
            <p className="search-empty">{error || (loading ? '正在搜索...' : query.trim() ? '没有找到匹配内容。' : '输入关键词，或选择一个快捷分类。')}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button className="icon-btn nav-search-btn" type="button" onClick={() => setOpen(true)} title="全站搜索" aria-label="全站搜索">
        <Search size={16} />
      </button>
      {open && mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
