/**
 * Pure, dependency-free slug helper for the headless core.
 *
 * Mirrors `src/lib/utils.ts#slugify` exactly but lives here so the core never
 * imports `lib/utils` (which pulls in React via `useMediaQuery`).
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}
