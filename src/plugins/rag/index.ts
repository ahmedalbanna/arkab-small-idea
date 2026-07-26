/**
 * RAG & Embeddings plugin.
 *
 * Creates and wires the embedding service, vector store, and RAG service,
 * then makes them available to:
 *  - subsequent plugins via `PluginContext` (ragService, embeddingService, vectorStore)
 *  - non-plugin modules via the service container (serviceContainer.ts)
 *
 * This plugin is non-essential — disabling it removes all RAG/embedding
 * capabilities without affecting core editing.
 */

import type { InkPlugin, PluginContext } from "../types";
import { RagService } from "../../services/ragService";
import { embeddingService, vectorStore } from "../../services/embeddingService";
import {
  setRagService,
  setEmbeddingService,
  setVectorStore,
  resetServices,
} from "../../services/serviceContainer";
import { RAGHost } from "./RAGHost";

export const ragPlugin: InkPlugin = {
  id: "rag",
  name: "RAG & Embeddings",
  version: "1.0.0",
  dependencies: ["core"],
  essential: false,

  init(ctx: PluginContext) {
    // ── Create the concrete RAG service ──────────────────────────────
    const rag = new RagService(embeddingService, vectorStore);

    // ── Populate PluginContext for subsequent plugins ─────────────────
    ctx.ragService = rag;
    ctx.embeddingService = embeddingService;
    ctx.vectorStore = vectorStore;

    // ── Populate the service container for non-plugin consumers ───────
    setRagService(rag);
    setEmbeddingService(embeddingService);
    setVectorStore(vectorStore);

    // ── Inject UI callbacks from the app stores ──────────────────────
    const uiStore = ctx.stores?.ui;
    if (uiStore) {
      const ui = uiStore.getState;
      rag.setUICallbacks({
        setIndexing: (indexing: boolean) => ui().setIndexing(indexing),
        setIndexedCounts: (chunks: number, episodes: number) =>
          ui().setIndexedCounts(chunks, episodes),
      });
    }

    // ── Vector-store initialisation host ─────────────────────────────
    ctx.registerHost(RAGHost);
  },

  destroy() {
    // Reset the service container so stale references are not reused
    // after a plugin disable / re-enable cycle.
    resetServices();
  },
};
