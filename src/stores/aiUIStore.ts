import { create } from "zustand";

export type AISettingsTab = "chat" | "actions" | "semantic" | "embeddings";

export interface SemanticResult {
  text: string;
  score: number;
  source?: string;
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
}));
