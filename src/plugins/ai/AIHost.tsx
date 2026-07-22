import React, { useRef, useEffect, useCallback } from "react";

import { AIAssistant } from "../../components/ai/AIAssistant";
import type { OllamaStatus } from "../../components/ai/AssistantHeader";
import { AIProviderSettings } from "../../components/ai/AIProviderSettings";
import { SearchBar } from "../../components/overlays/SearchBar";
import { ShortcutsHelp } from "../../components/overlays/ShortcutsHelp";
import { PanelSlot } from "../../components/layout/PanelSlot";
import TTSSpeaker from "../../components/TTSSpeaker";
import { chatWithAI, checkOllamaConnection, type ChatMessage } from "../../services/aiService";
import { ragService } from "../../services/ragService";
import { useAIStore } from "../../stores/aiStore";
import { useUIStore } from "../../stores/uiStore";
import { useEditorStore } from "../../stores/editorStore";
import { useAIUIStore } from "../../stores/aiUIStore";
import { getEmbeddingOptions } from "../../stores/aiStore";
import { getEditorRef } from "../editorAccess";
import {
  applyContent,
  handleAiAction,
  handleFindNext,
  handleReplace,
  handleReplaceAll,
  indexActiveDocument,
} from "./handlers";

/**
 * Host component for the `ai` plugin. It owns the AI assistant / search UI and
 * the side-effects that used to live in `App.tsx` (semantic + regex search
 * highlighting, Ollama connection check, chat auto-scroll). State and the
 * shared handlers live in `aiUIStore` / `handlers.ts` so the editor tree can
 * read the same values without prop-drilling.
 */
