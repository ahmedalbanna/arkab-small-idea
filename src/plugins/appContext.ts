import { createContext, useContext } from "react";
import type { EditorRef } from "../components/ProseMirrorEditor";

/**
 * A small, stable facade over the app shell that UI plugins (overlays such as
 * the table of contents or status bar) can use to reach the live editors
 * without depending on `App.tsx` internals.
 */
export interface AppApi {
  /** Editor ref for a page, or the focused page's ref when omitted. */
  getEditorRef(pageId?: string): EditorRef | null;
  /** Id of the currently focused page, or `null`. */
  getActivePageId(): string | null;
}

export const AppApiContext = createContext<AppApi | null>(null);

export function useAppApi(): AppApi {
  const api = useContext(AppApiContext);
  if (!api) {
    throw new Error("useAppApi must be used within an <AppApiContext.Provider>");
  }
  return api;
}
