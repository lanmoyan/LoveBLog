'use client';

import Link from 'next/link';
import {
  Aperture,
  ArrowDownUp,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  FileImage,
  Filter,
  Home,
  ImageIcon,
  Images,
  Info,
  ListFilter,
  MapPin,
  Moon,
  Search,
  Smartphone,
  Star,
  Sun,
  Tag,
  Zap
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Lightbox, { type ControllerRef } from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import { formatDate } from '@/lib/dates';
import { imageVariantUrl } from '@/lib/image-variants';

type AlbumImageMeta = {
  make?: string;
  model?: string;
  date?: string;
  time?: string;
  taken_at?: string;
  aperture?: string;
  iso?: string;
  exposure?: string;
  focal_length?: string;
  focal_length_35mm?: string;
  max_aperture?: string;
  pixel_width?: string;
  pixel_height?: string;
  color_space?: string;
  exposure_program?: string;
  exposure_mode?: string;
  metering_mode?: string;
  white_balance?: string;
  flash?: string;
  brightness?: string;
  orientation?: string;
  software?: string;
  x_resolution?: string;
  y_resolution?: string;
  resolution_unit?: string;
  digital_zoom_ratio?: string;
  sensing_method?: string;
  latitude?: string;
  longitude?: string;
  gps?: string;
  gps_decimal?: string;
};

type AlbumImage = {
  id?: number | string;
  path: string;
  title?: string;
  description?: string;
  tags?: string[];
  mood?: string;
  author?: string;
  createdAt?: string | Date;
  fileName?: string;
  fileSize?: string;
  imageMeta?: AlbumImageMeta;
};

type Dimensions = Record<string, string>;
type PhotoItem = { image: AlbumImage; index: number };
type AlbumView = 'wall' | 'albums' | 'album-detail';
type AlbumTheme = 'light' | 'dark';
type FilterCategory = 'tags' | 'camera' | 'lens' | 'city' | 'rating';
type SortValue = 'newest' | 'oldest' | 'size-asc' | 'size-desc' | 'title-asc' | 'title-desc';
type ActivePopup = 'filter' | 'sort' | null;

type AlbumGroup = {
  id: string;
  title: string;
  description: string;
  items: PhotoItem[];
  coverItems: PhotoItem[];
  rangeLabel: string;
  createdLabel: string;
};

const filterTabs: Array<{ id: FilterCategory; label: string; icon: ReactNode }> = [
  { id: 'tags', label: '标签', icon: <Tag size={15} /> },
  { id: 'camera', label: '相机', icon: <Camera size={15} /> },
  { id: 'lens', label: '镜头', icon: <Aperture size={15} /> },
  { id: 'city', label: '城市', icon: <MapPin size={15} /> },
  { id: 'rating', label: '评分', icon: <Star size={15} /> }
];

const sortOptions: Array<{ id: SortValue; label: string; icon: ReactNode }> = [
  { id: 'newest', label: '日期(最新的在前)', icon: <ArrowDownUp size={16} /> },
  { id: 'oldest', label: '日期(最旧的在前)', icon: <ArrowDownUp size={16} /> },
  { id: 'size-asc', label: '文件大小(升序)', icon: <FileImage size={16} /> },
  { id: 'size-desc', label: '文件大小(降序)', icon: <FileImage size={16} /> },
  { id: 'title-asc', label: '标题(A-Z)', icon: <ListFilter size={16} /> },
  { id: 'title-desc', label: '标题(Z-A)', icon: <ListFilter size={16} /> }
];

const cityHints = [
  '上海',
  '北京',
  '杭州',
  '广州',
  '深圳',
  '成都',
  '武汉',
  '西安',
  '贵阳',
  '贵州',
  '陕西',
  '四川',
  '重庆',
  '南京',
  '苏州',
  '厦门',
  '长沙'
];

function imageKey(image: AlbumImage, index: number) {
  return String(image.id || image.path || index);
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, limit = 62) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function normalizeTags(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 12)
    : [];
}

function cameraName(meta: AlbumImageMeta = {}) {
  return [meta.make, meta.model].filter(Boolean).join(' ').trim() || meta.model || '';
}

function rawTakenAt(image: AlbumImage) {
  const meta = image.imageMeta || {};
  return meta.taken_at || [meta.date, meta.time].filter(Boolean).join(' ') || image.createdAt || '';
}

