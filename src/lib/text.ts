export const SEARCH_EXCERPT_LIMIT = 82;

export function compactText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

export function truncateText(value: unknown, limit = 62, fallback = '') {
  const text = compactText(value, fallback);
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return `${text.slice(0, limit - 3)}...`;
}

export function searchExcerpt(value: unknown, fallback = '', limit = SEARCH_EXCERPT_LIMIT) {
  return truncateText(value, limit, fallback);
}
