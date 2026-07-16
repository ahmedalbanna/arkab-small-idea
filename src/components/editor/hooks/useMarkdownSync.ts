import { useEffect, type MutableRefObject, type RefObject } from "react";
import type { EditorView } from "prosemirror-view";
import type { Node } from "prosemirror-model";
import { editorSerializer } from "./useMarkdownSerializer";

interface MarkdownSyncParams {
  viewRef: RefObject<EditorView | null>;
  value: string;
  parseMarkdownDoc: (md: string) => Node;
  /** Shared guard so programmatic updates (e.g. `setMarkdown`) don't echo back. */
  isUpdatingFromProps: MutableRefObject<boolean>;
}

/**
 * Keeps the editor document in sync with the external `value` prop.
 *
 * When `value` changes and differs from the serialized current doc, the editor
 * is replaced. The `isUpdatingFromProps` guard prevents the change listener in
 * `useEditorView` from echoing the programmatic update back out as an `onChange`.
 */
export function useMarkdownSync({
  viewRef,
  value,
  parseMarkdownDoc,
  isUpdatingFromProps,
}: MarkdownSyncParams): void {
  useEffect(() => {
    if (isUpdatingFromProps.current) {
      isUpdatingFromProps.current = false;
      return;
    }
    if (viewRef.current) {
      const currentMarkdown = editorSerializer.serialize(
        viewRef.current.state.doc,
      );
      if (value !== currentMarkdown) {
        const node = parseMarkdownDoc(value);
        if (node) {
          viewRef.current.dispatch(
            viewRef.current.state.tr
              .replaceWith(
                0,
                viewRef.current.state.doc.content.size,
                node.content,
              )
              .setMeta("addToHistory", false),
          );
        }
      }
    }
  }, [value, viewRef, parseMarkdownDoc, isUpdatingFromProps]);
}
