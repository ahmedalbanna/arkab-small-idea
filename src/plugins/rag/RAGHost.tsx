import { useEffect } from "react";
import { usePluginServices } from "../appContext";

/**
 * App-level host for the RAG plugin.
 *
 * Initialises the vector store on mount and syncs the indexed chunk/episode
 * counts into the UI store so the bottom bar can display them.
 *
 * Reads services from PluginContext via `usePluginServices()` rather than
 * importing concrete modules directly.
 */
export function RAGHost(): null {
  const { pluginContext } = usePluginServices();
  const vectorStore = pluginContext.vectorStore;
  const uiStore = pluginContext.stores?.ui;

  useEffect(() => {
    if (!vectorStore) return;

    vectorStore.init().then(() => {
      if (uiStore) {
        uiStore
          .getState()
          .setIndexedCounts(vectorStore.getChunks().length, vectorStore.getEpisodes().length);
      }
    });
  }, [vectorStore, uiStore]);

  return null;
}
