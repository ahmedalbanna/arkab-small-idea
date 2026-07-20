/**
 * Count words in a markdown string. Intentionally simple: strips leading/
 * trailing whitespace and counts whitespace-separated tokens. It does not
 * attempt full markdown syntax stripping — good enough for draft metadata.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