function parsePhotoDate(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    .replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
    .replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function photoTime(image: AlbumImage) {
  const parsed = parsePhotoDate(rawTakenAt(image));
  if (parsed) return parsed.getTime();
  const fallback = image.createdAt ? new Date(image.createdAt).getTime() : 0;
  return Number.isFinite(fallback) ? fallback : 0;
}

function takenAt(image: AlbumImage) {
  const raw = rawTakenAt(image);
  return raw ? String(raw) : formatDate(image.createdAt);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dateStamp(image: AlbumImage) {
  const date = parsePhotoDate(rawTakenAt(image));
  if (!date) return takenAt(image);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function rangeDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function dateRangeLabel(values: unknown[]) {
  const dates = values
    .map(parsePhotoDate)
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return '';

  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.toDateString() === last.toDateString()) return rangeDate(first);
  return `${rangeDate(first)} - ${rangeDate(last)}`;
}

function relativeTimeLabel(values: unknown[]) {
  const dates = values
    .map(parsePhotoDate)
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime());
  if (!dates.length) return '刚刚';

  const days = Math.max(0, Math.floor((Date.now() - dates[0].getTime()) / 86400000));
  if (days <= 0) return '今天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.max(1, Math.floor(days / 30))} 个月前`;
  return `${Math.max(1, Math.floor(days / 365))} 年前`;
}

function metaValue(value: unknown, fallback = '暂无') {
  return cleanText(value) || fallback;
}

function coordinateText(meta: AlbumImageMeta = {}) {
  return meta.gps || [meta.latitude, meta.longitude].filter(Boolean).join(' ') || meta.gps_decimal || '';
}

function resolutionText(meta: AlbumImageMeta, dimensions: string) {
  return dimensions || (meta.pixel_width && meta.pixel_height ? `${meta.pixel_width} x ${meta.pixel_height}` : '');
}

function megapixelsText(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return '';
  const pixels = Number(match[1]) * Number(match[2]);
  return Number.isFinite(pixels) && pixels > 0 ? `${(pixels / 1000000).toFixed(2)} MP` : '';
}

function resolutionUnitText(meta: AlbumImageMeta = {}) {
  if (!meta.x_resolution && !meta.y_resolution) return '';
  const unit = meta.resolution_unit ? ` / ${meta.resolution_unit}` : '';
  return `${meta.x_resolution || '-'} x ${meta.y_resolution || '-'}${unit}`;
}

function dimensionRatio(image: AlbumImage, dimensions: Dimensions, index: number) {
  const key = imageKey(image, index);
  const value = dimensions[key];
  const match = value?.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  const width = Number(match?.[1] || image.imageMeta?.pixel_width || 0);
  const height = Number(match?.[2] || image.imageMeta?.pixel_height || 0);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width / height;
  return [1.18, .72, 1.42, .86, 1.66, .64][index % 6];
}

function buildMasonryColumns(items: PhotoItem[], columnCount: number, dimensions: Dimensions, initialHeights: number[] = []) {
  const columns = Array.from({ length: columnCount }, () => [] as PhotoItem[]);
  const heights = Array.from({ length: columnCount }, (_, index) => initialHeights[index] || 0);

  items.forEach((item) => {
    const ratio = Math.max(.48, Math.min(2.35, dimensionRatio(item.image, dimensions, item.index)));
    const target = heights.indexOf(Math.min(...heights));
    columns[target].push(item);
    heights[target] += 1 / ratio;
  });

  return columns;
}

function photoSpecs(meta: AlbumImageMeta = {}) {
  return [
    meta.focal_length_35mm || meta.focal_length,
    meta.aperture,
    meta.exposure,
    meta.iso ? `ISO ${String(meta.iso).replace(/^ISO\s*/i, '')}` : ''
  ].filter(Boolean);
}

function photoTitle(image: AlbumImage, index: number) {
  const customTitle = cleanText(image.title);
  const stamp = dateStamp(image);
  return customTitle || (stamp ? `${stamp} 的照片` : `相册图片 ${index + 1}`);
}

function searchableText(image: AlbumImage, index: number) {
  const meta = image.imageMeta || {};
  return [
    photoTitle(image, index),
    image.description,
    image.mood,
    image.author,
    image.fileName,
    cameraName(meta),
    coordinateText(meta),
    ...normalizeTags(image.tags),
    ...photoSpecs(meta)
  ].filter(Boolean).join(' ').toLowerCase();
}

function parseFileSizeBytes(value: unknown) {
  const raw = String(value || '').trim();
  const match = raw.match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (!Number.isFinite(amount)) return 0;
  if (unit === 'GB') return amount * 1024 * 1024 * 1024;
  if (unit === 'MB') return amount * 1024 * 1024;
  if (unit === 'KB') return amount * 1024;
  return amount;
}

function collectOptions(items: PhotoItem[], filterCategory: FilterCategory) {
  const counts = new Map<string, number>();
  const push = (value: string) => {
    const label = cleanText(value);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  };

  items.forEach(({ image, index }) => {
    const meta = image.imageMeta || {};
    const text = searchableText(image, index);

    if (filterCategory === 'tags') {
      normalizeTags(image.tags).forEach(push);
      push(cleanText(image.mood));
    }
    if (filterCategory === 'camera') push(cameraName(meta));
    if (filterCategory === 'lens') {
      push(cleanText(meta.focal_length_35mm || meta.focal_length));
      push(cleanText(meta.aperture));
    }
    if (filterCategory === 'city') {
      cityHints.forEach((city) => {
        if (text.includes(city.toLowerCase())) push(city);
      });
      normalizeTags(image.tags).forEach((tag) => {
        if (cityHints.some((city) => tag.includes(city))) push(tag);
      });
    }
    if (filterCategory === 'rating') {
      if (cleanText(image.description)) push('有描述');
      if (cleanText(image.title)) push('有标题');
      if (coordinateText(meta)) push('有坐标');
      if (cameraName(meta)) push('有设备');
      if (photoSpecs(meta).length) push('有参数');
    }
  });

  const options = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, 24)
    .map(([label, count]) => ({ label, count }));

  return options.length ? options : [{ label: '有照片', count: items.length }];
}

