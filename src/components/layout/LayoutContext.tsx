import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useUIStore } from "../../stores/uiStore";
import { Z_LAYERS } from "../../lib/zIndex";

/**
 * Identifiers for the side panels / overlays the layout system manages.
 * Each maps to a boolean in the existing uiStore.
 */
export type PanelId =
  | "ai"
  | "search"
  | "toc"
  | "workspace"
  | "semantic"
  | "tts";

/** Map each PanelId to its uiStore setter name and boolean getter. */
const PANEL_MAP: Record<
  PanelId,
  { get: (s: ReturnType<typeof useUIStore.getState>) => boolean; set: (show: boolean) => void }
> = {
  ai: {
    get: (s) => s.showAIAssistant,
    set: (show) => useUIStore.getState().setAIAssistant(show),
  },
  search: {
    get: (s) => s.showSearch,
    set: (show) => useUIStore.getState().setSearch(show),
  },
  toc: {
    get: (s) => s.showTOC,
    set: (show) => useUIStore.getState().setTOC(show),
  },
  workspace: {
    get: (s) => s.showPages,
    set: (show) => useUIStore.getState().setPagesMenu(show),
  },
  semantic: {
    get: (s) => s.showSemanticFolders,
    set: (show) => useUIStore.getState().setSemanticFolders(show),
  },
  tts: {
    get: (s) => s.showTTS,
    set: (show) => useUIStore.getState().setTTS(show),
  },
};

interface LayoutContextValue {
  /** The z-index scale constants (read-only reference). */
  zScale: typeof Z_LAYERS;

  /** Which side panel is currently active, or `null` if none. */
  activePanel: PanelId | null;

  /** Whether a modal overlay is currently open. */
  isModalOpen: boolean;

  /** Open a specific panel, closing any other panel first. */
  openPanel: (id: PanelId) => void;

  /** Close the currently active panel. */
  closePanel: () => void;

  /** Toggle a panel open/closed. */
  togglePanel: (id: PanelId) => void;

  /** Manually set the modal-open flag (used by modal components). */
  setModalOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function useLayoutContextValue(): LayoutContextValue {
  const store = useUIStore();

  const activePanel = useMemo<PanelId | null>(() => {
    for (const id of Object.keys(PANEL_MAP) as PanelId[]) {
      if (PANEL_MAP[id].get(store)) return id;
    }
    return null;
  }, [
    store.showAIAssistant,
    store.showSearch,
    store.showTOC,
    store.showPages,
    store.showSemanticFolders,
    store.showTTS,
  ]);

  const isModalOpen = store.showSettings || store.showImportModal;

  return useMemo(
    () => ({
      zScale: Z_LAYERS,
      activePanel,
      isModalOpen,

      openPanel: (id: PanelId) => {
        // Close any currently open panel first
        const current = (Object.keys(PANEL_MAP) as PanelId[]).find(
          (pid) => pid !== id && PANEL_MAP[pid].get(useUIStore.getState()),
        );
        if (current) {
          PANEL_MAP[current].set(false);
        }
        PANEL_MAP[id].set(true);
      },

      closePanel: () => {
        if (activePanel) {
          PANEL_MAP[activePanel].set(false);
        }
      },

      togglePanel: (id: PanelId) => {
        const isOpen = PANEL_MAP[id].get(useUIStore.getState());
        if (isOpen) {
          PANEL_MAP[id].set(false);
        } else {
          // Close any other open panel first
          for (const pid of Object.keys(PANEL_MAP) as PanelId[]) {
            if (pid !== id && PANEL_MAP[pid].get(useUIStore.getState())) {
              PANEL_MAP[pid].set(false);
            }
          }
          PANEL_MAP[id].set(true);
        }
      },

      setModalOpen: (open: boolean) => {
        // For now, modals manage their own state via uiStore.
        // This hook allows centralised coordination in future phases.
      },
    }),
    [activePanel, isModalOpen],
  );
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const value = useLayoutContextValue();
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

/**
 * Hook to access the layout context.
 * Throws if used outside `<LayoutProvider>`.
 */
export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used within a <LayoutProvider>");
  }
  return ctx;
}
