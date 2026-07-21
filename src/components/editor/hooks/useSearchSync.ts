import { useEffect, type RefObject } from "react";
import type { EditorView } from "prosemirror-view";
import { cn } from "../../../lib/utils";
import type { LoadedPlugins } from "../../../plugins";

interface SearchSyncParams {
  viewRef: RefObject<EditorView | null>;
  editorRef: RefObject<HTMLDivElement | null>;
  searchQuery: string;
  searchOptions: {
    isCaseSensitive: boolean;
    isWholeWord: boolean;
    isSemantic: boolean;
    searchIndex: number;
    currentMatchIndex: number;
    embeddingOptions?: { provider?: string; apiKey?: string; model?: string };
  };
  isTypewriter: boolean;
  placeholder?: string;
  direction?: "ltr" | "rtl";
  loaded: LoadedPlugins | null;
}

/**
 * Pushes external search / typewriter state into the live editor.
 *
 * Dispatches a no-op transaction carrying the search metadata so the search
 * plugin recomputes its decorations, and updates the editor DOM attributes
 * (placeholder, direction, typewriter class). When a match index is active it
 * scrolls the match into view.
 */
export function useSearchSync({
  viewRef,
  editorRef,
  searchQuery,
  searchOptions,
  isTypewriter,
  placeholder,
  direction,
  loaded,
}: SearchSyncParams): void {
  useEffect(() => {
    if (viewRef.current) {
      const tr = viewRef.current.state.tr;
      tr.setMeta("searchQuery", searchQuery);
      tr.setMeta("searchOptions", searchOptions);

      viewRef.current.dispatch(tr);

      viewRef.current.setProps({
        attributes: {
          class: cn(
            "ProseMirror",
            isTypewriter && "typewriter-mode",
          ),
          "data-placeholder": placeholder || "Start writing...",
          dir: direction,
        },
      });

      // If we have a current match, try to scroll to it
      // Note: mapping searchIndex (string index) to PM pos is approximate
      // but for basic markdown it's usually 1:1 or very close.
      if (searchQuery && searchOptions.searchIndex !== -1) {
        // We'll try to find the PM position that matches the searchIndex
        // For simplicity, we'll just scroll the view if we can find the decoration pos
        // Or just use coordsAtPos if we assume 1:1 mapping for now.
        try {
          const pos = searchOptions.searchIndex; // Naive approximation
          const coords = viewRef.current.coordsAtPos(pos);
          if (coords) {
            const editorRect = editorRef.current?.getBoundingClientRect();
            const scrollContainer = editorRef.current?.parentElement;
            if (scrollContainer && editorRect) {
              const relativeTop =
                coords.top - editorRect.top + scrollContainer.scrollTop;
              scrollContainer.scrollTo({
                top: relativeTop - scrollContainer.clientHeight / 3,
                behavior: "smooth",
              });
            }
          }
        } catch (e) {}
      }
    }
  }, [
    searchQuery,
    searchOptions.searchIndex,
    searchOptions.currentMatchIndex,
    searchOptions.isCaseSensitive,
    searchOptions.isWholeWord,
    direction,
    isTypewriter,
    placeholder,
    loaded,
    viewRef,
    editorRef,
  ]);
}
