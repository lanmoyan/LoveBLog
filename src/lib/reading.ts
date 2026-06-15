export function estimateReadMinutes(content: string) {
  const plain = content.replace(/\s+/g, '');
  return Math.max(1, Math.ceil(plain.length / 500));
}
