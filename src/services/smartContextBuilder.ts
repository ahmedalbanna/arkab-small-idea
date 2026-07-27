/**
 * Smart Context Builder — builds three-layer context for AI actions based on
 * document size and structure.
 *
 * ## The Three Layers
 * 1. **Global Summary** — A structural overview of the entire document (always
 *    included, regardless of action scope).
 * 2. **Current Section** — The heading-bounded section where the cursor is.
 * 3. **Relevant Chunks (RAG)** — Semantically relevant document clips found via
 *    vector search (for awareness only).
 *
 * ## Adaptive Strategy by Document Size
 * | Size               | Strategy                                              |
 * |--------------------|-------------------------------------------------------|
 * | Small (< 50 lines)  | Send full document text                               |
 * | Medium (50-500)     | Section + summary + 3 RAG chunks                      |
 * | Large (500-1000+)   | Summary + section + 5 RAG chunks + table of contents  |
 * | Huge (> 2000)       | Chapter-level summary + section + 3 RAG chunks + warning |
 *
 * ## Token Budget Control
 * The builder estimates token usage and adjusts context to fit within the
 * model's budget. If the context exceeds the budget, it progressively
 * reduces: RAG chunks first, then summary detail, then section text.
 */

import type { IRAGService } from "../abstractions/storage";
import { countLines, computeHash } from "./documentIndexCache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentSizeCategory = "small" | "medium" | "large" | "huge";

export interface SmartContextResult {
  /** The global summary / structural map of the document. */
  globalSummary: string;
  /** The current section content (heading + body). */
  currentSection: string;
  /** The RAG-relevant context string (may be empty). */
  ragContext: string;
  /** The table of contents (headings only), if applicable. */
  tableOfContents: string;
  /** A size warning for the user, if applicable. */
  warning: string;
  /** How many RAG chunks were included (for stats). */
  ragChunkCount: number;
}

export interface SmartContextBuilderOptions {
  /** Full document markdown content. */
  documentContent: string;
  /** Text of the current section (heading + body). */
  sectionContent: string;
  /** The action text (selected text or section content). */
  actionText: string;
  /** Cursor context (heading path + current paragraph). */
  cursorContext: string;
  /** The AI model's max token limit. */
  modelMaxTokens: number;
  /** Tokens already used by the system prompt + user prompt (without context). */
  estimatedPromptTokens: number;
  /** RAG service for retrieving relevant chunks (may be null). */
  ragService: IRAGService | null;
  /** Embedding options for RAG. */
  embeddingOptions?: { provider?: string; apiKey?: string; model?: string };
  /** Per-action token limit. */
  actionTokenLimit?: number;
}

// ---------------------------------------------------------------------------
// Document size classification
// ---------------------------------------------------------------------------

/**
 * Classify a document by line count.
 * Used to select the appropriate context strategy.
 */
export function classifyDocumentSize(lineCount: number): DocumentSizeCategory {
  if (lineCount < 50) return "small";
  if (lineCount < 500) return "medium";
  if (lineCount < 1000) return "large";
  return "huge";
}

/**
 * Line count thresholds as human-readable strings.
 */
export function getSizeLabel(lineCount: number): string {
  if (lineCount < 50) return "small";
  if (lineCount < 500) return "medium";
  if (lineCount < 1000) return "large";
  return "huge";
}

// ---------------------------------------------------------------------------
// Token estimation (kept local to avoid circular dependencies)
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  return text.substring(0, maxTokens * 4) + "\n\n[...truncated...]";
}

// ---------------------------------------------------------------------------
// Table of Contents extraction
// ---------------------------------------------------------------------------

/**
 * Extract a structural TOC (headings only) from markdown content.
 */
function extractTOC(content: string): string {
  const lines = content.split("\n");
  const toc: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      toc.push(`${"  ".repeat(level - 1)}• ${title}`);
    }
  }
  return toc.length > 0 ? toc.join("\n") : "";
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

/**
 * Extract the heading-bounded section content for a given cursor context.
 * Returns the markdown of the section (heading through to next heading or end).
 */
