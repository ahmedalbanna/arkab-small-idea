/**
 * A single, typed command language for the editor — now part of the headless
 * core (`@core/commands`).
 *
 * Every imperative operation the editor exposes is expressed as a command so
 * that consumers no longer depend on the 24-method `EditorRef` handle — they
 * dispatch intents to the bus instead. This decouples callers (toolbars, AI
 * sidebar, TTS, import) from the concrete editor instance and gives us a single
 * point through which commands can be recorded, intercepted and replayed.
 *
 * Commands are split into two shapes:
 * - **Actions** (mutating): `focus`, `format`, `insert*`, `*Markdown`, `stream*`,
 *   `setTTSHighlight`, `scroll*`. These are dispatched and may be recorded in
 *   the undo history.
 * - **Queries** (read-only): `get*`. These return a value synchronously and are
 *   never recorded.
 */
export type EditorCommandAction =
  // --- Actions (mutating) ---
  | { type: "focus" }
  | { type: "format"; format: string }
  | { type: "insertText"; before: string; after?: string }
  | { type: "insertImage"; src: string; alt?: string; title?: string }
  | {
      type: "insertGallery";
      srcs: string[];
    }
  | { type: "appendMarkdown"; markdown: string }
  | { type: "replaceSelectionWithMarkdown"; markdown: string }
  | { type: "setMarkdown"; content: string }
  | { type: "setTTSHighlight"; range: { from: number; to: number } | null }
  | { type: "scrollToText"; text: string }
  | { type: "scrollToPos"; pos: number }
  | { type: "streamMarkdown"; content: string; isNew?: boolean }
  // --- Queries (read-only) ---
  | { type: "getSelectedText" }
  | { type: "getHtml" }
  | { type: "getDoc" }
  | { type: "getTextWithPositions" }
  | { type: "getHeadings" }
  | { type: "getCursorContext" };

/** Result of executing a command on the live editor. */
export interface EditorCommandResult {
  /** Return value for query commands. */
  value?: unknown;
  /**
   * A command that undoes this one. When present, the bus records the pair in
   * its history so `undo()`/`redo()` can replay it. Absent for non-undoable
   * commands (e.g. `format`, `focus`, `scroll`).
   */
  inverse?: EditorCommandAction | null;
}

/**
 * The live executor registered by the editor. It owns the real ProseMirror
 * operations and decides, per command, what (if anything) reverses it.
 *
 * In the headless core the executor is built once and operates on the core's
 * `EditorState` (no `EditorView`), keeping the bus fully environment-agnostic.
 */
export interface EditorCommandExecutor {
  run(action: EditorCommandAction): EditorCommandResult;
}

interface HistoryEntry {
  action: EditorCommandAction;
  inverse: EditorCommandAction;
}

/**
 * Dispatches editor commands and records them so they can be undone/redone.
 *
 * Routing every mutation through `dispatch` (instead of calling editor methods
 * directly) is what makes undo/redo of commands possible: the executor returns
 * an `inverse` command for each mutating action, and the bus keeps a
 * last-in-first-out history of `{ action, inverse }` pairs. `undo()` runs the
 * inverse and `redo()` re-runs the original.
 *
 * The bus is transport-agnostic — it only knows about `EditorCommandExecutor`,
 * so it can be unit-tested with a fake executor and reused for any editor.
 */
export class EditorCommandBus {
  private executor: EditorCommandExecutor | null = null;
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  /** Register (or clear with `null`) the live editor executor. */
  setExecutor(executor: EditorCommandExecutor | null): void {
    this.executor = executor;
  }

  /** Execute a mutating command. No-op until an executor is registered. */
  dispatch(action: EditorCommandAction): void {
    if (!this.executor) return;
    const { inverse } = this.executor.run(action);
    if (inverse) {
      this.past.push({ action, inverse });
      this.future = [];
    }
  }

  /** Execute a query command and return its value. `undefined` without an executor. */
  query<T = unknown>(action: EditorCommandAction): T | undefined {
    if (!this.executor) return undefined;
    return this.executor.run(action).value as T | undefined;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Revert the most recent undoable command by running its inverse. */
  undo(): void {
    const entry = this.past.pop();
    if (!entry || !this.executor) return;
    this.executor.run(entry.inverse);
    this.future.push(entry);
  }

  /** Re-apply the most recently undone command. */
  redo(): void {
    const entry = this.future.pop();
    if (!entry || !this.executor) return;
    this.executor.run(entry.action);
    this.past.push(entry);
  }

  /** Drop all recorded history (e.g. on document reset). */
  clearHistory(): void {
    this.past = [];
    this.future = [];
  }
}

/**
 * Stable default bus used when no `EditorCommandBusProvider` is present (e.g.
 * the editor mounted in isolation or in tests). Mirrors the no-op fallback used
 * by the registry context so the editor never needs a provider to function.
 */
export const defaultEditorCommandBus = new EditorCommandBus();