function itemMatchesFilter(item: PhotoItem, category: FilterCategory, value: string) {
  if (value === 'all') return true;

  const { image, index } = item;
  const meta = image.imageMeta || {};
  const text = searchableText(image, index);

  if (category === 'tags') {
    return [cleanText(image.mood), ...normalizeTags(image.tags)].some((tag) => tag === value);
  }
  if (category === 'camera') return cameraName(meta) === value;
  if (category === 'lens') return photoSpecs(meta).some((spec) => spec === value);
  if (category === 'city') return text.includes(value.toLowerCase());
  if (category === 'rating') {
    if (value === '有描述') return Boolean(cleanText(image.description));
    if (value === '有标题') return Boolean(cleanText(image.title));
    if (value === '有坐标') return Boolean(coordinateText(meta));
    if (value === '有设备') return Boolean(cameraName(meta));
    if (value === '有参数') return photoSpecs(meta).length > 0;
  }

  return true;
}

function sortPhotoItems(items: PhotoItem[], sortValue: SortValue) {
  return [...items].sort((a, b) => {
    if (sortValue === 'newest') return photoTime(b.image) - photoTime(a.image);
    if (sortValue === 'oldest') return photoTime(a.image) - photoTime(b.image);
    if (sortValue === 'size-asc') return parseFileSizeBytes(a.image.fileSize) - parseFileSizeBytes(b.image.fileSize);
    if (sortValue === 'size-desc') return parseFileSizeBytes(b.image.fileSize) - parseFileSizeBytes(a.image.fileSize);

    const titleA = photoTitle(a.image, a.index);
    const titleB = photoTitle(b.image, b.index);
    return sortValue === 'title-asc'
      ? titleA.localeCompare(titleB, 'zh-CN')
      : titleB.localeCompare(titleA, 'zh-CN');
  });
}

function albumTitleForImage(image: AlbumImage, index: number) {
  const mood = cleanText(image.mood);
  const tags = normalizeTags(image.tags);
  const title = cleanText(image.title);
  const author = cleanText(image.author);
  const date = parsePhotoDate(rawTakenAt(image));

  if (mood) return mood;
  if (tags[0]) return tags[0];
  if (title && title !== author) return title;
  if (date) return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  return '日常碎片';
}

function buildAlbumGroups(items: PhotoItem[], siteTitle: string): AlbumGroup[] {
  const groups = new Map<string, PhotoItem[]>();
  items.forEach((item) => {
    const title = albumTitleForImage(item.image, item.index);
    const key = title.toLowerCase();
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  });

  const groupedAlbums = Array.from(groups.entries()).map(([id, albumItems]) => {
    const title = albumTitleForImage(albumItems[0].image, albumItems[0].index);
    const description = truncateText(albumItems.map(({ image }) => image.description).find((value) => cleanText(value)) || `${title}里的 ${albumItems.length} 张照片`);
    return {
      id: `group-${id}`,
      title,
      description,
      items: sortPhotoItems(albumItems, 'newest'),
      coverItems: sortPhotoItems(albumItems, 'newest').slice(0, 3),
      rangeLabel: dateRangeLabel(albumItems.map(({ image }) => rawTakenAt(image))),
      createdLabel: relativeTimeLabel(albumItems.map(({ image }) => rawTakenAt(image)))
    };
  }).sort((a, b) => photoTime(b.items[0].image) - photoTime(a.items[0].image));

  const allItems = sortPhotoItems(items, 'newest');
  const allAlbum: AlbumGroup = {
    id: 'all',
    title: `${siteTitle || '我们'}相册`,
    description: '所有照片都在这里，按时间和记忆慢慢展开。',
    items: allItems,
    coverItems: allItems.slice(0, 3),
    rangeLabel: dateRangeLabel(allItems.map(({ image }) => rawTakenAt(image))),
    createdLabel: relativeTimeLabel(allItems.map(({ image }) => rawTakenAt(image)))
  };

  return [allAlbum, ...groupedAlbums];
}

function MetaRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="album-meta-row">
      <span>{icon}{label}</span>
      <b>{value || '暂无'}</b>
    </div>
  );
}