function extractSection(content: string, cursorContext: string): { heading: string; body: string } {
  if (!cursorContext) return { heading: "", body: "" };

  const lines = content.split("\n");
  const cursorIdx = content.indexOf(cursorContext.substring(0, Math.min(cursorContext.length, 80)));

  let sectionStart = -1;
  let sectionHeading = "";
  let sectionHeadingLevel = 0;

  // Find the heading immediately before the cursor position
  let charPos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLen = line.length + 1; // +1 for newline

    if (cursorIdx >= 0 && charPos > cursorIdx) break;
    if (cursorIdx < 0 && charPos > content.length * 0.5) break;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      sectionStart = charPos;
      sectionHeading = match[2].trim();
      sectionHeadingLevel = match[1].length;
    }

    charPos += lineLen;
  }

  if (sectionStart < 0) {
    // No heading found — use the first 1000 chars as the "section"
    return { heading: "Introduction", body: content.substring(0, 1000) };
  }

  // Find the end of this section (next heading at same or higher level)
  let sectionEnd = content.length;
  charPos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLen = line.length + 1;

    if (charPos <= sectionStart) {
      charPos += lineLen;
      continue;
    }

    const match = line.match(/^(#{1,6})\s+/);
    if (match && match[1].length <= sectionHeadingLevel) {
      sectionEnd = charPos - 1; // Exclude the newline before this heading
      break;
    }

    charPos += lineLen;
  }

  const sectionText = content.substring(sectionStart, sectionEnd).trim();
  return { heading: sectionHeading, body: sectionText };
}

// ---------------------------------------------------------------------------
// Context truncation helpers
// ---------------------------------------------------------------------------

/**
 * Truncate the context to fit within the token budget.
 * Priority: RAG chunks first to be removed, then summary detail, then section.
 */