export function AIHost() {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const chatAbortControllerRef = useRef<AbortController | null>(null);

  const {
    chatHistory,
    isGenerating,
    serviceConfigs,
    apiKeys,
    ollamaStatus,
    setOllamaStatus,
    setAvailableModels,
  } = useAIStore();

  const { showAIAssistant, setAIAssistant } = useUIStore();

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
    aiPrompt,
    setAiPrompt,
    chatAttachedImages,
    setChatAttachedImages,
    aiSettingsTab,
    setAiSettingsTab,
    showShortcuts,
    setShowShortcuts,
  } = useAIUIStore();

  const activePage = useEditorStore(
    (s) => s.pages.find((p) => p.id === s.activeFocusedPageId) || s.pages[0],
  );
  const markdown = activePage?.content || "";

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
          const embeddingOptions = getEmbeddingOptions();
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

  // Keep the chat scrolled to the latest message.
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  /**
   * Stream a chat reply for a history that already ends with the user turn.
   * Shared by normal generation and retry so behaviour stays identical.
   */
  const streamReply = useCallback(
    async (historyWithUser: ChatMessage[]) => {
      if (chatAbortControllerRef.current) {
        chatAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      chatAbortControllerRef.current = abortController;

      const embeddingOptions = getEmbeddingOptions();

      const ai = useAIStore.getState();
      ai.setGenerating(true);
      ai.setChatHistory((prev) => [...prev, { role: "model", parts: [{ text: "" }] }]);

      const state = useEditorStore.getState();
      const page = state.pages.find((p) => p.id === state.activeFocusedPageId) || state.pages[0];
      if (!page) {
        ai.setGenerating(false);
        chatAbortControllerRef.current = null;
        return;
      }
      const cursorContext = getEditorRef(page.id)?.getCursorContext() || "";

      try {
        let fullResponse = "";
        await chatWithAI(historyWithUser, page.content, {
          personalInstructions: ai.personalInstructions,
          model: ai.serviceConfigs.chat.model,
          provider: ai.serviceConfigs.chat.provider,
          apiKeys: ai.apiKeys,
          providerConfigs: ai.providerConfigs,
          signal: abortController.signal,
          onChunk: (chunk) => {
            fullResponse += chunk;
            ai.setChatHistory((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "model") {
                next[next.length - 1] = {
                  ...last,
                  parts: [{ text: fullResponse }],
                };
              }
              return next;
            });
          },
          cursorContext,
          embeddingOptions,
        });
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.info("Chat aborted by user");
          chatAbortControllerRef.current = null;
          useAIStore.getState().setGenerating(false);
          return;
        }
        console.error("AI Generation failed:", error);
        const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
        ai.setChatHistory((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "model",
            parts: [{ text: errorMessage }],
          };
          return next;
        });
      } finally {
        useAIStore.getState().setGenerating(false);
        chatAbortControllerRef.current = null;
      }
    },
    [serviceConfigs, apiKeys],
  );

  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim() && chatAttachedImages.length === 0) return;

    indexActiveDocument();

    const ai = useAIStore.getState();
    const userMessage: ChatMessage = {
      role: "user",
      parts: [{ text: aiPrompt }],
      images: chatAttachedImages.length > 0 ? chatAttachedImages : undefined,
    };
    const historyWithUser = [...ai.chatHistory, userMessage];
    ai.setChatHistory(historyWithUser);
    setAiPrompt("");
    setChatAttachedImages([]);
    await streamReply(historyWithUser);
  }, [aiPrompt, chatAttachedImages, streamReply]);

  const handleRetry = useCallback(() => {
    const ai = useAIStore.getState();
    const history = ai.chatHistory;
    let lastUserIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const truncated = history.slice(0, lastUserIdx + 1);
    ai.setChatHistory(truncated);
    streamReply(truncated);
  }, [streamReply]);

  const runAiAction = useCallback((actionId: string) => {
    if (actionId === "brainstorm") {
      setAiPrompt("Brainstorm 5 creative angles for this document:");
      setTimeout(() => chatInputRef.current?.focus(), 0);
      return;
    }
    handleAiAction(actionId);
  }, []);

  const handleDismissMessage = useCallback((index: number) => {
    const ai = useAIStore.getState();
    ai.setChatHistory((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) next.splice(index, 1);
      return next;
    });
  }, []);

  const handleReviseMessage = useCallback((text: string) => {
    const instruction = `Revise the following text based on this instruction: "${text}". Keep the same language and meaning, improve clarity and flow.`;
    handleAiAction("rewrite", instruction);
  }, []);

  const stopAiGenerate = useCallback(() => {
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
    }
  }, []);

  const handleChatImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const current = useAIUIStore.getState().chatAttachedImages;
          setChatAttachedImages([...current, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (chatImageInputRef.current) chatImageInputRef.current.value = "";
  }, []);

  const formatChatInput = useCallback(
    (type: "bold" | "italic" | "list") => {
      if (!chatInputRef.current) return;
      const { selectionStart, selectionEnd } = chatInputRef.current;
      const text = aiPrompt;
      const selected = text.substring(selectionStart, selectionEnd);
      let formatted = "";
      let cursorOffset = 0;

      switch (type) {
        case "bold":
          formatted = `**${selected}**`;
          cursorOffset = 2;
          break;
        case "italic":
          formatted = `*${selected}*`;
          cursorOffset = 1;
          break;
        case "list":
          formatted = `\n- ${selected}`;
          cursorOffset = 3;
          break;
      }

      const newText = text.substring(0, selectionStart) + formatted + text.substring(selectionEnd);
      setAiPrompt(newText);

      setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus();
          const newPos = selectionStart + cursorOffset + (selected ? selected.length : 0);
          chatInputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [aiPrompt],
  );

  const ollamaStatusKey: OllamaStatus = ollamaStatus.loading
    ? "loading"
    : ollamaStatus.connected
      ? "ready"
      : ollamaStatus.error
        ? "error"
        : "no-ollama";

  return (
    <>
      <PanelSlot
        isOpen={showAIAssistant}
        onClose={() => setAIAssistant(false)}
        side="end"
        zLevel="panel"
        showBackdrop={false}
        showCloseButton={false}
        className="w-full md:w-1/2 md:min-w-[380px] md:max-w-[700px]"
      >
        <AIAssistant
          ollamaStatus={ollamaStatusKey}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          chatInputRef={chatInputRef}
          chatImageInputRef={chatImageInputRef}
          chatAttachedImages={chatAttachedImages}
          setChatAttachedImages={setChatAttachedImages}
          chatHistory={chatHistory}
          isGenerating={isGenerating}
          scrollRef={chatScrollRef}
          handleAiGenerate={handleAiGenerate}
          handleChatImageUpload={handleChatImageUpload}
          formatChatInput={formatChatInput}
          stopAiGenerate={stopAiGenerate}
          handleAiAction={runAiAction}
          handleDismissMessage={handleDismissMessage}
          handleReviseMessage={handleReviseMessage}
          onApply={applyContent}
          onRetry={handleRetry}
          onClose={() => setAIAssistant(false)}
        />
      </PanelSlot>

      <AIProviderSettings aiSettingsTab={aiSettingsTab} setAiSettingsTab={setAiSettingsTab} />

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
