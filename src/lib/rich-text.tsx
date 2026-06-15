import type { ReactNode } from 'react';

const tokenRe = /\{\{emoji:([^|{}]+)\|([^{}]+)\}\}/g;

export function emojiToken(label: string, url: string) {
  return `{{emoji:${label.replace(/[{}|]/g, '')}|${url}}}`;
}

export function renderRichText(text: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(tokenRe)) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <img
        key={`${match.index}-${match[2]}`}
        src={match[2]}
        alt={match[1]}
        className="inline-emoji"
        loading="lazy"
      />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
