import { chatWithAI, type ChatMessage } from "../../services/aiService";
import { ragService } from "../../services/ragService";
import { getEditorRef } from "../editorAccess";
import type { AppStores } from "../types";
import { getEmbeddingOptions } from "../../stores/aiStore";
import { StreamBuffer } from "../../services/streamBuffer";

/**
 * Stable, module-level handlers shared by both the `ai` plugin host (chat
 * sidebar, search bar) and the editor tree (slash menu, search highlighting).
 *
 * They intentionally read all mutable state via zustand `getState()` accessors
 * at call time (and reach editors through `getEditorRef`), so the same function
 * instance stays correct across re-renders without being re-created or
 * re-supplied through props.
 *
 * Stores are injected once during plugin initialisation via `setHandlerStores`
 * rather than imported directly, so this module has no import-time coupling to
 * any concrete Zustand store module.
 */

// ── Injected store access ──────────────────────────────────────────────

let _stores: AppStores | null = null;

/**
 * Must be called once during plugin initialisation (see `aiPlugin.init`).
 * After that all handlers read stores through this reference instead of
 * importing store modules directly.
 */
export function setHandlerStores(stores: AppStores): void {
  _stores = stores;
}

/** Accessor that throws if stores have not been injected yet. */
function stores(): AppStores {
  if (!_stores) throw new Error("Handler stores not initialised — call setHandlerStores first");
  return _stores;
}

// ── Helpers ────────────────────────────────────────────────────────────

function getActivePage() {
  const { pages, activeFocusedPageId } = stores().editor.getState();
  return pages.find((p) => p.id === activeFocusedPageId) || pages[0];
}

function aiUI() {
  return stores().aiUI.getState();
}

function ui() {
  return stores().ui.getState();
}

function ai() {
  return stores().ai.getState();
}

// ── Exported handlers ──────────────────────────────────────────────────

export function insertText(before: string, after = "") {
  const activePage = getActivePage();
  if (!activePage) return;
  getEditorRef(activePage.id)?.insertText(before, after);
}

export function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const u = ui();
    const a = aiUI();
    if (e.key === "k") {
      e.preventDefault();
      insertText("[", "](url)");
    } else if (e.key === "f") {
      e.preventDefault();
      u.setSearch(!u.showSearch);
      if (!u.showSearch) a.setSearchIndex(-1);
    } else if (e.key === "/") {
      e.preventDefault();
      a.setShowShortcuts(!a.showShortcuts);
    }
  }
}

export function applyContent(content: string, method: "append" | "insert" | "replace" | "suggest") {
  const activePage = getActivePage();
  if (!activePage) return;
  const editor = getEditorRef(activePage.id);

  switch (method) {
    case "append": {
      const prefix = activePage.content.trim() ? "\n\n" : "";
      editor?.appendMarkdown(prefix + content);
      break;
    }
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
  ui().setAIAssistant(false);
}

export async function handleAiAction(actionId: string, customInstruction?: string) {
  const activePage = getActivePage();
  if (!activePage) return;
  const editor = getEditorRef(activePage.id);
  if (!editor) return;

  const markdown = activePage.content;
  const selectedText = editor.getSelectedText();
  const contextText = selectedText || markdown.substring(0, 5000);

  let prompt: string;
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

  if (customInstruction) {
    prompt += `\n\nAdditional Instruction: ${customInstruction}`;
  }

  const a = ai();
  const aUI = aiUI();

  aUI.setAiPrompt(prompt);
  const userMessage: ChatMessage = {
    role: "user",
    parts: [{ text: prompt }],
  };
  const historyWithUser = [...a.chatHistory, userMessage];
  a.setChatHistory(historyWithUser);
  aUI.setAiPrompt("");
  a.setGenerating(true);
  a.setChatHistory((prev) => [...prev, { role: "model", parts: [{ text: "" }] }]);

  try {
    const embeddingOptions = getEmbeddingOptions();

    // Build stream buffer for smoother UI updates
    const streamBuffer = new StreamBuffer({
      onFlush: (text) => {
        a.setChatHistory((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "model") {
            next[next.length - 1] = {
              ...last,
              parts: [{ text }],
            };
          }
          return next;
        });
      },
    });

    await chatWithAI(historyWithUser, markdown, {
      personalInstructions: a.personalInstructions,
      model: a.serviceConfigs.chat.model,
      provider: a.serviceConfigs.chat.provider,
      apiKeys: a.apiKeys,
      providerConfigs: a.providerConfigs,
      templateOverrides: a.promptTemplates,
      onChunk: (chunk) => {
        streamBuffer.push(chunk);
      },
      cursorContext: editor.getCursorContext() || "",
      embeddingOptions,
    });
    streamBuffer.close();
  } catch (error) {
    console.error("AI Action failed:", error);
    const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
    a.setChatHistory((prev) => {
      const next = [...prev];
      next[next.length - 1] = {
        role: "model",
        parts: [{ text: errorMessage }],
      };
      return next;
    });
  } finally {
    a.setGenerating(false);
  }
}

export function handleFindNext() {
  const aUI = aiUI();
  const {
    findText,
    matchCount,
    isSemantic,
    currentMatchIndex,
    isCaseSensitive,
    isWholeWord,
    searchIndex,
  } = aUI;
  if (!findText || matchCount === 0) return;

  if (isSemantic) {
    aUI.setCurrentMatchIndex((currentMatchIndex % matchCount) + 1);
    return;
  }

  const markdown = getActivePage()?.content || "";
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

  if (result) aUI.setSearchIndex(result.index);
  else aUI.setSearchIndex(-1);
}

export function handleReplace() {
  const aUI = aiUI();
  const { findText, replaceText, searchIndex } = aUI;
  if (!findText) return;
  const activePage = getActivePage();
  if (!activePage) return;
  const { setPageContent } = stores().editor.getState();
  const markdown = activePage.content;
  const start = searchIndex;
  if (start !== -1) {
    const newMarkdown =
      markdown.substring(0, start) + replaceText + markdown.substring(start + findText.length);
    setPageContent(activePage.id, newMarkdown);
    getEditorRef(activePage.id)?.setMarkdown(newMarkdown);
    setTimeout(handleFindNext, 0);
  } else {
    handleFindNext();
  }
}

export function handleReplaceAll() {
  const aUI = aiUI();
  const { findText, replaceText, matchCount, isCaseSensitive, isWholeWord } = aUI;
  if (!findText || matchCount === 0) return;

  if (
    window.confirm(
      `Are you sure you want to replace all ${matchCount} occurrence(s) of "${findText}"?`,
    )
  ) {
    const activePage = getActivePage();
    if (!activePage) return;
    const { setPageContent } = stores().editor.getState();
    const markdown = activePage.content;
    const flags = isCaseSensitive ? "g" : "gi";
    let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (isWholeWord) pattern = `\\b${pattern}\\b`;

    const regex = new RegExp(pattern, flags);
    const newMarkdown = markdown.replace(regex, replaceText);
    setPageContent(activePage.id, newMarkdown);
    getEditorRef(activePage.id)?.setMarkdown(newMarkdown);

    alert(`Successfully replaced ${matchCount} occurrence(s).`);
    aUI.setSearchIndex(-1);
  }
}

/** Index the active document for semantic search before a chat/generate call. */
export function indexActiveDocument() {
  const markdown = getActivePage()?.content || "";
  const embeddingOptions = getEmbeddingOptions();
  ragService.indexDocument(markdown, embeddingOptions);
}
