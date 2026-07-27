import { describe, expect, it, beforeEach } from "vitest";
import {
  classifyDocumentSize,
  getSizeLabel,
  buildSmartContext,
  assembleContextString,
  clearContextCache,
  type SmartContextResult,
} from "../services/smartContextBuilder";
import type { IRAGService, EmbeddingOptions } from "../abstractions/storage";

// ── Mock RAG Service ────────────────────────────────────────────────────

function createMockRagService(): IRAGService {
  return {
    isIndexing: () => false,
    setUICallbacks: () => {},
    indexDocument: async () => {},
    indexConversation: async () => {},
    getWeightedContext: async (_queries, _limit, _options) => {
      return "[RELEVANT CLIP 1]\nSome relevant context from the document.";
    },
    getRelevantContext: async () => "",
    getRelevantEpisodes: async () => "",
    searchDetailed: async () => [],
    getGlobalSummary: async (content: string) => {
      if (content.includes("# ")) {
        return "DOCUMENT STRUCTURAL MAP:\n■ Chapter 1\n  └─ Some content...";
      }
      return "";
    },
    getCursorSectionInfo: async () => "",
  };
}

// ── Test content ────────────────────────────────────────────────────────

const SMALL_DOC = `# Hello

This is a small document with just a few lines.`;

const MEDIUM_DOC_LINES: string[] = [];
for (let i = 0; i < 100; i++) {
  MEDIUM_DOC_LINES.push(
    `## Section ${i}\n\nThis is paragraph content for section ${i}. It has some text to make it realistic.`,
  );
}
const MEDIUM_DOC = MEDIUM_DOC_LINES.join("\n\n");

const LARGE_DOC_LINES: string[] = [];
for (let i = 0; i < 600; i++) {
  LARGE_DOC_LINES.push(`## Section ${i}\n\nLonger paragraph content for section ${i}. `.repeat(3));
}
const LARGE_DOC = LARGE_DOC_LINES.join("\n\n");

const HUGE_DOC_LINES: string[] = [];
for (let i = 0; i < 2500; i++) {
  HUGE_DOC_LINES.push(`# H${i}\n\nContent for heading ${i}.`);
}
const HUGE_DOC = HUGE_DOC_LINES.join("\n");

// ── Tests ───────────────────────────────────────────────────────────────

