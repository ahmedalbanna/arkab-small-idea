import type { MutableRefObject } from "react";
import type { EditorRef } from "../components/ProseMirrorEditor";
import type { AppStores } from "./types";
import { useAppApi } from "./appContext";

/**
 * Decouples editor access from React context so that module-level handlers
 * (and eventually plugin code) can reach the live `EditorRef` for any page
 * without prop-drilling `editorRefs` through the component tree.
 *
 * Two access patterns:
 * 1. **Module-level** — `setEditorRefs` / `getEditorRef` for non-React code
 *    (e.g. `handlers.ts`). Stores are injected via `setEditorAccessStores`.
 * 2. **React context** — `useEditorRef()` hook for components within a
 *    `PluginProvider` (uses `useAppApi` from `appContext.tsx`).
 *
 * In the future the module-level global should be replaced entirely by the
 * context-based pattern, but it is kept for now to support legacy callers
 * that cannot use React hooks (plain functions, ProseMirror plugins, etc.).
 */

// ── Module-level global (legacy) ───────────────────────────────────────

let editorRefs: MutableRefObject<Record<string, EditorRef | null>> | null = null;
let _stores: AppStores | null = null;

/** Inject store access (called once from plugin init or App.tsx). */
export function setEditorAccessStores(stores: AppStores): void {
  _stores = stores;
}

/**
 * Register the editor refs map (called once from App.tsx).
 * Consumers should prefer `useEditorRef()` when inside React context.
 */
export function setEditorRefs(ref: MutableRefObject<Record<string, EditorRef | null>>) {
  editorRefs = ref;
}

/**
 * Look up the editor ref for a given page (or the focused page when omitted).
 * Falls back to the module-level global when context is unavailable.
 */
export function getEditorRef(pageId?: string): EditorRef | null {
  if (!editorRefs) return null;
  const id = pageId ?? _stores?.editor.getState().activeFocusedPageId ?? null;
  return id ? (editorRefs.current[id] ?? null) : null;
}

// ── React context (recommended) ────────────────────────────────────────

/**
 * React hook that provides editor ref access from `AppApiContext`.
 * Falls back to the module-level global when rendered outside a
 * `PluginProvider` (e.g. during tests or legacy components).
 */
export function useEditorRef(pageId?: string): EditorRef | null {
  try {
    const api = useAppApi();
    return api.getEditorRef(pageId);
  } catch {
    // Not inside PluginProvider — fall back to module-level global
    return getEditorRef(pageId);
  }
}
