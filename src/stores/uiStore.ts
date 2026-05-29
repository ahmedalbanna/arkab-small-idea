import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isSuperZen: boolean;
  showAIAssistant: boolean;
  showSearch: boolean;
  showMobileMenu: boolean;
  showSettings: boolean;
  showAiSettings: boolean;
  showSemanticFolders: boolean;
  showPages: boolean;
  showImportModal: boolean;
  showQuickCommands: boolean;
  direction: 'ltr' | 'rtl';
  isIndexing: boolean;
  indexedChunks: number;
  indexedEpisodes: number;
  isAutoSaving: boolean;
  showTTS: boolean;
  showTOC: boolean;
  ttsRate: number;
  ttsHighlightRange: { from: number; to: number } | null;
  
  toggleSuperZen: () => void;
  toggleAIAssistant: () => void;
  toggleTOC: () => void;
  setSuperZen: (show: boolean | ((prev: boolean) => boolean)) => void;
  setAIAssistant: (show: boolean | ((prev: boolean) => boolean)) => void;
  setSearch: (show: boolean | ((prev: boolean) => boolean)) => void;
  setMobileMenu: (show: boolean | ((prev: boolean) => boolean)) => void;
  setSettings: (show: boolean | ((prev: boolean) => boolean)) => void;
  setAiSettings: (show: boolean | ((prev: boolean) => boolean)) => void;
  setSemanticFolders: (show: boolean | ((prev: boolean) => boolean)) => void;
  setPagesMenu: (show: boolean | ((prev: boolean) => boolean)) => void;
  setImportModal: (show: boolean | ((prev: boolean) => boolean)) => void;
  setQuickCommands: (show: boolean | ((prev: boolean) => boolean)) => void;
  setDirection: (direction: 'ltr' | 'rtl' | ((prev: 'ltr' | 'rtl') => 'ltr' | 'rtl')) => void;
  setIndexing: (indexing: boolean) => void;
  setIndexedCounts: (chunks: number, episodes: number) => void;
  setAutoSaving: (isAutoSaving: boolean) => void;
  setTTS: (show: boolean | ((prev: boolean) => boolean)) => void;
  setTOC: (show: boolean | ((prev: boolean) => boolean)) => void;
  setTTSRate: (rate: number | ((prev: number) => number)) => void;
  setTTSHighlightRange: (range: { from: number; to: number } | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSuperZen: false,
      showAIAssistant: false,
      showSearch: false,
      showMobileMenu: false,
      showSettings: false,
      showAiSettings: false,
      showSemanticFolders: false,
      showPages: false,
      showImportModal: false,
      showQuickCommands: true,
      direction: 'ltr',
      isIndexing: false,
      indexedChunks: 0,
      indexedEpisodes: 0,
      isAutoSaving: false,
      showTTS: false,
      showTOC: false,
      ttsRate: 1,
      ttsHighlightRange: null,

      toggleSuperZen: () => set((state) => ({ isSuperZen: !state.isSuperZen })),
      toggleAIAssistant: () => set((state) => ({ showAIAssistant: !state.showAIAssistant })),
      toggleTOC: () => set((state) => ({ showTOC: !state.showTOC })),
      setSuperZen: (isSuperZen) => set((state) => ({ 
        isSuperZen: typeof isSuperZen === 'function' ? isSuperZen(state.isSuperZen) : isSuperZen 
      })),
      setAIAssistant: (showAIAssistant) => set((state) => ({ 
        showAIAssistant: typeof showAIAssistant === 'function' ? showAIAssistant(state.showAIAssistant) : showAIAssistant 
      })),
      setSearch: (showSearch) => set((state) => ({ 
        showSearch: typeof showSearch === 'function' ? showSearch(state.showSearch) : showSearch 
      })),
      setMobileMenu: (showMobileMenu) => set((state) => ({ 
        showMobileMenu: typeof showMobileMenu === 'function' ? showMobileMenu(state.showMobileMenu) : showMobileMenu 
      })),
      setSettings: (showSettings) => set((state) => ({ 
        showSettings: typeof showSettings === 'function' ? showSettings(state.showSettings) : showSettings 
      })),
      setAiSettings: (showAiSettings) => set((state) => ({ 
        showAiSettings: typeof showAiSettings === 'function' ? showAiSettings(state.showAiSettings) : showAiSettings 
      })),
      setSemanticFolders: (showSemanticFolders) => set((state) => ({ 
        showSemanticFolders: typeof showSemanticFolders === 'function' ? showSemanticFolders(state.showSemanticFolders) : showSemanticFolders 
      })),
      setPagesMenu: (showPages) => set((state) => ({ 
        showPages: typeof showPages === 'function' ? showPages(state.showPages) : showPages 
      })),
      setImportModal: (showImportModal) => set((state) => ({ 
        showImportModal: typeof showImportModal === 'function' ? showImportModal(state.showImportModal) : showImportModal 
      })),
      setQuickCommands: (showQuickCommands) => set((state) => ({ 
        showQuickCommands: typeof showQuickCommands === 'function' ? showQuickCommands(state.showQuickCommands) : showQuickCommands 
      })),
      setDirection: (direction) => set((state) => ({ 
        direction: typeof direction === 'function' ? direction(state.direction) : direction 
      })),
      setIndexing: (isIndexing) => set({ isIndexing }),
      setIndexedCounts: (indexedChunks, indexedEpisodes) => set({ indexedChunks, indexedEpisodes }),
      setAutoSaving: (isAutoSaving: boolean) => set({ isAutoSaving }),
      setTTS: (showTTS) => set((state) => ({ 
        showTTS: typeof showTTS === 'function' ? showTTS(state.showTTS) : showTTS 
      })),
      setTOC: (showTOC) => set((state) => ({ 
        showTOC: typeof showTOC === 'function' ? showTOC(state.showTOC) : showTOC 
      })),
      setTTSRate: (ttsRate) => set((state) => ({ 
        ttsRate: typeof ttsRate === 'function' ? ttsRate(state.ttsRate) : ttsRate 
      })),
      setTTSHighlightRange: (ttsHighlightRange) => set({ ttsHighlightRange }),
    }),
    {
      name: 'ink-quill-ui-storage',
    }
  )
);
