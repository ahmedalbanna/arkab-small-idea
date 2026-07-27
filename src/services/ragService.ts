/**
 * RAG (Retrieval-Augmented Generation) service.
 *
 * Indexes document content into a vector store and retrieves semantically
 * relevant context for AI prompts.
 *
 * Accepts `IVectorStore` and `IEmbeddingService` via constructor injection so
 * consumers can substitute any implementation (IndexedDB, in-memory, remote,
 * mock, etc.).
 *
 * UI callbacks (`setIndexing`, `setIndexedCounts`) are injected via
 * `setUICallbacks` so the service has no direct dependency on Zustand stores.
 */

import type {
  Chunk,
  IEmbeddingService,
  IVectorStore,
  IRAGService,
  RagUICallbacks,
  EmbeddingOptions,
  DetailedSearchResult,
} from "../abstractions/storage";
import type { ChatMessage } from "./aiService";
import { documentIndexCache } from "./documentIndexCache";

export type { RagUICallbacks, EmbeddingOptions, DetailedSearchResult };

export class RagService implements IRAGService {
  private lastIndexedContent = "";
  private _isIndexing = false;
  private queryCache = new Map<string, number[]>();
  private readonly CACHE_LIMIT = 20;
  private _uiCallbacks: RagUICallbacks = {};
  private embeddingService: IEmbeddingService;
  private vectorStore: IVectorStore;

