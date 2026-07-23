import { createContext, useContext, useMemo, type ReactNode } from "react";
import { EditorCommandBus, defaultEditorCommandBus } from "./editorCommandBus";

/**
 * Makes the active editor's `EditorCommandBus` available to the app shell and
 * plugin UI without threading an `EditorRef` through React. Consumers dispatch
 * commands (`useEditorCommandBus().dispatch(...)`) instead of holding a
 * reference to a specific editor instance.
 */
export const EditorCommandBusContext = createContext<EditorCommandBus | null>(null);

/** Provides a fresh command bus to the subtree (shared by the editor + consumers). */
export function EditorCommandBusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(
    () =>
      new EditorCommandBus({
        // Enable the audit trail in dev/test only; production skips it for
        // performance and memory reasons.
        audit: { enabled: import.meta.env.DEV || import.meta.env.MODE === "test" },
      }),
    [],
  );
  return (
    <EditorCommandBusContext.Provider value={bus}>{children}</EditorCommandBusContext.Provider>
  );
}

/**
 * Read the active editor's command bus. Falls back to the stable default bus
 * when rendered outside a provider, so the editor remains usable in isolation
 * (e.g. unit tests) without a provider. A fallback bus is never shared with
 * the app shell, which should always sit under a provider.
 */
export function useEditorCommandBus(): EditorCommandBus {
  return useContext(EditorCommandBusContext) ?? defaultEditorCommandBus;
}
