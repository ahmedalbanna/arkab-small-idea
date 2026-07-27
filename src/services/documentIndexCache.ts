/**
 * Document Index Cache — session-level cache that tracks document hashes to
 * avoid re-indexing content that hasn't changed.
 *
 * ## Problem
 * When switching between pages of the same document, the `DocumentLifecycleHost`
 * debounce fires and triggers a full re-index because `markdown` changed.
 *
 * ## Solution
 * This cache maintains:
 *  1. A content hash per document page — if the hash matches the last indexed
 *     hash, we skip indexing entirely.
 *  2. A per-chunk hash set — only chunks whose hash has changed since the last
 *     index are re-embedded (incremental indexing).
 *  3. A global document hash for summary caching — re-summarize only when the
 *     document structure changes (headings added/removed).
 *
 * The cache is session-scoped (memory only, not persisted to IndexedDB). It is
 * cleared when the app is reloaded.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentIndexState {
  /** Hash of the full document content at last index. */
  contentHash: string;
  /** Timestamp of the last successful index (epoch ms). */
  lastIndexedAt: number;
  /** Set of chunk hashes that are already embedded and stored. */
  knownChunkHashes: Set<string>;
  /** Hash of the document structure (headings only) for summary caching. */
  structureHash: string;
  /** Cached global summary, if computed. */
  globalSummary: string | null;
  /** Length of content at last index (to detect small changes). */
  lastContentLength: number;
  /** Timestamp of the last content change (for typing pause detection). */
  lastChangeAt: number;
}

export interface DocumentIndexCache {
  /**
   * Check if a document page needs re-indexing.
   * Returns `true` if the page should be indexed (content changed or not yet indexed).
   * Returns `false` if the page content is unchanged since last index.
   */
  shouldIndex(pageId: string, content: string): boolean;

  /**
   * Check if the change is large enough to warrant indexing.
   * Returns `false` if only a small change (< MIN_CHANGE_CHARS) was made since last index.
   * This prevents tiny edits (single character typing) from triggering indexing.
   */
  shouldIndexByChangeSize(pageId: string, content: string): boolean;

  /**
   * Check if the user has stopped typing (no changes in the pause window).
   * Returns `true` only if enough time has passed since the last content change.
   */
  hasTypingPaused(pageId: string, pauseMs?: number): boolean;

  /**
   * Track that content changed (update lastChangeAt).
   */
  recordChange(pageId: string): void;

  /**
   * Mark a document page as indexed, storing its content hash and updating the
   * known chunk hash set.
   */
  markIndexed(pageId: string, content: string, chunkHashes: string[]): void;

  /**
   * Get the set of chunk hashes that are NOT yet known (return only the ones
   * that need embedding). Returns empty array if all are known.
   */
  getNewChunkHashes(pageId: string, chunkHashes: string[]): string[];

  /**
   * Check if we need to regenerate the global summary for a document.
   * The summary is cached structurally — it only changes when heading structure changes.
   */
  shouldRegenerateSummary(pageId: string, content: string): boolean;

  /**
   * Store the global summary for a document page.
   */
  setSummary(pageId: string, content: string, summary: string): void;

  /**
   * Retrieve a cached global summary, or null if not cached or stale.
   */
  getSummary(pageId: string, content: string): string | null;

  /**
   * Remove a page from the cache (e.g. when a page is deleted).
   */
  invalidate(pageId: string): void;

  /**
   * Clear the entire cache (session reset).
   */
  clear(): void;

  /**
   * Get indexing stats for debugging.
   */
  getStats(): { pages: number; totalChunks: number; summaries: number };
}

/**
 * Minimum character change required to trigger indexing.
 * Changes smaller than this are ignored to avoid indexing on every keystroke.
 */
export const MIN_CHANGE_CHARS = 50;

/**
 * Time (ms) the user must stop typing before indexing triggers.
 * Prevents indexing during active typing sessions.
 */
export const TYPING_PAUSE_MS = 5000;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Compute a simple fast hash for a text string.
 * Used for change detection, not cryptographic purposes.
 */
export function computeHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Extract the structural signature of a document (heading levels + titles).
 * This is used for summary caching — the summary only needs regeneration when
 * the heading structure changes, not on every keystroke.
 */
