import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { snapshotService, type Snapshot } from "../services/snapshotService";
import type { SemanticCluster } from "../services/semanticService";
import { idbStorage } from "../lib/idbStorage";

export interface Page {
  id: string;
  title: string;
  content: string;
  wordGoal: number;
  fontSize?: number;
  lineHeight?: number;
  snapshots?: Snapshot[];
  cursor?: { from: number; to: number };
  updatedAt: number;
}

interface EditorState {
  pages: Page[];
  activePageIds: string[]; // Pages currently visible/open horizontally
  activeFocusedPageId: string | null;
  semanticClusters: SemanticCluster[];

  setPageContent: (id: string, content: string) => void;
  setPageSettings: (
    id: string,
    settings: Partial<Pick<Page, "wordGoal" | "fontSize" | "lineHeight">>,
  ) => void;
  addPage: (title?: string, content?: string) => void;
  removePage: (id: string) => void;
  togglePageOpen: (id: string) => void;
  setActiveFocusedPageId: (id: string | null) => void;
  reorderPages: (pageIds: string[]) => void;
  setPageCursor: (id: string, cursor: { from: number; to: number } | null) => void;
  setSemanticClusters: (clusters: SemanticCluster[]) => void;
  addSnapshot: (pageId: string, content: string, userNote?: string) => Promise<void>;
  loadSnapshots: (pageId: string) => Promise<void>;
  wipePage: (id: string) => void;
  clearSnapshots: (pageId: string) => Promise<void>;
  setSnapshots: (
    pageId: string,
    snapshots: Snapshot[] | ((prev: Snapshot[]) => Snapshot[]),
  ) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      pages: [
        {
          id: "default",
          title: "Chapter 1",
          content: "# Welcome to Ink & Quill\n\nStart writing...",
          wordGoal: 0,
          fontSize: undefined as number | undefined,
          lineHeight: undefined as number | undefined,
          snapshots: [] as Snapshot[],
          updatedAt: Date.now(),
        },
      ],
      activePageIds: ["default"],
      activeFocusedPageId: "default",
      semanticClusters: [] as SemanticCluster[],

      setPageContent: (id, content) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id ? { ...p, content, updatedAt: Date.now() } : p,
          ),
        })),
      setPageSettings: (id, settings) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, ...settings } : p)),
        })),
      addPage: (title = "New Page", content = "") =>
        set((state) => {
          let id: string;
          do {
            id = Math.random().toString(36).substring(2, 9);
          } while (id === "default" || state.pages.some((p) => p.id === id));
          const newPage: Page = {
            id,
            title,
            content,
            wordGoal: 0,
            fontSize: undefined,
            lineHeight: undefined,
            snapshots: [],
            updatedAt: Date.now(),
          };
          return {
            pages: [...state.pages, newPage],
            activePageIds: [...state.activePageIds, id],
            activeFocusedPageId: id,
          };
        }),
      removePage: (id) =>
        set((state) => {
          const remainingPages = state.pages.filter((p) => p.id !== id);
          const remainingOpenPages = state.activePageIds.filter((pid) => pid !== id);
          return {
            pages: remainingPages,
            activePageIds: remainingOpenPages,
            activeFocusedPageId:
              state.activeFocusedPageId === id
                ? remainingOpenPages[0] ||
                  // If no open pages remain, focus the last remaining page (even if closed)
                  remainingPages[remainingPages.length - 1]?.id ||
                  null
                : state.activeFocusedPageId,
          };
        }),
      togglePageOpen: (id) =>
        set((state) => {
          const isOpen = state.activePageIds.includes(id);
          const nextActivePageIds = isOpen
            ? state.activePageIds.filter((pid) => pid !== id)
            : [...state.activePageIds, id];

          return {
            activePageIds: nextActivePageIds,
            activeFocusedPageId: isOpen
              ? state.activeFocusedPageId === id
                ? nextActivePageIds[nextActivePageIds.length - 1] || null
                : state.activeFocusedPageId
              : id,
          };
        }),
      setActiveFocusedPageId: (id) => set({ activeFocusedPageId: id }),
      reorderPages: (pageIds) =>
        set((state) => {
          const pageMap = new Map(state.pages.map((p) => [p.id, p]));
          const reordered = pageIds.map((id) => pageMap.get(id)!).filter(Boolean);
          // Include any pages not in the id list (they keep their relative order at the end)
          const remaining = state.pages.filter((p) => !pageIds.includes(p.id));
          return { pages: [...reordered, ...remaining] };
        }),
      setPageCursor: (id, cursor) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, cursor: cursor || undefined } : p)),
        })),
      setSemanticClusters: (semanticClusters) => set({ semanticClusters }),
      addSnapshot: async (pageId, content, userNote) => {
        const snapshot = await snapshotService.saveSnapshot(pageId, content, userNote);
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? { ...p, snapshots: [snapshot, ...(p.snapshots || [])].slice(0, 50) }
              : p,
          ),
        }));
      },
      loadSnapshots: async (pageId) => {
        const snapshots = await snapshotService.getSnapshots(pageId);
        set((state) => ({
          pages: state.pages.map((p) => (p.id === pageId ? { ...p, snapshots } : p)),
        }));
      },
      wipePage: (id) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, content: "" } : p)),
        })),
      clearSnapshots: async (pageId) => {
        await snapshotService.clearAllSnapshots(pageId);
        set((state) => ({
          pages: state.pages.map((p) => (p.id === pageId ? { ...p, snapshots: [] } : p)),
        }));
      },
      setSnapshots: (pageId, snapshots) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? {
                  ...p,
                  snapshots: typeof snapshots === "function" ? snapshots(p.snapshots) : snapshots,
                }
              : p,
          ),
        })),
    }),
    {
      name: "ink-quill-editor-storage-v2",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        pages: state.pages.map(({ snapshots, ...p }) => p),
        activePageIds: state.activePageIds,
        activeFocusedPageId: state.activeFocusedPageId,
      }),
    },
  ),
);