function truncateContextToBudget(result: SmartContextResult, budget: number): SmartContextResult {
  let currentUsage = estimateTokens(
    result.globalSummary + result.currentSection + result.ragContext + result.tableOfContents,
  );

  if (currentUsage <= budget) return result;

  // Phase 1: Truncate RAG context
  if (result.ragContext && currentUsage > budget) {
    const ragTokens = estimateTokens(result.ragContext);
    const maxRagTokens = Math.max(0, Math.floor(ragTokens * (budget / currentUsage)));
    result.ragContext = truncateToTokens(result.ragContext, maxRagTokens);
    result.ragChunkCount = Math.ceil(result.ragChunkCount * (maxRagTokens / ragTokens));
    currentUsage = estimateTokens(
      result.globalSummary + result.currentSection + result.ragContext + result.tableOfContents,
    );
  }

  // Phase 2: Truncate global summary
  if (result.globalSummary && currentUsage > budget) {
    const summaryTokens = estimateTokens(result.globalSummary);
    const maxSummaryTokens = Math.max(100, Math.floor(summaryTokens * (budget / currentUsage)));
    result.globalSummary = truncateToTokens(result.globalSummary, maxSummaryTokens);
    currentUsage = estimateTokens(
      result.globalSummary + result.currentSection + result.ragContext + result.tableOfContents,
    );
  }

  // Phase 3: Truncate section content
  if (result.currentSection && currentUsage > budget) {
    const sectionTokens = estimateTokens(result.currentSection);
    const maxSectionTokens = Math.max(200, Math.floor(sectionTokens * (budget / currentUsage)));
    result.currentSection = truncateToTokens(result.currentSection, maxSectionTokens);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Context Cache (5-minute TTL)
// ---------------------------------------------------------------------------

interface CachedContextEntry {
  result: SmartContextResult;
  cachedAt: number;
  contentHash: string;
  cursorHash: string;
}

const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const contextCache = new Map<string, CachedContextEntry>();

/**
 * Build a cache key from document content hash + cursor context hash.
 * Two documents with the same content but different cursor positions get
 * different cached contexts.
 */
function getContextCacheKey(documentContent: string, cursorContext: string): string {
  return `${computeHash(documentContent)}:${computeHash(cursorContext)}`;
}

/**
 * Try to retrieve a cached context result.
 * Returns `null` if:
 *  - No cache entry exists for the key, or
 *  - The cache entry has expired (> CONTEXT_CACHE_TTL), or
 *  - The content hash doesn't match (document changed since cache was built).
 */
function getCachedContext(
  documentContent: string,
  cursorContext: string,
): SmartContextResult | null {
  const key = getContextCacheKey(documentContent, cursorContext);
  const entry = contextCache.get(key);
  if (!entry) return null;

  // Check expiry
  if (Date.now() - entry.cachedAt > CONTEXT_CACHE_TTL) {
    contextCache.delete(key);
    return null;
  }

  // Check content still matches (document may have changed)
  const currentContentHash = computeHash(documentContent);
  if (entry.contentHash !== currentContentHash) {
    contextCache.delete(key);
    return null;
  }

  return entry.result;
}

/**
 * Store a context result in the cache.
 */
function setCachedContext(
  documentContent: string,
  cursorContext: string,
  result: SmartContextResult,
): void {
  const key = getContextCacheKey(documentContent, cursorContext);
  contextCache.set(key, {
    result,
    cachedAt: Date.now(),
    contentHash: computeHash(documentContent),
    cursorHash: computeHash(cursorContext),
  });

  // Evict oldest entries if cache exceeds 50 items
  if (contextCache.size > 50) {
    const oldest = contextCache.entries().next().value;
    if (oldest) contextCache.delete(oldest[0]);
  }
}

/**
 * Clear the entire context cache (e.g. when settings change).
 */
export function clearContextCache(): void {
  contextCache.clear();
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

/**
 * Build a smart, three-layer context for an AI action based on document size.
 *
 * This is the main entry point for the context builder. It:
 *  1. Checks the context cache first (5-minute TTL)
 *  2. Classifies the document by size
 *  3. Builds the appropriate context layers
 *  4. Retrieves RAG context (if available)
 *  5. Truncates to token budget
 *  6. Caches the result for future requests
 *  7. Returns the assembled context
 */
export async function buildSmartContext(
  options: SmartContextBuilderOptions,
): Promise<SmartContextResult> {
  const {
    documentContent,
    sectionContent,
    actionText,
    cursorContext,
    modelMaxTokens,
    estimatedPromptTokens,
    ragService,
    embeddingOptions,
    actionTokenLimit = 4096,
  } = options;

  // ── Check context cache (5-minute TTL) ─────────────────────────────
  const cached = getCachedContext(documentContent, cursorContext);
  if (cached) {
    return cached;
  }

  const lineCount = countLines(documentContent);
  const sizeCategory = classifyDocumentSize(lineCount);

  // Reserve tokens for the response (actionTokenLimit) + 512 safety margin
  const contextBudget = Math.max(
    512,
    modelMaxTokens - estimatedPromptTokens - actionTokenLimit - 512,
  );

  // Default empty result
  const result: SmartContextResult = {
    globalSummary: "",
    currentSection: "",
    ragContext: "",
    tableOfContents: "",
    warning: "",
    ragChunkCount: 0,
  };

  // ── Build context based on size category ────────────────────────────
  switch (sizeCategory) {
    case "small": {
      // Small documents: send full document text
      result.currentSection = documentContent;
      break;
    }

    case "medium": {
      // Medium documents: section + summary + 3 RAG chunks
      const section = extractSection(documentContent, cursorContext);
      result.currentSection = sectionContent || section.body || documentContent;
      result.globalSummary = await buildGlobalSummary(ragService, documentContent);

      // Retrieve RAG context (up to 3 chunks)
      if (ragService && actionText) {
        const ragContext = await ragService.getWeightedContext(
          [
            { text: actionText, weight: 1.0 },
            { text: cursorContext, weight: 0.5 },
          ],
          3,
          embeddingOptions,
        );
        result.ragContext = ragContext;
        result.ragChunkCount = ragContext ? ragContext.split("---").length : 0;
      }
      break;
    }

    case "large": {
      // Large documents: summary + section + 5 RAG chunks + TOC
      const section = extractSection(documentContent, cursorContext);
      result.currentSection = sectionContent || section.body || "";
      result.globalSummary = await buildGlobalSummary(ragService, documentContent);
      result.tableOfContents = extractTOC(documentContent);

      // Retrieve RAG context (up to 5 chunks)
      if (ragService && actionText) {
        const ragContext = await ragService.getWeightedContext(
          [
            { text: actionText, weight: 1.0 },
            { text: cursorContext, weight: 0.5 },
            { text: result.globalSummary, weight: 0.3 },
          ],
          5,
          embeddingOptions,
        );
        result.ragContext = ragContext;
        result.ragChunkCount = ragContext ? ragContext.split("---").length : 0;
      }
      break;
    }

    case "huge": {
      // Huge documents: chapter-level summary + section + 3 RAG chunks + warning
      const section = extractSection(documentContent, cursorContext);
      result.currentSection = sectionContent || section.body || "";
      result.globalSummary = await buildGlobalSummary(ragService, documentContent);

      // For huge docs, use a very condensed summary
      result.globalSummary = truncateToTokens(result.globalSummary, 400);

      result.tableOfContents = extractTOC(documentContent);
      result.warning =
        "⚠️ This document is very large. The AI has limited visibility — " +
        "only the current section and a structural overview are provided. " +
        "Some details outside the current section may not be available.";

      // Retrieve RAG context (up to 3 chunks, stricter)
      if (ragService && actionText) {
        const ragContext = await ragService.getWeightedContext(
          [
            { text: actionText, weight: 1.0 },
            { text: cursorContext, weight: 0.4 },
          ],
          3,
          embeddingOptions,
        );
        result.ragContext = ragContext;
        result.ragChunkCount = ragContext ? ragContext.split("---").length : 0;
      }
      break;
    }
  }

  // ── Truncate to fit token budget ────────────────────────────────────
  const finalResult = truncateContextToBudget(result, contextBudget);

  // Cache the result for future requests (5-minute TTL)
  setCachedContext(documentContent, cursorContext, finalResult);

  return finalResult;
}

// ---------------------------------------------------------------------------
// Global summary builder (with caching)
// ---------------------------------------------------------------------------

/**
 * Build a global summary using the RAG service's `getGlobalSummary`, with
 * session-level caching.
 */
async function buildGlobalSummary(
  ragService: IRAGService | null,
  documentContent: string,
): Promise<string> {
  if (!ragService || !documentContent) return "";
  if (documentContent.length < 200) return "";

  try {
    // The RagService.getGlobalSummary already returns a clean structural map
    const summary = await ragService.getGlobalSummary(documentContent);
    return summary || "";
  } catch (error) {
    console.warn("Failed to build global summary:", error);
    return "";
  }
}

/**
 * Assemble the final context string from the smart context result.
 * This is the string that gets appended to the AI system prompt.
 */
export function assembleContextString(result: SmartContextResult): string {
  const parts: string[] = [];

  // Global summary (always first)
  if (result.globalSummary) {
    parts.push(
      "### DOCUMENT OVERVIEW ###\n" +
        "Below is a structural overview of the entire document for orientation:\n" +
        result.globalSummary,
    );
  }

  // Current section
  if (result.currentSection) {
    parts.push(
      "### CURRENT SECTION ###\n" +
        "This is the section you are currently working on. Focus your changes here.\n" +
        result.currentSection,
    );
  }

  // Table of contents
  if (result.tableOfContents) {
    parts.push("### TABLE OF CONTENTS ###\n" + result.tableOfContents);
  }

  // RAG context (awareness only)
  if (result.ragContext) {
    parts.push(
      "### REFERENCE CONTEXT (for awareness only) ###\n" +
        "The following sections are provided for context only. Do NOT incorporate " +
        "content from these sections into your response unless it is directly relevant " +
        "to the requested action on the current section.\n" +
        result.ragContext,
    );
  }

  return parts.join("\n\n");
}