export function computeStructureHash(content: string): string {
  const lines = content.split("\n");
  const structureLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      structureLines.push(`${match[1].length}:${match[2].trim()}`);
    }
  }
  return computeHash(structureLines.join("\n"));
}

/**
 * Count lines in content for size-based strategy decisions.
 */
export function countLines(content: string): number {
  if (!content) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Cache implementation
// ---------------------------------------------------------------------------

/**
 * Session-level cache for document indexing state.
 * All data is kept in memory and cleared on page reload.
 *
 * Uses `Map` for O(1) lookups. The cache is bounded by the number of open
 * pages in the session — typically < 20 documents, so no eviction policy is
 * needed.
 */
class DocumentIndexCacheImpl implements DocumentIndexCache {
  private cache = new Map<string, DocumentIndexState>();

  shouldIndex(pageId: string, content: string): boolean {
    const state = this.cache.get(pageId);
    if (!state) return true; // Not yet indexed

    const newHash = computeHash(content);
    return state.contentHash !== newHash;
  }

  shouldIndexByChangeSize(pageId: string, content: string): boolean {
    const state = this.cache.get(pageId);
    if (!state) return true; // Not yet indexed — always index first time

    // If the change is small (< MIN_CHANGE_CHARS), skip indexing
    const changeSize = Math.abs(content.length - state.lastContentLength);
    return changeSize >= MIN_CHANGE_CHARS;
  }

  hasTypingPaused(pageId: string, pauseMs: number = TYPING_PAUSE_MS): boolean {
    const state = this.cache.get(pageId);
    if (!state) return true; // Never indexed — treat as paused
    return Date.now() - state.lastChangeAt >= pauseMs;
  }

  recordChange(pageId: string): void {
    const state = this.cache.get(pageId);
    if (state) {
      state.lastChangeAt = Date.now();
    }
  }

  markIndexed(pageId: string, content: string, chunkHashes: string[]): void {
    const existing = this.cache.get(pageId);
    const knownChunkHashes = new Set([...(existing?.knownChunkHashes ?? []), ...chunkHashes]);

    this.cache.set(pageId, {
      contentHash: computeHash(content),
      lastIndexedAt: Date.now(),
      knownChunkHashes,
      structureHash: computeStructureHash(content),
      globalSummary: existing?.globalSummary ?? null,
      lastContentLength: content.length,
      lastChangeAt: existing?.lastChangeAt ?? Date.now(),
    });
  }

  getNewChunkHashes(pageId: string, chunkHashes: string[]): string[] {
    const state = this.cache.get(pageId);
    if (!state) return chunkHashes; // All are new

    return chunkHashes.filter((h) => !state.knownChunkHashes.has(h));
  }

  shouldRegenerateSummary(pageId: string, content: string): boolean {
    const state = this.cache.get(pageId);
    if (!state) return true; // Not cached
    if (!state.globalSummary) return true; // No summary yet

    const newStructHash = computeStructureHash(content);
    return state.structureHash !== newStructHash;
  }

  setSummary(pageId: string, content: string, summary: string): void {
    const now = Date.now();
    const existing = this.cache.get(pageId) ?? {
      contentHash: computeHash(content),
      lastIndexedAt: now,
      knownChunkHashes: new Set(),
      structureHash: computeStructureHash(content),
      globalSummary: null,
      lastContentLength: content.length,
      lastChangeAt: now,
    };

    this.cache.set(pageId, {
      ...existing,
      structureHash: computeStructureHash(content),
      globalSummary: summary,
      lastContentLength: content.length,
      lastChangeAt: existing.lastChangeAt,
    });
  }

  getSummary(pageId: string, content: string): string | null {
    const state = this.cache.get(pageId);
    if (!state) return null;

    // Check if summary is still valid (structure unchanged)
    const newStructHash = computeStructureHash(content);
    if (state.structureHash !== newStructHash) return null;

    return state.globalSummary;
  }

  invalidate(pageId: string): void {
    this.cache.delete(pageId);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    let totalChunks = 0;
    for (const state of this.cache.values()) {
      totalChunks += state.knownChunkHashes.size;
    }
    return {
      pages: this.cache.size,
      totalChunks,
      summaries: [...this.cache.values()].filter((s) => s.globalSummary !== null).length,
    };
  }
}

/** Singleton instance — session-scoped. */
export const documentIndexCache = new DocumentIndexCacheImpl();
