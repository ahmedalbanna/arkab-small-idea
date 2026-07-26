/**
 * Domain abstractions for vector storage, embedding generation, and RAG
 * retrieval. These interfaces decouple the core logic from any concrete
 * storage backend (IndexedDB, in-memory, remote) or embedding provider
 * (local Xenova pipeline, Google, OpenAI, Ollama).
 *
 * Plugins receive concrete implementations via `PluginContext`; standalone
 * modules reach them through the service container (`serviceContainer.ts`).
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Chunk {
  text: string;
  embedding: number[];
  id: string;
  hash?: string;
}

export type EmbeddingStatus = "idle" | "loading" | "ready" | "error";

export interface EmbeddingProgress {
  status: EmbeddingStatus;
  progress: number;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface DetailedSearchResult {
  text: string;
  score: number;
  source?: string;
}

export interface EmbeddingOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Vector store — persist & search embedding chunks
// ---------------------------------------------------------------------------

export interface IVectorStore {
  init(): Promise<void>;
  getChunks(): Chunk[];
  setChunks(chunks: Chunk[]): Promise<void>;
  addChunks(chunks: Chunk[]): Promise<void>;
  getEpisodes(): Chunk[];
  setEpisodes(episodes: Chunk[]): Promise<void>;
  addEpisodes(episodes: Chunk[]): Promise<void>;
  clear(storeName?: string): Promise<void>;

  /** Cosine-similarity search returning matching chunks (no scores). */
  search(queryEmbedding: number[], limit?: number, threshold?: number): Chunk[];

  /** Search returning chunks with similarity scores. */
  searchWithScores(
    queryEmbedding: number[],
    limit?: number,
    threshold?: number,
    targetChunks?: Chunk[],
  ): SearchResult[];

  /** Episode-focused search. */
  searchEpisodes(queryEmbedding: number[], limit?: number, threshold?: number): Chunk[];
}

// ---------------------------------------------------------------------------
// Embedding service — turn text into vectors
// ---------------------------------------------------------------------------

export interface IEmbeddingService {
  loadModel(): Promise<Promise<void> | null | undefined>;
  init(): Promise<void>;
  isReady(): boolean;
  getStatus(): EmbeddingProgress;
  subscribe(callback: (status: EmbeddingStatus, progress: number) => void): () => void;

  generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;
  generateEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;
  cosineSimilarity(v1: number[], v2: number[]): number;
}

// ---------------------------------------------------------------------------
// RAG service — index documents & retrieve context
// ---------------------------------------------------------------------------

export interface RagUICallbacks {
  setIndexing?: (indexing: boolean) => void;
  setIndexedCounts?: (chunks: number, episodes: number) => void;
}

export interface WeightedQuery {
  text: string;
  weight: number;
}

export interface RAGContext {
  context: string;
  sources?: { text: string; score: number }[];
}

export interface IRAGService {
  setUICallbacks(cbs: RagUICallbacks): void;
  isIndexing(): boolean;

  /** Index a document's content for semantic retrieval. */
  indexDocument(content: string, options?: EmbeddingOptions): Promise<void>;

  /** Index a conversation into episodic memory. */
  indexConversation(
    id: string,
    name: string,
    messages: { role: string; parts: { text: string }[] }[],
    options?: EmbeddingOptions,
  ): Promise<void>;

  /** Retrieve context from weighted queries. */
  getWeightedContext(
    queries: WeightedQuery[],
    limit?: number,
    options?: EmbeddingOptions,
  ): Promise<string>;

  /** Simple single-query context retrieval. */
  getRelevantContext(query: string, limit?: number, options?: EmbeddingOptions): Promise<string>;

  /** Retrieve relevant episodes for a query. */
  getRelevantEpisodes(query: string, limit?: number, options?: EmbeddingOptions): Promise<string>;

  /** Detailed search with scores and source labels. */
  searchDetailed(
    query: string,
    limit?: number,
    threshold?: number,
    options?: EmbeddingOptions,
  ): Promise<DetailedSearchResult[]>;

  /** Build a structural map of the document. */
  getGlobalSummary(content: string): Promise<string>;

  /** Identify which heading section the cursor is in. */
  getCursorSectionInfo(content: string, cursorContext: string): Promise<string>;
}
