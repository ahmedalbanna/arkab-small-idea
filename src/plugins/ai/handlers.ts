import { getRagServiceSafe } from "../../services/serviceContainer";
import { getEditorRef } from "../editorAccess";
import type { AppStores } from "../types";

/**
 * Stable, module-level handlers shared by both the `ai` plugin host (search
 * bar) and the editor tree (slash menu, search highlighting).
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
      // Insert content at cursor (ProseMirror semantics: replaces any
      // active selection at cursor, inserts when cursor is collapsed).
      editor?.replaceSelectionWithMarkdown(content);
      break;
    case "replace":
      editor?.replaceSelectionWithMarkdown(content);
      break;
    case "suggest":
      editor?.replaceSelectionWithMarkdown(
        `\n\n> **Suggested Edit:**\n> ${content.split("\n").join("\n> ")}\n\n`,
      );
      break;
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
export function indexActiveDocument(embeddingOptions?: {
  provider?: string;
  apiKey?: string;
  model?: string;
}) {
  const ragService = getRagServiceSafe();
  if (!ragService) return;
  const markdown = getActivePage()?.content || "";
  ragService.indexDocument(markdown, embeddingOptions);
}
