import { chatWithAI, type ChatMessage } from "../../services/aiService";
import { ragService } from "../../services/ragService";
import { getEditorRef } from "../editorAccess";
import { useEditorStore } from "../../stores/editorStore";
import { useAIStore } from "../../stores/aiStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIUIStore } from "../../stores/aiUIStore";

/**
 * Stable, module-level handlers shared by both the `ai` plugin host (chat
 * sidebar, search bar) and the editor tree (slash menu, search highlighting).
 *
 * They intentionally read all mutable state via the zustand `getState()`
 * accessors at call time (and reach editors through `getEditorRef`), so the
 * same function instance stays correct across re-renders without being
 * re-created or re-supplied through props.
 */

function getActivePage() {
  const { pages, activeFocusedPageId } = useEditorStore.getState();
  return pages.find((p) => p.id === activeFocusedPageId) || pages[0];
}

export function insertText(before: string, after = "") {
  const activePage = getActivePage();
  if (!activePage) return;
  getEditorRef(activePage.id)?.insertText(before, after);
}

export function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const ui = useUIStore.getState();
    const editor = useEditorStore.getState();
    const aiUI = useAIUIStore.getState();
    if (e.key === "k") {
      e.preventDefault();
      insertText("[", "](url)");
    } else if (e.key === "f") {
      e.preventDefault();
      ui.setSearch(!ui.showSearch);
      if (!ui.showSearch) aiUI.setSearchIndex(-1);
    } else if (e.key === "/") {
      e.preventDefault();
      aiUI.setShowShortcuts(!aiUI.showShortcuts);
    }
  }
}

export function applyContent(
  content: string,
  method: "append" | "insert" | "replace" | "suggest",
) {
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
  useUIStore.getState().setAIAssistant(false);
}

export async function handleAiAction(
  actionId: string,
  customInstruction?: string,
) {
  const editorState = useEditorStore.getState();
  const activePage = getActivePage();
  if (!activePage) return;
  const editor = getEditorRef(activePage.id);
  if (!editor) return;

  const markdown = activePage.content;
  const selectedText = editor.getSelectedText();
  const contextText = selectedText || markdown.substring(0, 5000);

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

  if (customInstruction) {
    prompt += `\n\nAdditional Instruction: ${customInstruction}`;
  }

  const ai = useAIStore.getState();
  const aiUI = useAIUIStore.getState();

  aiUI.setAiPrompt(prompt);
  const userMessage: ChatMessage = {
    role: "user",
    parts: [{ text: prompt }],
  };
  const historyWithUser = [...ai.chatHistory, userMessage];
  ai.setChatHistory(historyWithUser);
  aiUI.setAiPrompt("");
  ai.setGenerating(true);
  ai.setChatHistory((prev) => [...prev, { role: "model", parts: [{ text: "" }] }]);

  try {
    let fullResponse = "";
    const embeddingOptions = {
      provider: ai.serviceConfigs.embeddings.provider,
      apiKey:
        ai.apiKeys?.[ai.serviceConfigs.embeddings.provider as keyof typeof ai.apiKeys],
      model: ai.serviceConfigs.embeddings.model,
    };

    await chatWithAI(historyWithUser, markdown, {
      personalInstructions: ai.personalInstructions,
      model: ai.serviceConfigs.chat.model,
      provider: ai.serviceConfigs.chat.provider,
      apiKeys: ai.apiKeys,
      providerConfigs: ai.providerConfigs,
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
      cursorContext: editor.getCursorContext() || "",
      embeddingOptions,
    });
  } catch (error) {
    console.error("AI Action failed:", error);
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
    ai.setGenerating(false);
  }
}

export function handleFindNext() {
  const aiUI = useAIUIStore.getState();
  const {
    findText,
    matchCount,
    isSemantic,
    currentMatchIndex,
    isCaseSensitive,
    isWholeWord,
    searchIndex,
  } = aiUI;
  if (!findText || matchCount === 0) return;

  if (isSemantic) {
    aiUI.setCurrentMatchIndex((currentMatchIndex % matchCount) + 1);
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

  if (result) aiUI.setSearchIndex(result.index);
  else aiUI.setSearchIndex(-1);
}

export function handleReplace() {
  const aiUI = useAIUIStore.getState();
  const { findText, replaceText, searchIndex } = aiUI;
  if (!findText) return;
  const activePage = getActivePage();
  if (!activePage) return;
  const { setPageContent } = useEditorStore.getState();
  const markdown = activePage.content;
  const start = searchIndex;
  if (start !== -1) {
    const newMarkdown =
      markdown.substring(0, start) +
      replaceText +
      markdown.substring(start + findText.length);
    setPageContent(activePage.id, newMarkdown);
    getEditorRef(activePage.id)?.setMarkdown(newMarkdown);
    setTimeout(handleFindNext, 0);
  } else {
    handleFindNext();
  }
}

export function handleReplaceAll() {
  const aiUI = useAIUIStore.getState();
  const { findText, replaceText, matchCount, isCaseSensitive, isWholeWord } =
    aiUI;
  if (!findText || matchCount === 0) return;

  if (
    window.confirm(
      `Are you sure you want to replace all ${matchCount} occurrence(s) of "${findText}"?`,
    )
  ) {
    const activePage = getActivePage();
    if (!activePage) return;
    const { setPageContent } = useEditorStore.getState();
    const markdown = activePage.content;
    const flags = isCaseSensitive ? "g" : "gi";
    let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (isWholeWord) pattern = `\\b${pattern}\\b`;

    const regex = new RegExp(pattern, flags);
    const newMarkdown = markdown.replace(regex, replaceText);
    setPageContent(activePage.id, newMarkdown);
    getEditorRef(activePage.id)?.setMarkdown(newMarkdown);

    alert(`Successfully replaced ${matchCount} occurrence(s).`);
    aiUI.setSearchIndex(-1);
  }
}

/** Index the active document for semantic search before a chat/generate call. */
export function indexActiveDocument() {
  const ai = useAIStore.getState();
  const markdown = getActivePage()?.content || "";
  const embeddingOptions = {
    provider: ai.serviceConfigs.embeddings.provider,
    apiKey:
      ai.apiKeys?.[ai.serviceConfigs.embeddings.provider as keyof typeof ai.apiKeys],
    model: ai.serviceConfigs.embeddings.model,
  };
  ragService.indexDocument(markdown, embeddingOptions);
}
