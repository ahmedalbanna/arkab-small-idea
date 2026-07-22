import type { MutableRefObject } from "react";
import type { EditorRef } from "../components/ProseMirrorEditor";
import { useEditorStore } from "../stores/editorStore";

/**
 * Decouples editor access from React context so that module-level handlers
 * (and eventually plugin code) can reach the live `EditorRef` for any page
 * without prop-drilling `editorRefs` through the component tree.
 *
 * `App.tsx` registers its ref map once via `setEditorRefs`. Lookups read the
 * focused page id live from the editor store, so they never go stale.
 */
let editorRefs: MutableRefObject<Record<string, EditorRef | null>> | null = null;

export function setEditorRefs(ref: MutableRefObject<Record<string, EditorRef | null>>) {
  editorRefs = ref;
}

export function getEditorRef(pageId?: string): EditorRef | null {
  if (!editorRefs) return null;
  const id = pageId ?? useEditorStore.getState().activeFocusedPageId;
  return id ? (editorRefs.current[id] ?? null) : null;
}
