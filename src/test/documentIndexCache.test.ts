import { describe, expect, it, beforeEach } from "vitest";
import {
  documentIndexCache,
  computeHash,
  computeStructureHash,
  countLines,
  MIN_CHANGE_CHARS,
  TYPING_PAUSE_MS,
} from "../services/documentIndexCache";

const SAMPLE_CONTENT = `# Chapter 1

This is the first paragraph of chapter 1.

## Section 1.1

Some content in the first subsection.

# Chapter 2

Content in chapter 2.`;

const SAMPLE_CONTENT_MODIFIED = `# Chapter 1

This is the first paragraph of chapter 1.

## Section 1.1

Some MODIFIED content in the first subsection.

# Chapter 2

Content in chapter 2.`;

const SAMPLE_CONTENT_STRUCTURE_CHANGED = `# Chapter 1

This is the first paragraph of chapter 1.

# Chapter 2

Content in chapter 2.`;

describe("documentIndexCache", () => {
  beforeEach(() => {
    documentIndexCache.clear();
  });

  describe("computeHash", () => {
    it("returns consistent hashes for the same content", () => {
      const hash1 = computeHash("hello world");
      const hash2 = computeHash("hello world");
      expect(hash1).toBe(hash2);
    });

    it("returns different hashes for different content", () => {
      const hash1 = computeHash("hello world");
      const hash2 = computeHash("hello world!");
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty strings", () => {
      const hash = computeHash("");
      expect(typeof hash).toBe("string");
    });
  });

  describe("computeStructureHash", () => {
    it("is based only on headings", () => {
      const hash1 = computeStructureHash(SAMPLE_CONTENT);
      const hash2 = computeStructureHash(SAMPLE_CONTENT_MODIFIED);
      // Same headings, different body content → same structure hash
      expect(hash1).toBe(hash2);
    });

    it("changes when headings change", () => {
      const hash1 = computeStructureHash(SAMPLE_CONTENT);
      const hash2 = computeStructureHash(SAMPLE_CONTENT_STRUCTURE_CHANGED);
      expect(hash1).not.toBe(hash2);
    });

    it("returns a hash for content with no headings", () => {
      const hash = computeStructureHash("Just a plain paragraph.\n\nNo headings here.");
      expect(typeof hash).toBe("string");
    });
  });

  describe("countLines", () => {
    it("counts lines correctly", () => {
      expect(countLines("line1\nline2\nline3")).toBe(3);
    });

    it("returns 1 for single line", () => {
      expect(countLines("single line")).toBe(1);
    });

    it("returns 0 for empty content", () => {
      expect(countLines("")).toBe(0);
    });
  });

  describe("shouldIndex / markIndexed", () => {
    it("returns true for unindexed page", () => {
      expect(documentIndexCache.shouldIndex("page1", "content")).toBe(true);
    });

    it("returns false after marking indexed with same content", () => {
      documentIndexCache.markIndexed("page1", "content", ["hash1", "hash2"]);
      expect(documentIndexCache.shouldIndex("page1", "content")).toBe(false);
    });

    it("returns true when content changes after indexing", () => {
      documentIndexCache.markIndexed("page1", "original content", ["hash1"]);
      expect(documentIndexCache.shouldIndex("page1", "modified content")).toBe(true);
    });

    it("handles multiple pages independently", () => {
      documentIndexCache.markIndexed("page1", "content1", ["a"]);
      documentIndexCache.markIndexed("page2", "content2", ["b"]);

      expect(documentIndexCache.shouldIndex("page1", "content1")).toBe(false);
      expect(documentIndexCache.shouldIndex("page2", "content2")).toBe(false);
      expect(documentIndexCache.shouldIndex("page3", "content3")).toBe(true);
    });
  });

  describe("getNewChunkHashes", () => {
    it("returns empty array when all chunks known", () => {
      documentIndexCache.markIndexed("page1", "content", ["a", "b", "c"]);
      const newHashes = documentIndexCache.getNewChunkHashes("page1", ["a", "b", "c"]);
      expect(newHashes).toHaveLength(0);
    });

    it("returns only unknown chunks", () => {
      documentIndexCache.markIndexed("page1", "content", ["a", "b"]);
      const newHashes = documentIndexCache.getNewChunkHashes("page1", ["a", "c", "d"]);
      expect(newHashes).toEqual(["c", "d"]);
    });

    it("returns all hashes for unindexed page", () => {
      const newHashes = documentIndexCache.getNewChunkHashes("unknown", ["x", "y"]);
      expect(newHashes).toEqual(["x", "y"]);
    });
  });

  describe("summary caching (shouldRegenerateSummary / setSummary / getSummary)", () => {
    it("returns null when no summary cached", () => {
      expect(documentIndexCache.getSummary("page1", SAMPLE_CONTENT)).toBeNull();
    });

    it("returns cached summary when structure is unchanged", () => {
      documentIndexCache.setSummary("page1", SAMPLE_CONTENT, "A document about things");
      // Same structure (different body) → returns cached
      const summary = documentIndexCache.getSummary("page1", SAMPLE_CONTENT_MODIFIED);
      expect(summary).toBe("A document about things");
    });

    it("returns null when structure has changed", () => {
      documentIndexCache.setSummary("page1", SAMPLE_CONTENT, "A document about things");
      // Structure changed (section removed) → no cache
      const summary = documentIndexCache.getSummary("page1", SAMPLE_CONTENT_STRUCTURE_CHANGED);
      expect(summary).toBeNull();
    });

    it("triggers regeneration when structure changes", () => {
      documentIndexCache.setSummary("page1", SAMPLE_CONTENT, "Old summary");
      expect(documentIndexCache.shouldRegenerateSummary("page1", SAMPLE_CONTENT)).toBe(false);
      expect(
        documentIndexCache.shouldRegenerateSummary("page1", SAMPLE_CONTENT_STRUCTURE_CHANGED),
      ).toBe(true);
    });
  });

  describe("shouldIndexByChangeSize", () => {
    it("returns true for unindexed page (always index first time)", () => {
      expect(documentIndexCache.shouldIndexByChangeSize("new-page", "content")).toBe(true);
    });

    it("returns false for small changes (< MIN_CHANGE_CHARS)", () => {
      documentIndexCache.markIndexed("page1", "A".repeat(500), ["a"]);
      // Change of just a few characters
      const smallChange = "A".repeat(500) + "x";
      expect(documentIndexCache.shouldIndexByChangeSize("page1", smallChange)).toBe(false);
    });

    it("returns true for changes >= MIN_CHANGE_CHARS", () => {
      documentIndexCache.markIndexed("page1", "A".repeat(500), ["a"]);
      // Large change
      const largeChange = "A".repeat(500 + MIN_CHANGE_CHARS) + "x";
      expect(documentIndexCache.shouldIndexByChangeSize("page1", largeChange)).toBe(true);
    });
  });

  describe("hasTypingPaused / recordChange", () => {
    it("returns true for unindexed page (never typed)", () => {
      expect(documentIndexCache.hasTypingPaused("new-page")).toBe(true);
    });

    it("returns false immediately after recording a change", () => {
      documentIndexCache.markIndexed("page1", "initial", ["a"]);
      documentIndexCache.recordChange("page1");
      // Should not have paused yet (just recorded the change)
      expect(documentIndexCache.hasTypingPaused("page1", 10000)).toBe(false);
    });

    it("returns true after pause duration has passed", async () => {
      documentIndexCache.markIndexed("page1", "initial", ["a"]);
      // Simulate typing stopped
      documentIndexCache.recordChange("page1");

      // Wait enough time (use a short pauseMs)
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(documentIndexCache.hasTypingPaused("page1", 30)).toBe(true);
    });
  });

  describe("invalidate", () => {
    it("removes page from cache", () => {
      documentIndexCache.markIndexed("page1", "content", ["a"]);
      documentIndexCache.invalidate("page1");
      expect(documentIndexCache.shouldIndex("page1", "content")).toBe(true);
    });
  });

  describe("getStats", () => {
    it("returns correct stats", () => {
      expect(documentIndexCache.getStats()).toEqual({
        pages: 0,
        totalChunks: 0,
        summaries: 0,
      });

      documentIndexCache.markIndexed("page1", "content", ["a", "b"]);
      documentIndexCache.setSummary("page2", "content2", "summary");

      const stats = documentIndexCache.getStats();
      expect(stats.pages).toBe(2);
      expect(stats.totalChunks).toBe(2);
      expect(stats.summaries).toBe(1);
    });
  });
});