function AlbumFilterPanel({
  category,
  options,
  query,
  activeValue,
  totalCount,
  visibleCount,
  onCategoryChange,
  onQueryChange,
  onValueChange
}: {
  category: FilterCategory;
  options: Array<{ label: string; count: number }>;
  query: string;
  activeValue: string;
  totalCount: number;
  visibleCount: number;
  onCategoryChange: (value: FilterCategory) => void;
  onQueryChange: (value: string) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="album-floating-panel album-filter-panel" role="dialog" aria-label="筛选照片">
      <header>
        <strong>筛选照片</strong>
        <span>{visibleCount} / {totalCount}</span>
      </header>
      <label className="album-filter-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题、标签、相机"
        />
      </label>
      <div className="album-filter-tabs" role="tablist" aria-label="筛选类型">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === category ? 'active' : undefined}
            type="button"
            onClick={() => onCategoryChange(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="album-filter-chips" aria-label="筛选项">
        <button className={activeValue === 'all' ? 'active' : undefined} type="button" onClick={() => onValueChange('all')}>
          全部
        </button>
        {options.map((option) => (
          <button
            key={option.label}
            className={activeValue === option.label ? 'active' : undefined}
            type="button"
            onClick={() => onValueChange(option.label)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlbumSortPanel({
  value,
  onChange
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
}) {
  return (
    <div className="album-floating-panel album-sort-panel" role="dialog" aria-label="照片排序">
      <header>
        <strong>排序方式</strong>
      </header>
      <div className="album-sort-options">
        {sortOptions.map((option) => (
          <button
            key={option.id}
            className={option.id === value ? 'active' : undefined}
            type="button"
            onClick={() => onChange(option.id)}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.id === value ? <Check size={15} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlbumIntroCard({
  siteTitle,
  siteIcon,
  photoCount,
  totalCount,
  rangeLabel,
  theme,
  activePopup,
  filterCategory,
  filterOptions,
  filterQuery,
  activeFilter,
  sortValue,
  onOpenAlbums,
  onToggleFilter,
  onToggleSort,
  onToggleTheme,
  onFilterCategoryChange,
  onFilterQueryChange,
  onActiveFilterChange,
  onSortChange
}: {
  siteTitle: string;
  siteIcon?: string;
  photoCount: number;
  totalCount: number;
  rangeLabel: string;
  theme: AlbumTheme;
  activePopup: ActivePopup;
  filterCategory: FilterCategory;
  filterOptions: Array<{ label: string; count: number }>;
  filterQuery: string;
  activeFilter: string;
  sortValue: SortValue;
  onOpenAlbums: () => void;
  onToggleFilter: () => void;
  onToggleSort: () => void;
  onToggleTheme: () => void;
  onFilterCategoryChange: (value: FilterCategory) => void;
  onFilterQueryChange: (value: string) => void;
  onActiveFilterChange: (value: string) => void;
  onSortChange: (value: SortValue) => void;
}) {
  const summary = photoCount
    ? `${rangeLabel ? `${rangeLabel}，` : ''}共 ${photoCount}${photoCount !== totalCount ? ` / ${totalCount}` : ''} 张照片`
    : '还没有匹配的照片。';

  return (
    <article className="album-intro-card">
      <div className="album-avatar">
        {siteIcon ? <img src={siteIcon} alt="" /> : <ImageIcon size={32} />}
      </div>
      <h1>{siteTitle || '相册'}</h1>
      <p>{summary}</p>
      <strong>Sharing fleeting moments into poetry.</strong>
      <div className="album-intro-tools" aria-label="相册工具">
        <button type="button" onClick={onOpenAlbums} aria-label="相簿" title="相簿">
          <Images size={15} />
        </button>
        <Link className="album-tool-link" href="/" aria-label="返回首页" title="返回首页">
          <Home size={15} />
        </Link>
        <button className={activePopup === 'filter' ? 'active' : undefined} type="button" onClick={onToggleFilter} aria-label="筛选图片" title="筛选图片">
          <Filter size={15} />
        </button>
        <button className={activePopup === 'sort' ? 'active' : undefined} type="button" onClick={onToggleSort} aria-label="照片排序" title="照片排序">
          <ListFilter size={15} />
        </button>
        <button type="button" onClick={onToggleTheme} aria-label="明暗色切换" title="明暗色切换">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      {activePopup === 'filter' ? (
        <AlbumFilterPanel
          category={filterCategory}
          options={filterOptions}
          query={filterQuery}
          activeValue={activeFilter}
          totalCount={totalCount}
          visibleCount={photoCount}
          onCategoryChange={onFilterCategoryChange}
          onQueryChange={onFilterQueryChange}
          onValueChange={onActiveFilterChange}
        />
      ) : null}
      {activePopup === 'sort' ? (
        <AlbumSortPanel value={sortValue} onChange={onSortChange} />
      ) : null}
      <div className="album-intro-foot">
        <span>© {new Date().getFullYear()} {siteTitle || 'Album'}</span>
        <span>ChronoFrame</span>
      </div>
    </article>
  );
}

function PhotoTile({
  item,
  dimensions,
  onOpen,
  rememberDimensions
}: {
  item: PhotoItem;
  dimensions: Dimensions;
  onOpen: (index: number) => void;
  rememberDimensions: (key: string, width: number, height: number) => void;
}) {
  const { image, index } = item;
  const key = imageKey(image, index);
  const meta = image.imageMeta || {};
  const camera = cameraName(meta);
  const customTitle = cleanText(image.title);
  const stamp = dateStamp(image);
  const title = photoTitle(image, index);
  const description = cleanText(image.description);
  const mood = cleanText(image.mood);
  const tags = normalizeTags(image.tags);
  const specs = photoSpecs(meta);
  const ratio = Math.max(.78, Math.min(1.55, dimensionRatio(image, dimensions, index)));

  return (
    <article
      className="album-masonry-item"
      data-photo-index={index}
      data-photo-date={String(rawTakenAt(image) || '')}
      style={{ aspectRatio: String(ratio) }}
    >
      <button type="button" onClick={() => onOpen(index)} aria-label={`查看照片：${title}`}>
        <img
          src={imageVariantUrl(image.path, 960)}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={(event) => rememberDimensions(key, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
        />
        <span className="album-hover-meta">
          <b>{customTitle || stamp || '相册图片'}</b>
          {description && <small>{description}</small>}
          {stamp && <time>{stamp}</time>}
          {(mood || tags.length > 0) && (
            <span className="album-card-tags">
              {mood && <i>{mood}</i>}
              {tags.map((tag) => <i key={tag}>{tag}</i>)}
            </span>
          )}
          {camera && <em className="album-hover-camera"><Smartphone size={14} />{camera}</em>}
          {specs.length > 0 && <span className="album-hover-specs">{specs.join('  ')}</span>}
        </span>
      </button>
    </article>
  );
}

function AlbumCollectionPage({
  albums,
  images,
  theme,
  onOpenAlbum
}: {
  albums: AlbumGroup[];
  images: AlbumImage[];
  theme: AlbumTheme;
  onOpenAlbum: (albumId: string) => void;
}) {
  const backgroundImages = images.slice(0, 18);

  return (
    <section className={`album-page album-collection-view album-theme-${theme}`}>
      <div className="album-collage-bg" aria-hidden="true">
        {backgroundImages.map((image, index) => (
          <img key={imageKey(image, index)} src={imageVariantUrl(image.path, 720)} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <Link className="album-home-link" href="/" aria-label="返回首页">
        <ArrowLeft size={16} />
        返回首页
      </Link>
      <header className="album-collection-header">
        <h1>相簿</h1>
        <p>Shaping fleeting moments into poetry.</p>
      </header>
      <div className="album-stack-list">
        {albums.map((album) => (
          <button key={album.id} className="album-stack-card" type="button" onClick={() => onOpenAlbum(album.id)}>
            <span className="album-cover-stack" aria-hidden="true">
              {album.coverItems.slice(0, 3).map(({ image, index }, coverIndex) => (
                <img
                  key={imageKey(image, index)}
                  className={`cover-${coverIndex}`}
                  src={imageVariantUrl(image.path, 520)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </span>
            <span className="album-stack-copy">
              <b>{album.title}</b>
              <small>{album.description}</small>
            </span>
            <span className="album-stack-meta">
              <Clock3 size={15} />
              {album.createdLabel}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AlbumDetailPage({
  album,
  columns,
  dimensions,
  theme,
  onBack,
  onOpenPhoto,
  rememberDimensions
}: {
  album: AlbumGroup;
  columns: PhotoItem[][];
  dimensions: Dimensions;
  theme: AlbumTheme;
  onBack: () => void;
  onOpenPhoto: (index: number) => void;
  rememberDimensions: (key: string, width: number, height: number) => void;
}) {
  return (
    <section className={`album-page album-detail-view album-theme-${theme}`}>
      <header className="album-detail-head">
        <button className="album-detail-back" type="button" onClick={onBack} aria-label="返回相簿">
          <ArrowLeft size={18} />
        </button>
        <h1>{album.title}</h1>
        <p>{album.description}</p>
        <div className="album-detail-meta">
          <span><ImageIcon size={16} />{album.items.length} 照片</span>
          {album.rangeLabel ? <span><CalendarDays size={16} />{album.rangeLabel}</span> : null}
          <span><Clock3 size={16} />创建 {album.createdLabel}</span>
        </div>
      </header>
      <div
        className="album-detail-masonry"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}
        aria-label={`${album.title}照片`}
      >
        {columns.map((column, columnIndex) => (
          <div className="album-masonry-column" key={`album-column-${columnIndex}`}>
            {column.map((item) => (
              <PhotoTile
                key={imageKey(item.image, item.index)}
                item={item}
                dimensions={dimensions}
                onOpen={onOpenPhoto}
                rememberDimensions={rememberDimensions}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AlbumGallery({ images, siteTitle = '相册', siteIcon = '' }: { images: AlbumImage[]; siteTitle?: string; siteIcon?: string }) {
  const [lightboxState, setLightboxState] = useState<{ items: PhotoItem[]; index: number } | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({});
  const [columnCount, setColumnCount] = useState(4);
  const [visibleDateRange, setVisibleDateRange] = useState('');
  const [showDateIndicator, setShowDateIndicator] = useState(false);
  const [albumView, setAlbumView] = useState<AlbumView>('wall');
  const [selectedAlbumId, setSelectedAlbumId] = useState('all');
  const [theme, setTheme] = useState<AlbumTheme>('light');
  const [loadingCoverVisible, setLoadingCoverVisible] = useState(true);
  const [activePopup, setActivePopup] = useState<ActivePopup>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('tags');
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortValue, setSortValue] = useState<SortValue>('newest');
  const pageRef = useRef<HTMLElement | null>(null);

  const allItems = useMemo(() => images.map((image, index) => ({ image, index })), [images]);
  const filterOptions = useMemo(() => collectOptions(allItems, filterCategory), [allItems, filterCategory]);
  const displayItems = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const filtered = allItems.filter((item) => {
      const matchesQuery = !query || searchableText(item.image, item.index).includes(query);
      return matchesQuery && itemMatchesFilter(item, filterCategory, activeFilter);
    });
    return sortPhotoItems(filtered, sortValue);
  }, [activeFilter, allItems, filterCategory, filterQuery, sortValue]);
  const albums = useMemo(() => buildAlbumGroups(allItems, siteTitle), [allItems, siteTitle]);
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) || albums[0];
  const displayColumnCount = Math.max(1, columnCount);
  const columns = useMemo(
    () => buildMasonryColumns(displayItems, displayColumnCount, dimensions, displayColumnCount > 1 ? [1.04] : [0]),
    [displayItems, displayColumnCount, dimensions]
  );
  const detailColumns = useMemo(
    () => selectedAlbum ? buildMasonryColumns(selectedAlbum.items, displayColumnCount, dimensions) : [],
    [selectedAlbum, displayColumnCount, dimensions]
  );
  const archiveRangeLabel = useMemo(() => dateRangeLabel(displayItems.map(({ image }) => rawTakenAt(image))), [displayItems]);

  function rememberDimensions(key: string, width: number, height: number) {
    if (!width || !height) return;
    const value = `${width} x ${height}`;
    setDimensions((current) => current[key] === value ? current : { ...current, [key]: value });
  }

  function openLightbox(items: PhotoItem[], originalIndex: number) {
    const index = Math.max(0, items.findIndex((item) => item.index === originalIndex));
    setLightboxState({ items, index });
  }

  function syncAlbumTheme(nextTheme: AlbumTheme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('love-next-theme', nextTheme);
  }

  function toggleAlbumTheme() {
    syncAlbumTheme(theme === 'dark' ? 'light' : 'dark');
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('love-next-theme');
    const rootTheme = document.documentElement.dataset.theme;
    const nextTheme: AlbumTheme = rootTheme === 'dark' || stored === 'dark' ? 'dark' : 'light';
    setTheme(nextTheme);

    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      setTheme(currentTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const timer = window.setTimeout(() => setLoadingCoverVisible(false), 520);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (activeFilter !== 'all' && !filterOptions.some((option) => option.label === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, filterOptions]);

  useEffect(() => {
    const updateColumns = () => {
      const width = pageRef.current?.clientWidth || window.innerWidth;
      const next = width >= 1360 ? 5 : width >= 1060 ? 4 : width >= 680 ? 2 : 1;
      setColumnCount((current) => current === next ? current : next);
    };

    updateColumns();
    const observer = typeof ResizeObserver !== 'undefined' && pageRef.current
      ? new ResizeObserver(updateColumns)
      : null;
    if (pageRef.current) observer?.observe(pageRef.current);
    window.addEventListener('resize', updateColumns);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateColumns);
    };
  }, [albumView]);

  useEffect(() => {
    if (!displayItems.length || !pageRef.current || albumView !== 'wall') {
      setShowDateIndicator(false);
      return;
    }

    const visible = new Set<number>();
    const updateRange = () => {
      const values = Array.from(visible).map((index) => rawTakenAt(images[index])).filter(Boolean);
      const label = dateRangeLabel(values);
      const shouldShow = Boolean(label) && window.scrollY > 160;
      setVisibleDateRange(label);
      setShowDateIndicator(shouldShow);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number((entry.target as HTMLElement).dataset.photoIndex);
        if (!Number.isFinite(index)) return;
        if (entry.isIntersecting) visible.add(index);
        else visible.delete(index);
      });
      updateRange();
    }, {
      rootMargin: '-86px 0px -45% 0px',
      threshold: .16
    });
    const items = pageRef.current.querySelectorAll<HTMLElement>('[data-photo-index]');
    items.forEach((item) => observer.observe(item));
    const onScroll = () => updateRange();
    window.addEventListener('scroll', onScroll, { passive: true });
    updateRange();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [albumView, displayItems, displayColumnCount, images]);

  if (!images.length) {
    return (
      <section className={`album-page album-immersive album-empty-view album-theme-${theme}`} ref={pageRef}>
        {loadingCoverVisible ? <AlbumLoadingCover siteIcon={siteIcon} siteTitle={siteTitle} /> : null}
        <div className="album-empty-frame">
          <AlbumIntroCard
            siteTitle={siteTitle}
            siteIcon={siteIcon}
            photoCount={0}
            totalCount={0}
            rangeLabel=""
            theme={theme}
            activePopup={activePopup}
            filterCategory={filterCategory}
            filterOptions={filterOptions}
            filterQuery={filterQuery}
            activeFilter={activeFilter}
            sortValue={sortValue}
            onOpenAlbums={() => setAlbumView('albums')}
            onToggleFilter={() => setActivePopup((current) => current === 'filter' ? null : 'filter')}
            onToggleSort={() => setActivePopup((current) => current === 'sort' ? null : 'sort')}
            onToggleTheme={toggleAlbumTheme}
            onFilterCategoryChange={(value) => {
              setFilterCategory(value);
              setActiveFilter('all');
            }}
            onFilterQueryChange={setFilterQuery}
            onActiveFilterChange={setActiveFilter}
            onSortChange={setSortValue}
          />
          <div className="album-empty-photo">
            <ImageIcon size={34} />
            <strong>暂无照片</strong>
            <span>在后台上传照片后，这里会自动生成 ChronoFrame 风格的照片墙。</span>
          </div>
        </div>
      </section>
    );
  }

  if (albumView === 'albums') {
    return (
      <AlbumCollectionPage
        albums={albums}
        images={images}
        theme={theme}
        onOpenAlbum={(albumId) => {
          setSelectedAlbumId(albumId);
          setAlbumView('album-detail');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  if (albumView === 'album-detail' && selectedAlbum) {
    return (
      <>
        <AlbumDetailPage
          album={selectedAlbum}
          columns={detailColumns}
          dimensions={dimensions}
          theme={theme}
          onBack={() => {
            setAlbumView('albums');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenPhoto={(index) => openLightbox(selectedAlbum.items, index)}
          rememberDimensions={rememberDimensions}
        />
        {lightboxState ? (
          <AlbumLightbox
            items={lightboxState.items}
            activeIndex={lightboxState.index}
            dimensions={dimensions}
            rememberDimensions={rememberDimensions}
            onClose={() => setLightboxState(null)}
            onChange={(index) => setLightboxState((current) => current ? { ...current, index } : current)}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className={`album-page album-immersive album-theme-${theme}`} ref={pageRef}>
      {loadingCoverVisible ? <AlbumLoadingCover siteIcon={siteIcon} siteTitle={siteTitle} /> : null}
      <div className={showDateIndicator && visibleDateRange ? 'album-date-indicator show' : 'album-date-indicator'} aria-hidden={!showDateIndicator}>
        <CalendarDays size={15} />
        <span>{visibleDateRange}</span>
      </div>
      <div
        className={`album-masonry${displayItems.length <= 3 ? ' is-sparse' : ''}`}
        aria-label="相册照片墙"
        style={{ gridTemplateColumns: `repeat(${displayColumnCount}, minmax(0, 1fr))` }}
      >
        {columns.map((column, columnIndex) => (
          <div className="album-masonry-column" key={`column-${columnIndex}`}>
            {columnIndex === 0 && (
              <AlbumIntroCard
                siteTitle={siteTitle}
                siteIcon={siteIcon}
                photoCount={displayItems.length}
                totalCount={images.length}
                rangeLabel={archiveRangeLabel}
                theme={theme}
                activePopup={activePopup}
                filterCategory={filterCategory}
                filterOptions={filterOptions}
                filterQuery={filterQuery}
                activeFilter={activeFilter}
                sortValue={sortValue}
                onOpenAlbums={() => {
                  setActivePopup(null);
                  setAlbumView('albums');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onToggleFilter={() => setActivePopup((current) => current === 'filter' ? null : 'filter')}
                onToggleSort={() => setActivePopup((current) => current === 'sort' ? null : 'sort')}
                onToggleTheme={toggleAlbumTheme}
                onFilterCategoryChange={(value) => {
                  setFilterCategory(value);
                  setActiveFilter('all');
                }}
                onFilterQueryChange={setFilterQuery}
                onActiveFilterChange={setActiveFilter}
                onSortChange={setSortValue}
              />
            )}
            {column.map((item) => (
              <PhotoTile
                key={imageKey(item.image, item.index)}
                item={item}
                dimensions={dimensions}
                onOpen={(index) => openLightbox(displayItems, index)}
                rememberDimensions={rememberDimensions}
              />
            ))}
          </div>
        ))}
      </div>
      {!displayItems.length ? (
        <div className="album-no-results">
          <ImageIcon size={28} />
          <strong>没有匹配的照片</strong>
          <button type="button" onClick={() => {
            setFilterQuery('');
            setActiveFilter('all');
          }}>
            重置筛选
          </button>
        </div>
      ) : null}

      {lightboxState ? (
        <AlbumLightbox
          items={lightboxState.items}
          activeIndex={lightboxState.index}
          dimensions={dimensions}
          rememberDimensions={rememberDimensions}
          onClose={() => setLightboxState(null)}
          onChange={(index) => setLightboxState((current) => current ? { ...current, index } : current)}
        />
      ) : null}
    </section>
  );
}

function AlbumLoadingCover({ siteIcon, siteTitle }: { siteIcon?: string; siteTitle: string }) {
  return (
    <div className="album-loading-cover" aria-label="相册加载中" role="status">
      <span>
        {siteIcon ? <img src={siteIcon} alt="" /> : <ImageIcon size={34} />}
      </span>
      <b>{siteTitle}</b>
    </div>
  );
}

function AlbumLightbox({
  items,
  activeIndex,
  dimensions,
  rememberDimensions,
  onClose,
  onChange
}: {
  items: PhotoItem[];
  activeIndex: number;
  dimensions: Dimensions;
  rememberDimensions: (key: string, width: number, height: number) => void;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const controllerRef = useRef<ControllerRef | null>(null);
  const wheelLockRef = useRef(0);
  const [showMobileMeta, setShowMobileMeta] = useState(false);
  const activeItem = items[activeIndex];
  const active = activeItem?.image;
  const originalIndex = activeItem?.index ?? activeIndex;
  const key = active ? imageKey(active, originalIndex) : '';
  const activeRatio = active ? dimensionRatio(active, dimensions, originalIndex) : 1;
  const activePreviewSrc = active ? imageVariantUrl(active.path, 1800) : '';
  const slides = useMemo(
    () => items.map(({ image, index }) => ({
      src: imageVariantUrl(image.path, 1800),
      alt: photoTitle(image, index)
    })),
    [items]
  );
  const lightboxStyle = useMemo(() => ({
    '--yarl__album_lightbox_bg_image': `url("${String(activePreviewSrc).replace(/["\\]/g, '\\$&')}")`
  }) as CSSProperties & Record<`--yarl__${string}`, string>, [activePreviewSrc]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const probe = new window.Image();
    probe.onload = () => rememberDimensions(key, probe.naturalWidth, probe.naturalHeight);
    probe.src = activePreviewSrc;
  }, [active, activePreviewSrc, key, rememberDimensions]);

  useEffect(() => {
    setShowMobileMeta(false);
  }, [activeIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onWheel(event: WheelEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.album-yarl-meta')) return;
      if (Math.abs(event.deltaY) < 24 && Math.abs(event.deltaX) < 24) return;

      event.preventDefault();
      const now = Date.now();
      if (now - wheelLockRef.current < 360) return;
      wheelLockRef.current = now;

      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta > 0) controllerRef.current?.next();
      else controllerRef.current?.prev();
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  if (!active) return null;

  return (
    <Lightbox
      open
      className={`album-global-lightbox${activeRatio > 1.48 ? ' is-wide' : ''}`}
      close={onClose}
      index={activeIndex}
      slides={slides}
      plugins={[Zoom, Thumbnails]}
      styles={{ root: lightboxStyle }}
      carousel={{
        finite: items.length <= 1,
        imageFit: 'contain'
      }}
      controller={{
        ref: controllerRef,
        touchAction: 'none'
      }}
      thumbnails={{
        position: 'bottom',
        width: 64,
        height: 64,
        border: 2,
        borderRadius: 8,
        padding: 3,
        gap: 10,
        imageFit: 'contain',
        vignette: true,
        showToggle: false
      }}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        scrollToZoom: false
      }}
      on={{
        view: ({ index }) => onChange(index)
      }}
      render={{
        controls: () => (
          <>
            <button
              className={`album-mobile-meta-toggle${showMobileMeta ? ' active' : ''}`}
              type="button"
              aria-label={showMobileMeta ? '关闭图片参数' : '查看图片参数'}
              onClick={() => setShowMobileMeta((current) => !current)}
            >
              <Info size={18} />
            </button>
            <LightboxMetaPanel
              image={active}
              originalIndex={originalIndex}
              dimensions={dimensions}
              mobileOpen={showMobileMeta}
            />
          </>
        )
      }}
    />
  );
}

function LightboxMetaPanel({
  image,
  originalIndex,
  dimensions,
  mobileOpen
}: {
  image: AlbumImage;
  originalIndex: number;
  dimensions: Dimensions;
  mobileOpen: boolean;
}) {
  const key = imageKey(image, originalIndex);
  const meta = image.imageMeta || {};
  const camera = cameraName(meta);
  const title = cleanText(image.title, '相册图片');
  const description = cleanText(image.description, `${image.author || '我们'} 保存的照片`);
  const mood = cleanText(image.mood);
  const tags = normalizeTags(image.tags);
  const resolution = resolutionText(meta, dimensions[key] || '');
  const megapixels = megapixelsText(resolution);

  return (
    <aside className={`album-lightbox-meta album-yarl-meta${mobileOpen ? ' is-open' : ''}`}>
      <div className="album-lightbox-title">
        <h2>{title}</h2>
        <p>{description}</p>
        {(mood || tags.length > 0) && (
          <div className="album-lightbox-tags">
            {mood && <span>{mood}</span>}
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
      </div>

      <section>
        <h3>基本信息</h3>
        <MetaRow icon={<FileImage size={16} />} label="文件名" value={metaValue(image.fileName)} />
        <MetaRow icon={<Info size={16} />} label="文件大小" value={metaValue(image.fileSize)} />
        <MetaRow icon={<ImageIcon size={16} />} label="分辨率" value={metaValue(resolution)} />
        <MetaRow icon={<ImageIcon size={16} />} label="像素" value={metaValue(megapixels)} />
        <MetaRow icon={<CalendarDays size={16} />} label="拍摄时间" value={metaValue(takenAt(image))} />
        <MetaRow icon={<Info size={16} />} label="色彩空间" value={metaValue(meta.color_space)} />
        <MetaRow icon={<Smartphone size={16} />} label="设备" value={metaValue(camera)} />
        <MetaRow icon={<MapPin size={16} />} label="坐标" value={metaValue(coordinateText(meta), '暂无坐标')} />
      </section>

      <section>
        <h3>拍摄参数</h3>
        <MetaRow icon={<Camera size={16} />} label="焦距" value={metaValue(meta.focal_length)} />
        <MetaRow icon={<Aperture size={16} />} label="光圈" value={metaValue(meta.aperture)} />
        <MetaRow icon={<Clock3 size={16} />} label="曝光时间" value={metaValue(meta.exposure)} />
        <MetaRow icon={<Zap size={16} />} label="ISO" value={metaValue(meta.iso)} />
      </section>

      <section>
        <h3>设备信息</h3>
        <MetaRow icon={<Smartphone size={16} />} label="相机" value={metaValue(camera)} />
        <MetaRow icon={<Aperture size={16} />} label="最大光圈" value={metaValue(meta.max_aperture)} />
        <MetaRow icon={<Camera size={16} />} label="35mm 等效" value={metaValue(meta.focal_length_35mm)} />
        <MetaRow icon={<Info size={16} />} label="软件" value={metaValue(meta.software)} />
        <MetaRow icon={<Info size={16} />} label="方向" value={metaValue(meta.orientation)} />
      </section>

      <section>
        <h3>拍摄模式</h3>
        <MetaRow icon={<Info size={16} />} label="白平衡" value={metaValue(meta.white_balance)} />
        <MetaRow icon={<Info size={16} />} label="曝光程序" value={metaValue(meta.exposure_program)} />
        <MetaRow icon={<Info size={16} />} label="曝光模式" value={metaValue(meta.exposure_mode)} />
        <MetaRow icon={<Info size={16} />} label="测光模式" value={metaValue(meta.metering_mode)} />
        <MetaRow icon={<Zap size={16} />} label="闪光灯" value={metaValue(meta.flash)} />
      </section>

      <section>
        <h3>技术参数</h3>
        <MetaRow icon={<Info size={16} />} label="亮度" value={metaValue(meta.brightness)} />
        <MetaRow icon={<Info size={16} />} label="数码变焦" value={metaValue(meta.digital_zoom_ratio)} />
        <MetaRow icon={<Info size={16} />} label="感光方式" value={metaValue(meta.sensing_method)} />
        <MetaRow icon={<ImageIcon size={16} />} label="像素密度" value={metaValue(resolutionUnitText(meta))} />
      </section>
    </aside>
  );
}
