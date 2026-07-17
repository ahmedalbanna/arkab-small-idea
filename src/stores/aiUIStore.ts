import { create } from "zustand";
import type { AIAssistantAction } from "../services/aiService";

export type AISettingsTab = "chat" | "actions" | "semantic" | "embeddings";

export interface SemanticResult {
  text: string;
  score: number;
  source?: string;
}

/** A value or a functional updater, so store setters mirror React's `setState`. */
type Updatable<T> = T | ((prev: T) => T);

/** Hover menu shown in the editor's left gutter for the current block. */
export interface SideMenuState {
  y: number;
  show: boolean;
  pos: number;
  nodeName?: string;
  /** Id of the editor this menu belongs to (scopes it to one editor). */
  editorId: string;
}

/** Right-click context menu positioned over the editor. */
export interface ContextMenuState {
  x: number;
  y: number;
  show: boolean;
  pos: number;
  /** Id of the editor this menu belongs to (scopes it to one editor). */
  editorId: string;
}

/** Selection bubble menu positioned over the current selection. */
export interface BubbleMenuState {
  x: number;
  y: number;
  show: boolean;
  /** Id of the editor this menu belongs to (scopes it to one editor). */
  editorId: string;
}

/** Slash command menu triggered by typing `/`. */
export interface SlashMenuState {
  x: number;
  y: number;
  show: boolean;
  pos: number;
  query: string;
  /** Id of the editor this menu belongs to (scopes it to one editor). */
  editorId: string;
}

/**
 * UI state for the AI assistant, search dialog, and related panels. Previously
 * this lived as local `useState` in `App.tsx`; lifting it into a store lets the
 * `ai` plugin host render the panels while the editor tree (search highlighting,
 * slash menu) reads the same state without prop-drilling.
 */
interface AIUIState {
  // Chat
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  chatAttachedImages: string[];
  setChatAttachedImages: (v: string[]) => void;
  aiSettingsTab: AISettingsTab;
  setAiSettingsTab: (v: AISettingsTab) => void;

  // Search
  findText: string;
  setFindText: (v: string) => void;
  replaceText: string;
  setReplaceText: (v: string) => void;
  searchIndex: number;
  setSearchIndex: (v: number) => void;
  matchCount: number;
  setMatchCount: (v: number) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (v: number) => void;
  isCaseSensitive: boolean;
  setIsCaseSensitive: (v: boolean) => void;
  isWholeWord: boolean;
  setIsWholeWord: (v: boolean) => void;
  isSemantic: boolean;
  setIsSemantic: (v: boolean) => void;
  semanticResults: SemanticResult[];
  setSemanticResults: (v: SemanticResult[]) => void;

  // Misc panels
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
  showFileActions: boolean;
  setShowFileActions: (v: boolean) => void;

  // Editor menu UI — lifted from ProseMirrorEditor so the `editorUI` plugin can
  // drive it through ProseMirror plugins and the menu components can render it.
  sideMenu: SideMenuState;
  setSideMenu: (v: Updatable<SideMenuState>) => void;
  contextMenu: ContextMenuState;
  setContextMenu: (v: Updatable<ContextMenuState>) => void;
  bubbleMenu: BubbleMenuState;
  setBubbleMenu: (v: Updatable<BubbleMenuState>) => void;
  showAiPopover: boolean;
  setShowAiPopover: (v: boolean) => void;
  activeFormats: Record<string, boolean>;
  setActiveFormats: (v: Record<string, boolean>) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  slashMenu: SlashMenuState;
  setSlashMenu: (v: Updatable<SlashMenuState>) => void;

  // Live editor-shell flags mirrored from ProseMirrorEditor props; read by the
  // `editorUI` plugin's typewriter/focus-mode ProseMirror plugins.
  isTypewriter: boolean;
  setIsTypewriter: (v: boolean) => void;
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;

  // Inline AI draft executor. The streaming implementation lives in the
  // `useAIStreaming` hook (coupled to the editor's draft state) and is
  // published here so the `ai` plugin's keymap can invoke it without a module
  // global. `null` when no editor is mounted.
  aiActionHandler: ((action: AIAssistantAction) => void) | null;
  setAiActionHandler: (
    handler: ((action: AIAssistantAction) => void) | null,
  ) => void;
}

export const useAIUIStore = create<AIUIState>((set) => ({
  aiPrompt: "",
  setAiPrompt: (v) => set({ aiPrompt: v }),
  chatAttachedImages: [],
  setChatAttachedImages: (v) => set({ chatAttachedImages: v }),
  aiSettingsTab: "chat",
  setAiSettingsTab: (v) => set({ aiSettingsTab: v }),

  findText: "",
  setFindText: (v) => set({ findText: v }),
  replaceText: "",
  setReplaceText: (v) => set({ replaceText: v }),
  searchIndex: -1,
  setSearchIndex: (v) => set({ searchIndex: v }),
  matchCount: 0,
  setMatchCount: (v) => set({ matchCount: v }),
  currentMatchIndex: 0,
  setCurrentMatchIndex: (v) => set({ currentMatchIndex: v }),
  isCaseSensitive: false,
  setIsCaseSensitive: (v) => set({ isCaseSensitive: v }),
  isWholeWord: false,
  setIsWholeWord: (v) => set({ isWholeWord: v }),
  isSemantic: false,
  setIsSemantic: (v) => set({ isSemantic: v }),
  semanticResults: [],
  setSemanticResults: (v) => set({ semanticResults: v }),

  showShortcuts: false,
  setShowShortcuts: (v) => set({ showShortcuts: v }),
  showFileActions: false,
  setShowFileActions: (v) => set({ showFileActions: v }),

  sideMenu: { y: 0, show: false, pos: 0, editorId: "" },
  setSideMenu: (v) =>
    set((s) => ({ sideMenu: typeof v === "function" ? v(s.sideMenu) : v })),
  contextMenu: { x: 0, y: 0, show: false, pos: 0, editorId: "" },
  setContextMenu: (v) =>
    set((s) => ({
      contextMenu: typeof v === "function" ? v(s.contextMenu) : v,
    })),
  bubbleMenu: { x: 0, y: 0, show: false, editorId: "" },
  setBubbleMenu: (v) =>
    set((s) => ({
      bubbleMenu: typeof v === "function" ? v(s.bubbleMenu) : v,
    })),
  showAiPopover: false,
  setShowAiPopover: (v) => set({ showAiPopover: v }),
  activeFormats: {},
  setActiveFormats: (v) => set({ activeFormats: v }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  slashMenu: { x: 0, y: 0, show: false, pos: 0, query: "", editorId: "" },
  setSlashMenu: (v) =>
    set((s) => ({ slashMenu: typeof v === "function" ? v(s.slashMenu) : v })),

  isTypewriter: false,
  setIsTypewriter: (v) => set({ isTypewriter: v }),
  isFocusMode: false,
  setIsFocusMode: (v) => set({ isFocusMode: v }),

  aiActionHandler: null,
  setAiActionHandler: (handler) => set({ aiActionHandler: handler }),
}));