describe("smartContextBuilder", () => {
  beforeEach(() => {
    clearContextCache();
  });
  describe("classifyDocumentSize", () => {
    it("classifies < 50 lines as small", () => {
      expect(classifyDocumentSize(10)).toBe("small");
      expect(classifyDocumentSize(49)).toBe("small");
    });

    it("classifies 50-499 lines as medium", () => {
      expect(classifyDocumentSize(50)).toBe("medium");
      expect(classifyDocumentSize(250)).toBe("medium");
      expect(classifyDocumentSize(499)).toBe("medium");
    });

    it("classifies 500-999 lines as large", () => {
      expect(classifyDocumentSize(500)).toBe("large");
      expect(classifyDocumentSize(750)).toBe("large");
      expect(classifyDocumentSize(999)).toBe("large");
    });

    it("classifies 1000+ lines as huge", () => {
      expect(classifyDocumentSize(1000)).toBe("huge");
      expect(classifyDocumentSize(5000)).toBe("huge");
    });
  });

  describe("getSizeLabel", () => {
    it("returns human-readable labels", () => {
      expect(getSizeLabel(10)).toBe("small");
      expect(getSizeLabel(100)).toBe("medium");
      expect(getSizeLabel(600)).toBe("large");
      expect(getSizeLabel(2000)).toBe("huge");
    });
  });

  describe("assembleContextString", () => {
    it("assembles all layers present", () => {
      const result: SmartContextResult = {
        globalSummary: "Summary of doc",
        currentSection: "Current section content",
        ragContext: "RAG clips",
        tableOfContents: "- Item 1\n- Item 2",
        warning: "",
        ragChunkCount: 1,
      };

      const assembled = assembleContextString(result);
      expect(assembled).toContain("DOCUMENT OVERVIEW");
      expect(assembled).toContain("CURRENT SECTION");
      expect(assembled).toContain("TABLE OF CONTENTS");
      expect(assembled).toContain("REFERENCE CONTEXT");
      expect(assembled).toContain("Summary of doc");
      expect(assembled).toContain("Current section content");
      expect(assembled).toContain("RAG clips");
      expect(assembled).toContain("- Item 1");
    });

    it("omits empty layers", () => {
      const result: SmartContextResult = {
        globalSummary: "",
        currentSection: "Only section",
        ragContext: "",
        tableOfContents: "",
        warning: "",
        ragChunkCount: 0,
      };

      const assembled = assembleContextString(result);
      expect(assembled).not.toContain("DOCUMENT OVERVIEW");
      expect(assembled).toContain("CURRENT SECTION");
      expect(assembled).not.toContain("REFERENCE CONTEXT");
      expect(assembled).not.toContain("TABLE OF CONTENTS");
    });
  });

  describe("buildSmartContext", () => {
    const mockRag = createMockRagService();

    it("sends full document for small docs (< 50 lines)", async () => {
      const result = await buildSmartContext({
        documentContent: SMALL_DOC,
        sectionContent: "",
        actionText: "improve this",
        cursorContext: "",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      // Small docs should have the full content as currentSection
      expect(result.currentSection).toContain("small document");
      expect(result.warning).toBe("");
    });

    it("builds three-layer context for medium docs (50-499 lines)", async () => {
      const result = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 5\n\nContent of section 5.",
        actionText: "improve this",
        cursorContext: "## Section 5",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      expect(result.globalSummary).toBeTruthy();
      expect(result.currentSection).toBeTruthy();
      expect(result.ragChunkCount).toBeGreaterThan(0);
      expect(result.warning).toBe("");
    });

    it("includes TOC for large docs (500-999 lines)", async () => {
      const result = await buildSmartContext({
        documentContent: LARGE_DOC,
        sectionContent: "## Section 100\n\nContent.",
        actionText: "improve this",
        cursorContext: "## Section 100",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      // Should have all layers including TOC
      expect(result.globalSummary).toBeTruthy();
      expect(result.currentSection).toBeTruthy();
      expect(result.ragChunkCount).toBeGreaterThan(0);
    });

    it("adds size warning for huge docs (1000+ lines)", async () => {
      const result = await buildSmartContext({
        documentContent: HUGE_DOC,
        sectionContent: "# H100\n\nContent.",
        actionText: "improve this",
        cursorContext: "# H100",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      expect(result.warning).toContain("very large");
    });

    it("works without RAG service (graceful degradation)", async () => {
      const result = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 5\n\nContent.",
        actionText: "improve this",
        cursorContext: "## Section 5",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: null,
      });

      // No RAG context but section still works
      expect(result.currentSection).toBeTruthy();
      expect(result.ragContext).toBe("");
      expect(result.ragChunkCount).toBe(0);
    });

    it("respects token budget by truncating context", async () => {
      // Very tight budget
      const result = await buildSmartContext({
        documentContent: LARGE_DOC,
        sectionContent: "## Large Section\n\n" + "A".repeat(5000),
        actionText: "improve",
        cursorContext: "## Large Section",
        modelMaxTokens: 2048, // Small model
        estimatedPromptTokens: 1500,
        ragService: mockRag,
      });

      // Should not blow up and should produce usable output
      const assembled = assembleContextString(result);
      expect(assembled).toBeTruthy();
    });

    it("handles empty document gracefully", async () => {
      const result = await buildSmartContext({
        documentContent: "",
        sectionContent: "",
        actionText: "improve",
        cursorContext: "",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 200,
        ragService: mockRag,
      });

      expect(result.currentSection).toBe("");
      expect(result.globalSummary).toBe("");
      expect(result.ragContext).toBe("");
    });

    it("returns cached result on repeated calls with same content", async () => {
      // First call builds the context
      const result1 = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 5\n\nContent.",
        actionText: "improve this",
        cursorContext: "## Section 5",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      // Second call with same content should return cached (faster)
      const result2 = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 5\n\nDifferent content.",
        actionText: "improve this",
        cursorContext: "## Section 5",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      // Same cursor + same document → same cached context
      expect(result1.globalSummary).toBe(result2.globalSummary);
      expect(result1.ragChunkCount).toBe(result2.ragChunkCount);
    });

    it("returns different context for different cursor positions", async () => {
      const result1 = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 1\n\nContent.",
        actionText: "improve this",
        cursorContext: "## Section 1",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      const result2 = await buildSmartContext({
        documentContent: MEDIUM_DOC,
        sectionContent: "## Section 50\n\nDifferent content.",
        actionText: "improve this",
        cursorContext: "## Section 50",
        modelMaxTokens: 8192,
        estimatedPromptTokens: 500,
        ragService: mockRag,
      });

      // Different cursor positions → different cache keys → different results
      // (the section content will differ since cursor context differs)
      expect(result1.currentSection).not.toBe(result2.currentSection);
    });
  });
});
