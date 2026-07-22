import { useEffect } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useAIStore } from "../../stores/aiStore";
import { useUIStore } from "../../stores/uiStore";
import { ragService } from "../../services/ragService";
import { vectorStore } from "../../services/embeddingService";

/**
 * App-level lifecycle effects previously owned by `App.tsx`:
 *  - initialize the vector store and sync its indexed counts,
 *  - auto-snapshot the active document every 5 minutes,
 *  - debounced RAG indexing of the active document,
 *  - snapshot on page unload.
 *
 * The host owns this state itself and reads the active document from the
 * editor store, so `App.tsx` no longer needs these effects.
 */
export function DocumentLifecycleHost(): null {
  const { pages, activeFocusedPageId, addSnapshot } = useEditorStore();
  const { serviceConfigs, apiKeys } = useAIStore();

  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const markdown = activePage?.content || "";

  // Initialize the vector store and sync its indexed counts into the UI store.
  useEffect(() => {
    vectorStore.init().then(() => {
      useUIStore
        .getState()
        .setIndexedCounts(vectorStore.getChunks().length, vectorStore.getEpisodes().length);
    });
  }, []);

  // Auto-snapshot every 5 minutes.
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (activePage) addSnapshot(activePage.id, markdown);
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [activePage, markdown, addSnapshot]);

  // Debounced RAG indexing of the active document.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const embeddingOptions = {
        provider: serviceConfigs.embeddings.provider,
        apiKey: apiKeys?.[serviceConfigs.embeddings.provider as keyof typeof apiKeys],
        model: serviceConfigs.embeddings.model,
      };
      ragService.indexDocument(markdown, embeddingOptions);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [markdown, serviceConfigs.embeddings, apiKeys]);

  // Snapshot when the document is about to unload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activePage) addSnapshot(activePage.id, markdown);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activePage, markdown, addSnapshot]);

  return null;
}
