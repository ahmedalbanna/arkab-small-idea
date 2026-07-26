/**
 * Lightweight service locator for RAG & embedding services.
 *
 * Non-plugin modules (aiService, searchPlugin, semanticService, BottomBar)
 * that cannot access `PluginContext` directly use these module-level getters
 * instead of importing concrete service instances.
 *
 * The `rag` plugin calls `set*` during its `init` to populate the container.
 * Tests can call `reset*` to inject mocks without `vi.mock`.
 */

import type { IEmbeddingService, IRAGService, IVectorStore } from "../abstractions/storage";

// ── Module-level state ──────────────────────────────────────────────────

let _ragService: IRAGService | null = null;
let _embeddingService: IEmbeddingService | null = null;
let _vectorStore: IVectorStore | null = null;

// ── Setters (called by the RAG plugin during init) ──────────────────────

export function setRagService(svc: IRAGService): void {
  _ragService = svc;
}

export function setEmbeddingService(svc: IEmbeddingService): void {
  _embeddingService = svc;
}

export function setVectorStore(store: IVectorStore): void {
  _vectorStore = store;
}

// ── Getters (used by consumers) ─────────────────────────────────────────

/**
 * Returns the current RAG service, or throws if not yet initialised.
 * Consumers SHOULD gate optional RAG features behind a try/catch or a
 * readiness check.
 */
export function getRagService(): IRAGService {
  if (!_ragService) {
    throw new Error("RAG service not initialised. Ensure the 'rag' plugin is enabled and loaded.");
  }
  return _ragService;
}

export function getRagServiceSafe(): IRAGService | null {
  return _ragService;
}

export function getEmbeddingService(): IEmbeddingService {
  if (!_embeddingService) {
    throw new Error(
      "Embedding service not initialised. Ensure the 'rag' plugin is enabled and loaded.",
    );
  }
  return _embeddingService;
}

export function getEmbeddingServiceSafe(): IEmbeddingService | null {
  return _embeddingService;
}

export function getVectorStore(): IVectorStore {
  if (!_vectorStore) {
    throw new Error("Vector store not initialised. Ensure the 'rag' plugin is enabled and loaded.");
  }
  return _vectorStore;
}

export function getVectorStoreSafe(): IVectorStore | null {
  return _vectorStore;
}

// ── Test helpers ────────────────────────────────────────────────────────

/** Reset all services (useful in tests and teardown). */
export function resetServices(): void {
  _ragService = null;
  _embeddingService = null;
  _vectorStore = null;
}
