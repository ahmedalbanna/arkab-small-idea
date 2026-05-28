/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useMediaQuery } from "./lib/utils";
import { EditorRef } from "./components/ProseMirrorEditor";
import {
  chatWithAI,
  checkOllamaConnection,
  type ChatMessage,
} from "./services/aiService";
import { ragService } from "./services/ragService";
import { importFile } from "./services/importService";
import { embeddingService, EmbeddingStatus } from "./services/embeddingService";
import { useEditorStore } from "./stores/editorStore";
import { useUIStore } from "./stores/uiStore";
import { useAIStore } from "./stores/aiStore";
import { useSettingsStore } from "./stores/settingsStore";

// Components
import { MobileMenu } from "./components/navigation/MobileMenu";
import { AIAssistantSidebar } from "./components/ai/AIAssistantSidebar";
import { PagesManager } from "./components/navigation/PagesManager";

import { AIProviderSettings } from "./components/ai/AIProviderSettings";
import { EditorContainer } from "./components/editor/EditorContainer";
import { FloatingToolbar } from "./components/navigation/FloatingToolbar";
import { SearchBar } from "./components/overlays/SearchBar";
import { SettingsModal } from "./components/overlays/SettingsModal";
import { ShortcutsHelp } from "./components/overlays/ShortcutsHelp";
import { ImportModal } from "./components/overlays/ImportModal";
import { StatusBar } from "./components/layout/StatusBar";
import { MobileToolbar } from "./components/navigation/MobileToolbar";
import { SemanticFolders } from "./components/SemanticFolders";
import TTSSpeaker from "./components/TTSSpeaker";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "./lib/utils";

