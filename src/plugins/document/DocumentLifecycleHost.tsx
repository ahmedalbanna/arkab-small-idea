import { useEffect } from "react";
import { usePluginServices } from "../appContext";

/**
 * App-level lifecycle effects previously owned by `App.tsx`:
 *  - auto-snapshot the active document every 5 minutes,
 *  - debounced RAG indexing of the active document (when RAG is enabled),
 *  - snapshot on page unload.
 *
 * Reads stores and services from `PluginContext` via `usePluginServices()`
 * instead of importing concrete modules directly, keeping this host
 * decoupled from specific store/service implementations.
 *
 * The RAG plugin (`src/plugins/rag/`) owns vector-store initialisation;
 * this host only uses the RAG service for indexing when available.
 */
export function DocumentLifecycleHost(): null {
  const { pluginContext } = usePluginServices();

  // ── Access stores through context ──────────────────────────────────
  const editorStore = pluginContext.stores?.editor;
  const aiStore = pluginContext.stores?.ai;

  const { pages, activeFocusedPageId } = editorStore?.getState() ?? {
    pages: [],
    activeFocusedPageId: null,
  };

  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const markdown = activePage?.content || "";

  // ── RAG service (may be null if rag plugin is disabled) ─────────────
  const ragService = pluginContext.ragService;

  // ── Auto-snapshot every 5 minutes ──────────────────────────────────
  useEffect(() => {
    if (!activePage || !editorStore) return;
    const addSnapshot = editorStore.getState().addSnapshot;

    const interval = setInterval(
      () => {
        addSnapshot(activePage.id, activePage.content || "");
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [activePage, editorStore]);

  // ── Debounced RAG indexing ─────────────────────────────────────────
  useEffect(() => {
    if (!ragService || !aiStore) return;

    const timeout = setTimeout(() => {
      // Read embedding options from the AI store at call time
      const state = aiStore.getState();
      const embeddingOptions = {
        provider: state.serviceConfigs?.embeddings?.provider,
        apiKey: state.apiKeys?.[state.serviceConfigs?.embeddings?.provider as string],
        model: state.serviceConfigs?.embeddings?.model,
      };
      ragService.indexDocument(markdown, embeddingOptions);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [markdown, ragService, aiStore]);

  // ── Snapshot on page unload ────────────────────────────────────────
  useEffect(() => {
    if (!activePage || !editorStore) return;

    const handleBeforeUnload = () => {
      const addSnapshot = editorStore.getState().addSnapshot;
      addSnapshot(activePage.id, activePage.content || "");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activePage, editorStore]);

  return null;
}