  constructor(embeddingService: IEmbeddingService, vectorStore: IVectorStore) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
  }

  isIndexing(): boolean {
    return this._isIndexing;
  }

  /**
   * Inject UI callbacks for state updates. Accepts partial overrides;
   * unspecified callbacks are no-ops.
   */
  setUICallbacks(cbs: RagUICallbacks): void {
    this._uiCallbacks = cbs;
  }

  async indexDocument(content: string, options?: EmbeddingOptions) {
    if (this._isIndexing) return;

    // Only wait for local model if we are using pipeline
    const provider = options?.provider || "pipeline";
    if (provider === "pipeline" && !this.embeddingService.isReady()) return;

    this._isIndexing = true;
    this._uiCallbacks.setIndexing?.(true);
    try {
      // ── Smart chunking with incremental support ────────────────────
      const existingChunks = this.vectorStore.getChunks();
      const existingHashMap = new Map(existingChunks.map((c) => [c.hash, c]));
      const knownHashes = new Set(existingHashMap.keys());

      const { texts, hashes, newTexts } = this.smartChunkContent(content, knownHashes);

      if (newTexts.length === 0 && texts.length === existingChunks.length) {
        // Nothing changed — skip indexing entirely
        console.info("RAG: Content unchanged, skipping indexing.");
        documentIndexCache.markIndexed("__active__", content, hashes);
        return;
      }

      console.info(
        `Indexing document for RAG: ${texts.length} chunks total, ${newTexts.length} new.`,
      );

      // ── Parallel embedding with batch support ──────────────────────
      const newEmbeddings: number[][] = [];
      if (newTexts.length > 0) {
        const BATCH_SIZE = 5;
        // Process in batches to avoid overwhelming the worker/API
        for (let i = 0; i < newTexts.length; i += BATCH_SIZE) {
          const batch = newTexts.slice(i, i + BATCH_SIZE);
          const embeddings = await this.embeddingService.generateEmbeddings(batch, options);
          newEmbeddings.push(...embeddings);
        }
      }

      // ── Assemble the updated chunks list ───────────────────────────
      const updatedChunks: Chunk[] = [];
      let newIdx = 0;

      for (let i = 0; i < texts.length; i++) {
        const hash = hashes[i];
        const existing = existingHashMap.get(hash);
        if (existing) {
          updatedChunks.push(existing);
        } else {
          updatedChunks.push({
            text: texts[i],
            embedding: newEmbeddings[newIdx],
            id: Math.random().toString(36).substring(7),
            hash,
          });
          newIdx++;
        }
      }

      await this.vectorStore.setChunks(updatedChunks);

      // ── Update session cache ───────────────────────────────────────
      documentIndexCache.markIndexed("__active__", content, hashes);

      this._uiCallbacks.setIndexedCounts?.(
        updatedChunks.length,
        this.vectorStore.getEpisodes().length,
      );
      this.lastIndexedContent = content;
      console.info(
        `RAG Update: ${updatedChunks.length} chunks total, ${newTexts.length} newly embedded.`,
      );
    } catch (error) {
      console.error("RAG Indexing error:", error);
    } finally {
      this._isIndexing = false;
      this._uiCallbacks.setIndexing?.(false);
    }
  }

  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Smart chunking that adapts chunk size based on document length.
   * Smaller docs get smaller chunks for denser retrieval, larger docs get
   * slightly larger chunks to reduce the total number of chunks.
   *
   * Also accepts an optional set of known hashes — when provided, only new
   * (unseen) chunks are returned for embedding, enabling incremental indexing.
   */
  private smartChunkContent(
    content: string,
    knownHashes?: Set<string>,
  ): { texts: string[]; hashes: string[]; newTexts: string[]; newHashes: string[] } {
    const lineCount = content.split("\n").length;

    // Adapt chunk size based on document size
    const CHUNK_SIZE = lineCount > 500 ? 1500 : lineCount > 200 ? 1200 : 800;
    const CHUNK_OVERLAP = lineCount > 500 ? 300 : 200;

    const paragraphs = content.split(/\n\n+/);
    const chunks: string[] = [];

    let currentChunk = "";

    for (const p of paragraphs) {
      if (p.length < 10) continue;

      if (p.length > CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        const subChunks = p.match(RegExp(`.{1,${CHUNK_SIZE}}(\\s|$)`, "g")) || [p];
        chunks.push(...subChunks.map((s) => s.trim()).filter((s) => s.length > 10));
        continue;
      }

      if (currentChunk.length + p.length > CHUNK_SIZE) {
        chunks.push(currentChunk.trim());
        const overlap = currentChunk.slice(-CHUNK_OVERLAP);
        currentChunk = overlap + (overlap ? "\n\n" : "") + p;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Compute hashes and separate new vs known
    const allHashes = chunks.map((c) => this.simpleHash(c));
    const newIndices: number[] = [];
    const newTexts: string[] = [];
    const newHashes: string[] = [];

    if (knownHashes) {
      for (let i = 0; i < chunks.length; i++) {
        if (!knownHashes.has(allHashes[i])) {
          newIndices.push(i);
          newTexts.push(chunks[i]);
          newHashes.push(allHashes[i]);
        }
      }
    }

    return {
      texts: chunks,
      hashes: allHashes,
      newTexts: knownHashes ? newTexts : chunks,
      newHashes: knownHashes ? newHashes : allHashes,
    };
  }

  /** @deprecated Use `smartChunkContent` instead. Kept for backward compatibility. */
  private chunkContent(content: string): string[] {
    return this.smartChunkContent(content).texts;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  trimToTokens(text: string, maxTokens: number): string {
    const estimated = this.estimateTokens(text);
    if (estimated <= maxTokens) return text;
    return text.substring(0, maxTokens * 4) + "... [truncated]";
  }

  private async getCachedEmbedding(query: string, options?: EmbeddingOptions): Promise<number[]> {
    if (this.queryCache.has(query)) {
      return this.queryCache.get(query)!;
    }
    const embedding = await this.embeddingService.generateEmbedding(query, options);
    this.queryCache.set(query, embedding);
    if (this.queryCache.size > this.CACHE_LIMIT) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    return embedding;
  }

  async indexConversation(
    id: string,
    name: string,
    messages: ChatMessage[],
    options?: EmbeddingOptions,
  ) {
    try {
      this._uiCallbacks.setIndexing?.(true);
      const content = messages.map((m) => `${m.role.toUpperCase()}: ${m.parts[0].text}`).join("\n");
      const text = `Conversation Name: ${name}\n\n${content}`;
      const hash = this.simpleHash(text);

      const existingEpisodes = this.vectorStore.getEpisodes();
      const existing = existingEpisodes.find((e) => e.id === id);

      if (existing && existing.hash === hash) {
        return;
      }

      const embedding = await this.embeddingService.generateEmbedding(
        this.trimToTokens(text, 1000),
        options,
      );
      const chunk: Chunk = {
        id,
        text: this.trimToTokens(text, 1000),
        embedding,
        hash,
      };

      if (existing) {
        const updated = existingEpisodes.map((e) => (e.id === id ? chunk : e));
        await this.vectorStore.setEpisodes(updated);
      } else {
        await this.vectorStore.addEpisodes([chunk]);
      }

      this._uiCallbacks.setIndexedCounts?.(
        this.vectorStore.getChunks().length,
        this.vectorStore.getEpisodes().length,
      );
      console.info(`Indexed conversation ${id} into episodic memory.`);
    } catch (e) {
      console.error("Error indexing conversation:", e);
    } finally {
      this._uiCallbacks.setIndexing?.(false);
    }
  }

  async getRelevantEpisodes(query: string, limit = 3, options?: EmbeddingOptions): Promise<string> {
    const provider = options?.provider || "pipeline";
    if (provider === "pipeline" && !this.embeddingService.isReady()) return "";
    const queryEmbedding = await this.getCachedEmbedding(query, options);
    const results = this.vectorStore.searchEpisodes(queryEmbedding, limit, 0.3);

    if (results.length === 0) return "";
    return results.map((res) => res.text).join("\n\n---\n\n");
  }

  async getRelevantContext(query: string, limit = 5, options?: EmbeddingOptions): Promise<string> {
    return this.getWeightedContext([{ text: query, weight: 1.0 }], limit, options);
  }

  async getWeightedContext(
    queries: { text: string; weight: number }[],
    limit = 5,
    options?: EmbeddingOptions,
  ): Promise<string> {
    const provider = options?.provider || "pipeline";
    if (provider === "pipeline" && !this.embeddingService.isReady()) return "";

    const resultsMap = new Map<string, { chunk: Chunk; score: number }>();

    for (const { text, weight } of queries) {
      if (!text || !text.trim()) continue;

      try {
        const queryEmbedding = await this.getCachedEmbedding(text, options);
        const results = this.vectorStore.searchWithScores(queryEmbedding, limit * 3, 0.2);

        const keywords = text
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 4);

        for (const { chunk, score } of results) {
          let lexicalBoost = 0;
          if (keywords.length > 0) {
            const chunkTextLower = chunk.text.toLowerCase();
            for (const keyword of keywords) {
              if (chunkTextLower.includes(keyword)) {
                lexicalBoost += 0.02;
              }
            }
          }

          const structuralBoost = chunk.text.match(/^#{1,6}\s+/m) ? 0.05 : 0;
          const densityPenalty = Math.min(0.1, chunk.text.length / 10000);
          const sophisticatedScore = score + lexicalBoost + structuralBoost - densityPenalty;
          const weightedScore = sophisticatedScore * weight;

          const existing = resultsMap.get(chunk.id);
          if (existing) {
            existing.score = (existing.score + weightedScore) * 1.15;
          } else {
            resultsMap.set(chunk.id, { chunk, score: weightedScore });
          }
        }
      } catch (e) {
        console.error(
          `Weighted search error for query component "${text.substring(0, 50)}...":`,
          e,
        );
      }
    }

    const sorted = Array.from(resultsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (sorted.length === 0) return "";

    return sorted.map((s, i) => `[RELEVANT CLIP ${i + 1}]\n${s.chunk.text}`).join("\n\n---\n\n");
  }

  async searchDetailed(
    query: string,
    limit = 5,
    threshold = 0.2,
    options?: EmbeddingOptions,
  ): Promise<DetailedSearchResult[]> {
    const provider = options?.provider || "pipeline";
    if (provider === "pipeline" && !this.embeddingService.isReady()) return [];
    try {
      const queryEmbedding = await this.getCachedEmbedding(query, options);

      const chunkResults = this.vectorStore.searchWithScores(queryEmbedding, limit, threshold);
      const formattedChunks = chunkResults.map((r) => ({
        text: r.chunk.text,
        score: r.score,
        source: "document" as const,
      }));

      const episodeResults = this.vectorStore.searchWithScores(
        queryEmbedding,
        limit,
        threshold,
        this.vectorStore.getEpisodes(),
      );
      const formattedEpisodes = episodeResults.map((r) => ({
        text: r.chunk.text,
        score: r.score * 0.9,
        source: "external" as const,
      }));

      return [...formattedChunks, ...formattedEpisodes]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (e) {
      console.error("Semantic search error:", e);
      return [];
    }
  }

  async getGlobalSummary(content: string): Promise<string> {
    const lines = content.split("\n");
    const sections: { level: number; title: string; summary: string }[] = [];

    let currentParagraphs: string[] = [];
    let lastHeading: { level: number; title: string } | null = null;

    const captureSection = () => {
      if (lastHeading) {
        const text = currentParagraphs.join(" ");
        const summary = text.length > 150 ? text.substring(0, 150) + "..." : text;
        sections.push({ ...lastHeading, summary });
        currentParagraphs = [];
      }
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        captureSection();
        lastHeading = {
          level: headingMatch[1].length,
          title: headingMatch[2].trim(),
        };
      } else if (line.trim() && lastHeading) {
        currentParagraphs.push(line.trim());
      }
    }
    captureSection();

    if (sections.length === 0) {
      const text = content.trim().substring(0, 200);
      return text ? `Document Abstract: ${text}${content.length > 200 ? "..." : ""}` : "";
    }

    const outline = sections
      .map((s) => {
        const indent = "  ".repeat(s.level - 1);
        return `${indent}${s.level === 1 ? "■" : "□"} ${s.title}\n${indent}  └─ ${s.summary || "(Empty Section)"}`;
      })
      .join("\n");

    const summary = `DOCUMENT STRUCTURAL MAP:\n${outline}`;
    return this.trimToTokens(summary, 800);
  }

  async getCursorSectionInfo(content: string, cursorContext: string): Promise<string> {
    if (!cursorContext) return "";

    let currentSection = "Introduction / Header";

    const cursorIdx = content.indexOf(cursorContext);
    if (cursorIdx === -1) return "";

    const contentBeforeCursor = content.substring(0, cursorIdx);
    const headings = [...contentBeforeCursor.matchAll(/^(#{1,6})\s+(.+)$/gm)];

    if (headings.length > 0) {
      const last = headings[headings.length - 1];
      currentSection = last[2].trim();
    }

    return currentSection;
  }
}

/**
 * Default singleton RagService backed by the default embeddingService and
 * vectorStore. Kept for backward compatibility; new code should obtain a
 * RagService via PluginContext or the service container.
 */
import { embeddingService, vectorStore } from "./embeddingService";
export const ragService = new RagService(embeddingService, vectorStore);