export default function App() {
  const {
    pages,
    activePageIds,
    activeFocusedPageId,
    setPageContent,
    addPage,
    togglePageOpen,
    setPageSettings,
    addSnapshot,
    loadSnapshots,
  } = useEditorStore();

  // Ref for multiple editors
  const editorRefs = useRef<Record<string, EditorRef | null>>({});

  // For compatibility with single-doc logic, we'll use the "focused" page
  const activePage =
    pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const markdown = activePage?.content || "";
  const setMarkdown = (content: string) => {
    if (activePage) setPageContent(activePage.id, content);
  };

  const {
    showAIAssistant: showAiAssistant,
    setAIAssistant: setAiAssistant,
    showSearch,
    setSearch,
    showSemanticFolders,
    setSemanticFolders,
    setMobileMenu,
    showSettings,
    setSettings,
    showAiSettings,
    setAiSettings,
    showPages,
    setPagesMenu,
    direction,
    setDirection,
  } = useUIStore();

  const {
    chatHistory,
    setChatHistory,
    personalInstructions: aiPersonalInstructions,
    setPersonalInstructions: setAiPersonalInstructions,
    setAvailableModels,
    isGenerating: isGeneratingAi,
    setGenerating: setIsGeneratingAi,
    ollamaStatus,
    setOllamaStatus,
    provider,
    serviceConfigs,
    setServiceProvider,
    setServiceModel,
    apiKeys,
    setApiKey,
    providerConfigs,
    setOllamaHost,
  } = useAIStore();

  const {
    theme,
    fontSize,
    lineHeight,
    maxWidth,
    fontFamily,
    headingColor,
    enableHeadingNumbering,
  } = useSettingsStore();

  useEffect(() => {
    document.documentElement.style.setProperty("--heading-color", headingColor);
    document.documentElement.style.setProperty("--minimal-accent", headingColor);
  }, [headingColor]);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(useEditorStore.persist.hasHydrated());
    const unsub = useEditorStore.persist.onFinishHydration(() =>
      setHasHydrated(true),
    );
    return unsub;
  }, []);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSettingsTab, setAiSettingsTab] = useState<
    "chat" | "actions" | "semantic" | "embeddings"
  >("chat");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [searchIndex, setSearchIndex] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [isSemantic, setIsSemantic] = useState(false);
  const [semanticResults, setSemanticResults] = useState<
    { text: string; score: number; source?: string }[]
  >([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFileActions, setShowFileActions] = useState(false);
  const pagesRef = useRef(pages);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [chatAttachedImages, setChatAttachedImages] = useState<string[]>([]);

  const [embeddingStatus, setEmbeddingStatus] =
    useState<EmbeddingStatus>("idle");
  const [embeddingProgress, setEmbeddingProgress] = useState(0);

  useEffect(() => {
    return embeddingService.subscribe((status, progress) => {
      setEmbeddingStatus(status);
      setEmbeddingProgress(progress);
    });
  }, []);

  useEffect(() => {
    import("./services/embeddingService").then(({ vectorStore }) => {
      vectorStore.init().then(() => {
        useUIStore
          .getState()
          .setIndexedCounts(
            vectorStore.getChunks().length,
            vectorStore.getEpisodes().length,
          );
      });
    });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) {
      alert("Please upload image files.");
      return;
    }

    const promises = imageFiles.map((file) => {
      return new Promise<{ src: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({ src: event.target?.result as string, name: file.name });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((results) => {
      if (activePage) {
        if (results.length > 1) {
          editorRefs.current[activePage.id]?.insertGallery(
            results.map((r) => r.src),
          );
        } else {
          editorRefs.current[activePage.id]?.insertImage(
            results[0].src,
            results[0].name,
          );
        }
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setChatAttachedImages((prev) => [...prev, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (chatImageInputRef.current) chatImageInputRef.current.value = "";
  };

  const formatChatInput = (type: "bold" | "italic" | "list") => {
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

    const newText =
      text.substring(0, selectionStart) +
      formatted +
      text.substring(selectionEnd);
    setAiPrompt(newText);

    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
        const newPos =
          selectionStart + cursorOffset + (selected ? selected.length : 0);
        chatInputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Auto-snapshot every 5 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (activePage) addSnapshot(activePage.id, markdown);
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [activePage, markdown, addSnapshot]);

  // Debounced RAG indexing
  useEffect(() => {
    const timeout = setTimeout(() => {
      const embeddingOptions = {
        provider: serviceConfigs.embeddings.provider,
        apiKey:
          apiKeys?.[serviceConfigs.embeddings.provider as keyof typeof apiKeys],
        model: serviceConfigs.embeddings.model,
      };
      ragService.indexDocument(markdown, embeddingOptions);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [markdown, serviceConfigs.embeddings, apiKeys]);

  // Snapshot on document close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activePage) addSnapshot(activePage.id, markdown);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activePage, markdown, addSnapshot]);

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.style.setProperty("--minimal-font", fontFamily);
    root.style.setProperty("--editor-font-size", `${fontSize}px`);
    root.style.setProperty("--editor-line-height", lineHeight.toString());
    root.style.setProperty("--editor-max-width", maxWidth);
  }, [theme, fontFamily, fontSize, lineHeight, maxWidth]);

  const insertText = (before: string, after: string = "") => {
    if (!activePage) return;
    const activeId = activePage.id;
    if (!editorRefs.current[activeId]) return;
    editorRefs.current[activeId]?.insertText(before, after);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "k") {
        e.preventDefault();
        insertText("[", "](url)");
      } else if (e.key === "f") {
        e.preventDefault();
        setSearch(!showSearch);
        if (!showSearch) {
          setSearchIndex(-1);
        }
      } else if (e.key === "t" && e.shiftKey) {
        e.preventDefault();
        if (activePage) {
          setPageSettings(activePage.id, {
            isTypewriter: !activePage.isTypewriter,
          });
        }
      } else if (e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    }
  };

  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      setCurrentMatchIndex(0);
      setSearchIndex(-1);
      setSemanticResults([]);
      return;
    }

    if (isSemantic) {
      // Semantic search is handled by the search plugin asynchronously,
      // but we still want to trigger the calculation and update counts in App.tsx
      const performSemanticSearch = async () => {
        try {
          const embeddingOptions = {
            provider: serviceConfigs.embeddings.provider,
            apiKey:
              apiKeys?.[
                serviceConfigs.embeddings.provider as keyof typeof apiKeys
              ],
            model: serviceConfigs.embeddings.model,
          };
          const results = await ragService.searchDetailed(
            findText,
            10,
            0.2,
            embeddingOptions,
          );
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
    if (isWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }

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
    } catch (e) {
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
  ]);

  const handleFindNext = () => {
    if (!findText || matchCount === 0) return;

    if (isSemantic) {
      const nextIdx = (currentMatchIndex % matchCount) + 1;
      setCurrentMatchIndex(nextIdx);
      return;
    }

    const flags = isCaseSensitive ? "g" : "gi";
    let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (isWholeWord) pattern = `\\b${pattern}\\b`;

    const regex = new RegExp(pattern, flags);
    const startPos = searchIndex === -1 ? 0 : searchIndex + 1;
    regex.lastIndex = startPos;

    let result = regex.exec(markdown);
    if (!result) {
      regex.lastIndex = 0;
      result = regex.exec(markdown);
    }

    if (result) {
      setSearchIndex(result.index);
    } else {
      setSearchIndex(-1);
    }
  };

  const handleReplace = () => {
    if (!findText) return;
    const start = searchIndex;
    if (start !== -1) {
      const newMarkdown =
        markdown.substring(0, start) +
        replaceText +
        markdown.substring(start + findText.length);
      setMarkdown(newMarkdown);
      if (activePage) {
        editorRefs.current[activePage.id]?.setMarkdown(newMarkdown);
      }
      setTimeout(handleFindNext, 0);
    } else {
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!findText || matchCount === 0) return;

    if (
      window.confirm(
        `Are you sure you want to replace all ${matchCount} occurrence(s) of "${findText}"?`,
      )
    ) {
      const flags = isCaseSensitive ? "g" : "gi";
      let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (isWholeWord) pattern = `\\b${pattern}\\b`;

      const regex = new RegExp(pattern, flags);
      const newMarkdown = markdown.replace(regex, replaceText);
      setMarkdown(newMarkdown);
      if (activePage) {
        editorRefs.current[activePage.id]?.setMarkdown(newMarkdown);
      }

      alert(`Successfully replaced ${matchCount} occurrence(s).`);
      setSearchIndex(-1);
    }
  };

  const takeSnapshot = async () => {
    if (activePage) {
      await addSnapshot(activePage.id, markdown);
      alert("Snapshot saved successfully.");
    }
  };

  const handleAiAction = async (actionId: string) => {
    if (!activePage) return;
    const activeId = activePage.id;
    const editor = editorRefs.current[activeId];
    if (!editor) return;

    const selectedText = editor.getSelectedText();
    const contextText = selectedText || markdown.substring(0, 5000); // Limit context size

    let prompt = "";
    if (actionId.startsWith("custom:")) {
      prompt = actionId.replace("custom:", "");
    } else {
      switch (actionId) {
        case "improve":
          prompt = `Improve the following text for clarity, flow, and impact:\n\n"${contextText}"`;
          break;
        case "summarize":
          prompt = `Summarize the following text while retaining key points:\n\n"${contextText}"`;
          break;
        case "rewrite":
          prompt = `Rewrite the following text in a more professional and engaging tone:\n\n"${contextText}"`;
          break;
        case "expand":
          prompt = `Expand on the following ideas with more detail and examples:\n\n"${contextText}"`;
          break;
        case "generate-outline":
          prompt = `Generate a structured outline for a document based on this context:\n\n"${contextText}"`;
          break;
        case "draft-topic":
          prompt = `Draft a comprehensive section about this topic:\n\n"${contextText}"`;
          break;
        case "fix-grammar":
          prompt = `Fix the grammar, spelling, and punctuation in the following text:\n\n"${contextText}"`;
          break;
        case "complete-text":
          prompt = `Continue writing based on the following context, maintaining the same style and tone:\n\n"${contextText}"`;
          break;
        case "suggest-title":
          prompt = `Suggest 5 creative and relevant titles for a document with this content:\n\n"${contextText}"`;
          break;
        case "shorten":
          prompt = `Condense the following text to be more concise without losing its meaning:\n\n"${contextText}"`;
          break;
        default:
          return;
      }
    }

    setAiPrompt(prompt);
    // Actually we can trigger handleAiGenerate immediately after setting the prompt
    // but setAiPrompt is async-like (state update), so we use the local variable

    // Manual trigger of handleAiGenerate logic with the specific prompt
    const userMessage: ChatMessage = {
      role: "user",
      parts: [{ text: prompt }],
    };
    const historyWithUser = [...chatHistory, userMessage];
    setChatHistory(historyWithUser);
    setAiPrompt("");
    setIsGeneratingAi(true);
    setChatHistory((prev) => [
      ...prev,
      { role: "model", parts: [{ text: "" }] },
    ]);

    try {
      let fullResponse = "";
      const embeddingOptions = {
        provider: serviceConfigs.embeddings.provider,
        apiKey:
          apiKeys?.[serviceConfigs.embeddings.provider as keyof typeof apiKeys],
        model: serviceConfigs.embeddings.model,
      };

      const response = await chatWithAI(historyWithUser, markdown, {
        personalInstructions: aiPersonalInstructions,
        model: serviceConfigs.chat.model,
        provider: serviceConfigs.chat.provider,
        apiKeys,
        providerConfigs,
        onChunk: (chunk) => {
          fullResponse += chunk;
          setChatHistory((prev) => {
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
        cursorContext: editor.getCursorContext() || "",
        embeddingOptions,
      });
    } catch (error) {
      console.error("AI Action failed:", error);
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      setChatHistory((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "model",
          parts: [{ text: errorMessage }],
        };
        return next;
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const chatAbortControllerRef = useRef<AbortController | null>(null);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() && chatAttachedImages.length === 0) return;

    if (chatAbortControllerRef.current) {
        chatAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    chatAbortControllerRef.current = abortController;

    const embeddingOptions = {
      provider: serviceConfigs.embeddings.provider,
      apiKey:
        apiKeys?.[serviceConfigs.embeddings.provider as keyof typeof apiKeys],
      model: serviceConfigs.embeddings.model,
    };
    ragService.indexDocument(markdown, embeddingOptions);

    const userMessage: ChatMessage = {
      role: "user",
      parts: [{ text: aiPrompt }],
      images: chatAttachedImages.length > 0 ? chatAttachedImages : undefined,
    };
    const historyWithUser = [...chatHistory, userMessage];
    setChatHistory(historyWithUser);
    setAiPrompt("");
    setChatAttachedImages([]);
    setIsGeneratingAi(true);

    setChatHistory((prev) => [
      ...prev,
      { role: "model", parts: [{ text: "" }] },
    ]);

    if (!activePage) return;
    const activeId = activePage.id;
    const cursorContext =
      editorRefs.current[activeId]?.getCursorContext() || "";

    try {
      let fullResponse = "";
      const response = await chatWithAI(historyWithUser, markdown, {
        personalInstructions: aiPersonalInstructions,
        model: serviceConfigs.chat.model,
        provider: serviceConfigs.chat.provider,
        apiKeys,
        providerConfigs,
        signal: abortController.signal,
        onChunk: (chunk) => {
          fullResponse += chunk;
          setChatHistory((prev) => {
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
         console.log("Chat aborted by user");
         chatAbortControllerRef.current = null;
         setIsGeneratingAi(false);
         return;
      }
      console.error("AI Generation failed:", error);
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      setChatHistory((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "model",
          parts: [{ text: errorMessage }],
        };
        return next;
      });
    } finally {
      setIsGeneratingAi(false);
      chatAbortControllerRef.current = null;
    }
  };

  const stopAiGenerate = () => {
    if (chatAbortControllerRef.current) {
        chatAbortControllerRef.current.abort();
    }
  };

  const applyContent = (
    content: string,
    method: "append" | "insert" | "replace" | "suggest",
  ) => {
    if (!activePage) return;
    const activeId = activePage.id;
    const editor = editorRefs.current[activeId];

    switch (method) {
      case "append":
        const prefix = markdown.trim() ? "\n\n" : "";
        editor?.appendMarkdown(prefix + content);
        break;
      case "insert":
      case "replace":
        editor?.replaceSelectionWithMarkdown(content);
        break;
      case "suggest":
        editor?.replaceSelectionWithMarkdown(
          `\n\n> **Suggested Edit:**\n> ${content.split("\n").join("\n> ")}\n\n`,
        );
        break;
    }
    setAiAssistant(false);
  };

  useEffect(() => {
    const anyOllama = Object.values(serviceConfigs).some(
      (c) => c.provider === "ollama",
    );

    if (anyOllama) {
      setOllamaStatus({ ...ollamaStatus, loading: true });
      const activeOllamaModel =
        Object.values(serviceConfigs).find((c) => c.provider === "ollama")
          ?.model || "mistral";
      checkOllamaConnection(activeOllamaModel).then((res) => {
        setOllamaStatus({
          loading: false,
          connected: res.success,
          model: res.model || "",
          error: res.error,
        });
        if (res.allModels) {
          setAvailableModels(res.allModels);
        }
      });
    } else {
      setOllamaStatus({
        loading: false,
        connected: false,
        model: "",
      });
    }
  }, [serviceConfigs]);

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const charCount = markdown.length;
  const readingTime = Math.ceil(wordCount / 200);
  const goalProgress =
    (activePage?.wordGoal ?? 0) > 0
      ? Math.min((wordCount / activePage.wordGoal) * 100, 100)
      : 0;

  if (!hasHydrated) return null;

  return (
    <div
      dir={direction}
      className={cn(
        "h-screen overflow-hidden bg-minimal-bg text-minimal-text font-sans flex flex-col selection:bg-minimal-accent/20 transition-colors duration-500",
        "",
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
        multiple
      />

      <MobileMenu />

      <AIAssistantSidebar
        chatScrollRef={chatScrollRef}
        chatInputRef={chatInputRef}
        chatImageInputRef={chatImageInputRef}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        chatAttachedImages={chatAttachedImages}
        setChatAttachedImages={setChatAttachedImages}
        handleAiGenerate={handleAiGenerate}
        handleChatImageUpload={handleChatImageUpload}
        formatChatInput={formatChatInput}
        applyContent={applyContent}
        onAction={handleAiAction}
        stopAiGenerate={stopAiGenerate}
      />

      <AIProviderSettings
        aiSettingsTab={aiSettingsTab}
        setAiSettingsTab={setAiSettingsTab}
      />

      <EditorContainer
        editorRefs={editorRefs}
        handleKeyDown={handleKeyDown}
        insertText={insertText}
        fileInputRef={fileInputRef}
        applyContent={applyContent}
        handleAiAction={handleAiAction}
        isSemantic={isSemantic}
        setMatchCount={setMatchCount}
        findText={findText}
        isCaseSensitive={isCaseSensitive}
        isWholeWord={isWholeWord}
        searchIndex={searchIndex}
        currentMatchIndex={currentMatchIndex}
      />

      {!isMobile && (
        <FloatingToolbar direction={direction} setDirection={setDirection} />
      )}

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

      <AnimatePresence>
        {showSemanticFolders && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 z-[100] w-[320px] shadow-2xl"
          >
            <div className="h-full relative">
              <button
                onClick={() => setSemanticFolders(false)}
                className="absolute top-4 -left-12 p-2 bg-minimal-bg border border-minimal-border rounded-full hover:text-red-500 transition-colors shadow-lg z-[110]"
              >
                <X className="w-4 h-4" />
              </button>
              <SemanticFolders
                onJump={(text) => {
                  if (activePage) {
                    editorRefs.current[activePage.id]?.scrollToText(text);
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PagesManager />

      {isMobile && (
        <MobileToolbar
          editorRef={{
            current: activePage ? editorRefs.current[activePage.id] : null,
          }}
          fileInputRef={fileInputRef}
          insertText={insertText}
        />
      )}

      <SettingsModal />

      <ShortcutsHelp
        showShortcuts={showShortcuts}
        setShowShortcuts={setShowShortcuts}
      />

      <ImportModal
        onImport={(content) => {
          setMarkdown(content);
          if (activePage) {
            editorRefs.current[activePage.id]?.setMarkdown(content);
          }
        }}
      />

      <TTSSpeaker />

      <StatusBar
        wordCount={wordCount}
        charCount={charCount}
        readingTime={readingTime}
        wordGoal={activePage?.wordGoal ?? 0}
        goalProgress={goalProgress}
        embeddingStatus={embeddingStatus}
        embeddingProgress={embeddingProgress}
      />
    </div>
  );
}
