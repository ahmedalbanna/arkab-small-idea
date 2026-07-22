import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "../lib/idbStorage";

interface UIState {
  showAIAssistant: boolean;
  showSearch: boolean;
  showMobileMenu: boolean;
  showAiSettings: boolean;
  showImportModal: boolean;
  showQuickCommands: boolean;
  direction: "ltr" | "rtl";
  isIndexing: boolean;
  indexedChunks: number;
  indexedEpisodes: number;
  isAutoSaving: boolean;
  showTTS: boolean;
  ttsRate: number;
  ttsHighlightRange: { from: number; to: number } | null;

  toggleAIAssistant: () => void;
  setAIAssistant: (show: boolean | ((prev: boolean) => boolean)) => void;
  setSearch: (show: boolean | ((prev: boolean) => boolean)) => void;
  setMobileMenu: (show: boolean | ((prev: boolean) => boolean)) => void;
  setAiSettings: (show: boolean | ((prev: boolean) => boolean)) => void;
  setImportModal: (show: boolean | ((prev: boolean) => boolean)) => void;
  setQuickCommands: (show: boolean | ((prev: boolean) => boolean)) => void;
  setDirection: (direction: "ltr" | "rtl" | ((prev: "ltr" | "rtl") => "ltr" | "rtl")) => void;
  setIndexing: (indexing: boolean) => void;
  setIndexedCounts: (chunks: number, episodes: number) => void;
  setAutoSaving: (isAutoSaving: boolean) => void;
  setTTS: (show: boolean | ((prev: boolean) => boolean)) => void;
  setTTSRate: (rate: number | ((prev: number) => number)) => void;
  setTTSHighlightRange: (range: { from: number; to: number } | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      showAIAssistant: false,
      showSearch: false,
      showMobileMenu: false,
      showAiSettings: false,
      showImportModal: false,
      showQuickCommands: true,
      direction: "ltr",
      isIndexing: false,
      indexedChunks: 0,
      indexedEpisodes: 0,
      isAutoSaving: false,
      showTTS: false,
      ttsRate: 1,
      ttsHighlightRange: null as { from: number; to: number } | null,

      toggleAIAssistant: () => set((state) => ({ showAIAssistant: !state.showAIAssistant })),
      setAIAssistant: (showAIAssistant) =>
        set((state) => ({
          showAIAssistant:
            typeof showAIAssistant === "function"
              ? showAIAssistant(state.showAIAssistant)
              : showAIAssistant,
        })),
      setSearch: (showSearch) =>
        set((state) => ({
          showSearch: typeof showSearch === "function" ? showSearch(state.showSearch) : showSearch,
        })),
      setMobileMenu: (showMobileMenu) =>
        set((state) => ({
          showMobileMenu:
            typeof showMobileMenu === "function"
              ? showMobileMenu(state.showMobileMenu)
              : showMobileMenu,
        })),
      setAiSettings: (showAiSettings) =>
        set((state) => ({
          showAiSettings:
            typeof showAiSettings === "function"
              ? showAiSettings(state.showAiSettings)
              : showAiSettings,
        })),
      setImportModal: (showImportModal) =>
        set((state) => ({
          showImportModal:
            typeof showImportModal === "function"
              ? showImportModal(state.showImportModal)
              : showImportModal,
        })),
      setQuickCommands: (showQuickCommands) =>
        set((state) => ({
          showQuickCommands:
            typeof showQuickCommands === "function"
              ? showQuickCommands(state.showQuickCommands)
              : showQuickCommands,
        })),
      setDirection: (direction) =>
        set((state) => ({
          direction: typeof direction === "function" ? direction(state.direction) : direction,
        })),
      setIndexing: (isIndexing) => set({ isIndexing }),
      setIndexedCounts: (indexedChunks, indexedEpisodes) => set({ indexedChunks, indexedEpisodes }),
      setAutoSaving: (isAutoSaving: boolean) => set({ isAutoSaving }),
      setTTS: (showTTS) =>
        set((state) => ({
          showTTS: typeof showTTS === "function" ? showTTS(state.showTTS) : showTTS,
        })),
      setTTSRate: (ttsRate) =>
        set((state) => ({
          ttsRate: typeof ttsRate === "function" ? ttsRate(state.ttsRate) : ttsRate,
        })),
      setTTSHighlightRange: (ttsHighlightRange) => set({ ttsHighlightRange }),
    }),
    {
      name: "ink-quill-ui-storage",
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
