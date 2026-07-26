import React, { useEffect } from "react";

import { SearchBar } from "../../components/overlays/SearchBar";
import { ShortcutsHelp } from "../../components/overlays/ShortcutsHelp";
import TTSSpeaker from "../../components/TTSSpeaker";
import { checkOllamaConnection } from "../../services/aiService";
import { ragService } from "../../services/ragService";
import { getEditorRef } from "../editorAccess";
import { usePluginServices } from "../appContext";
import { handleFindNext, handleReplace, handleReplaceAll } from "./handlers";

/**
 * Compute embedding options from the ai store state. Inlined here to avoid
 * importing `getEmbeddingOptions` from the store module directly.
 */
function getEmbeddingOptions(stores: any): { provider?: string; apiKey?: string; model?: string } {
  const state = stores.ai.getState();
  return {
    provider: state.serviceConfigs?.embeddings?.provider,
    apiKey: state.apiKeys?.[state.serviceConfigs?.embeddings?.provider],
    model: state.serviceConfigs?.embeddings?.model,
  };
}

/**
 * Host component for the `ai` plugin. It owns the search UI, TTS, shortcuts help,
 * and the Ollama connection health check. State and shared handlers live in
 * `aiUIStore` / `handlers.ts` so the editor tree can read the same values
 * without prop-drilling.
 *
 * Reads stores from PluginContext (via usePluginServices) rather than importing
 * them directly, keeping the plugin decoupled from specific store modules.
 */
export function AIHost() {
  const { pluginContext } = usePluginServices();
  const stores = pluginContext.stores;

  const { serviceConfigs, apiKeys, ollamaStatus, setOllamaStatus, setAvailableModels } =
    stores.ai();

  const {
    findText,
    setFindText,
    replaceText,
    setReplaceText,
    isCaseSensitive,
    setIsCaseSensitive,
    isWholeWord,
    setIsWholeWord,
    isSemantic,
    setIsSemantic,
    searchIndex,
    matchCount,
    currentMatchIndex,
    setMatchCount,
    setCurrentMatchIndex,
    setSearchIndex,
    semanticResults,
    setSemanticResults,
    showShortcuts,
    setShowShortcuts,
  } = stores.aiUI();

  const activePage = stores.editor(
    (s: any) => s.pages.find((p: any) => p.id === s.activeFocusedPageId) || s.pages[0],
  );

  const activeFocusedPageId = stores.editor((s: any) => s.activeFocusedPageId);
  const markdown = activePage?.content || "";

  // Track the last active editor so runAiAction() can detect stale references
  // when a page switch races with an AI action dispatch.
  useEffect(() => {
    if (activeFocusedPageId) {
      stores.aiUI.getState().setLastActiveEditorId(activeFocusedPageId);
    }
  }, [activeFocusedPageId]);

  // Search highlighting (regex + semantic via RAG).
  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      setCurrentMatchIndex(0);
      setSearchIndex(-1);
      setSemanticResults([]);
      return;
    }

    if (isSemantic) {
      const performSemanticSearch = async () => {
        try {
          const embeddingOptions = getEmbeddingOptions(stores);
          const results = await ragService.searchDetailed(findText, 10, 0.2, embeddingOptions);
          const docMatches = results.filter((r) => r.source === "document");
          setMatchCount(docMatches.length);
          setSemanticResults(results);

          if (docMatches.length > 0 && searchIndex === -1) {
            setCurrentMatchIndex(0);
          } else if (docMatches.length === 0) {
            setCurrentMatchIndex(0);
            setSearchIndex(-1);
          }
        } catch (error) {
          console.error("Semantic search failed:", error);
          setMatchCount(0);
        }
      };

      performSemanticSearch();
      return;
    }

    const flags = isCaseSensitive ? "g" : "gi";
    let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (isWholeWord) pattern = `\\b${pattern}\\b`;

    try {
      const regex = new RegExp(pattern, flags);
      const matches = [...markdown.matchAll(regex)];
      setMatchCount(matches.length);

      const idx = matches.findIndex((m) => m.index === searchIndex);
      if (idx !== -1) {
        setCurrentMatchIndex(idx + 1);
      } else if (matches.length > 0 && searchIndex === -1) {
        setCurrentMatchIndex(0);
      } else if (matches.length === 0) {
        setCurrentMatchIndex(0);
        setSearchIndex(-1);
      }
    } catch {
      setMatchCount(0);
      setCurrentMatchIndex(0);
    }
  }, [
    findText,
    markdown,
    isCaseSensitive,
    isWholeWord,
    isSemantic,
    searchIndex,
    serviceConfigs,
    apiKeys,
  ]);

  // Ollama connection check.
  useEffect(() => {
    const anyOllama = Object.values(serviceConfigs).some((c) => c.provider === "ollama");

    if (anyOllama) {
      setOllamaStatus({ ...ollamaStatus, loading: true });
      const activeOllamaModel =
        Object.values(serviceConfigs).find((c) => c.provider === "ollama")?.model || "mistral";
      checkOllamaConnection(activeOllamaModel).then((res) => {
        setOllamaStatus({
          loading: false,
          connected: res.success,
          model: res.model || "",
          error: res.error,
        });
        if (res.allModels) setAvailableModels(res.allModels);
      });
    } else {
      setOllamaStatus({
        loading: false,
        connected: false,
        model: "",
      });
    }
  }, [serviceConfigs]);

  return (
    <>
      <SearchBar
        findText={findText}
        setFindText={setFindText}
        replaceText={replaceText}
        setReplaceText={setReplaceText}
        matchCount={matchCount}
        currentMatchIndex={currentMatchIndex}
        isCaseSensitive={isCaseSensitive}
        setIsCaseSensitive={setIsCaseSensitive}
        isWholeWord={isWholeWord}
        setIsWholeWord={setIsWholeWord}
        isSemantic={isSemantic}
        setIsSemantic={setIsSemantic}
        semanticResults={semanticResults}
        handleFindNext={handleFindNext}
        handleReplace={handleReplace}
        handleReplaceAll={handleReplaceAll}
        setSearchIndex={setSearchIndex}
      />

      <TTSSpeaker
        editorRef={
          {
            current: activePage ? getEditorRef(activePage.id) || null : null,
          } as any
        }
      />

      <ShortcutsHelp showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts} />
    </>
  );
}
