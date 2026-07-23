import { EditorCommandActionSchema, formatZodIssues } from "./actionSchema";
import { CommandAuditTrail, type AuditTrailConfig, type CommandSource } from "./auditTrail";
export type { CommandSource, AuditTrailConfig } from "./auditTrail";

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
 * In the Bus-Centric architecture, the bus is the single entry-point for all
 * user-invoked (named) commands. Low-level ProseMirror mechanics (typing,
 * backspace, input rules, drop/paste) dispatch through the view directly and
 * reach `CoreEditor.apply` via `dispatchTransaction` — both paths converge
 * on `core.apply` as the single source of truth.
 *
 * Undo/redo are unified through ProseMirror's native history plugin. The bus
 * itself no longer maintains a dual undo stack (`past`/`future`). The `undo`
 * and `redo` action types delegate to `prosemirror-history` through the
 * executor, so the keyboard shortcut (Mod-z → PM keymap → PM history) and
 * the command-palette "Undo" (bus → executor → PM history) route to the
 * same queue.
 *
 * Commands are split into two shapes:
 * - **Actions** (mutating): `focus`, `format`, `insert*`, `*Markdown`, `stream*`,
 *   `setTTSHighlight`, `scroll*`, `undo`, `redo`. These are dispatched.
 * - **Queries** (read-only): `get*`. These return a value synchronously.
 */
export type EditorCommandAction =
  // --- Actions (mutating) ---
  | { type: "focus" }
  | { type: "format"; format: string; attrs?: Record<string, any> }
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
  // --- Undo / Redo (delegated to PM native history) ---
  | { type: "undo" }
  | { type: "redo" }
  // --- Selection & Range (AI streaming, editors) ---
  | { type: "setSelection"; from: number; to: number }
  | { type: "deleteRange"; from: number; to: number }
  | { type: "insertNodeAt"; nodeName: string; attrs?: Record<string, any>; pos?: number }
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
   * A command that undoes this one. Kept for backward compatibility (some
   * callers still inspect it), but the bus no longer consumes it for its own
   * undo/redo stack — all undo flows through ProseMirror's native history.
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

/**
 * Dispatches editor commands and routes them to the executor.
 *
 * In the Bus-Centric architecture the bus is transport-agnostic — it only
 * knows about `EditorCommandExecutor`, so it can be unit-tested with a fake
 * executor and reused for any editor. Undo/redo are handled through dedicated
 * action types routed to ProseMirror's native history (see `executor.ts`).
 */
export class EditorCommandBus {
  private executor: EditorCommandExecutor | null = null;
  private auditTrail: CommandAuditTrail | null = null;

  /**
   * Create a command bus with optional audit trail.
   *
   * @param config - If `audit.enabled` is not explicitly `false`, an audit
   *   trail is created (default: enabled). Pass `{ audit: { enabled: false } }`
   *   to disable it entirely.
   */
  constructor(config?: { audit?: AuditTrailConfig }) {
    // Create the audit trail unless explicitly disabled.
    if (config?.audit?.enabled !== false) {
      this.auditTrail = new CommandAuditTrail(config?.audit);
    }
  }

  /** Register (or clear with `null`) the live editor executor. */
  setExecutor(executor: EditorCommandExecutor | null): void {
    this.executor = executor;
  }

  /**
   * Execute a mutating command. No-op until an executor is registered.
   *
   * In dev/test mode the action is validated against the Zod schema before
   * reaching the executor. Invalid actions are logged (not thrown) so the
   * editor remains usable during development; set `strict: true` to skip
   * them entirely. In production all validation is skipped for performance.
   *
   * Each successfully-dispatched action is recorded in the audit trail (when
   * enabled) with its source, timing, and success/failure status.
   */
  dispatch(
    action: EditorCommandAction,
    options?: { strict?: boolean; source?: CommandSource },
  ): void {
    if (!this.executor) return;

    // Runtime validation – dev/test only (TypeScript catches most errors in
    // production builds, and skipping the check avoids any perf impact).
    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
      const result = EditorCommandActionSchema.safeParse(action);
      if (!result.success) {
        const issues = formatZodIssues(result.error.issues);
        console.warn(
          `[commandBus] Invalid action (${(action as Record<string, unknown>).type as string}):\n` +
            issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`).join("\n"),
          action,
        );
        // In strict mode, skip invalid actions instead of forwarding them.
        if (options?.strict) return;
      }
    }

    // Audit trail — record the action with timing.
    const start = performance.now();
    const source = options?.source ?? "system";
    try {
      this.executor.run(action);
      this.auditTrail?.record({
        action,
        source,
        success: true,
        duration: performance.now() - start,
      });
    } catch (err) {
      this.auditTrail?.record({
        action,
        source,
        success: false,
        duration: performance.now() - start,
      });
      throw err;
    }
  }

  /**
   * Execute a query command and return its value. `undefined` without an executor.
   * Same dev/test validation as `dispatch` (non-strict – only logs).
   */
  query<T = unknown>(action: EditorCommandAction): T | undefined {
    if (!this.executor) return undefined;

    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
      const result = EditorCommandActionSchema.safeParse(action);
      if (!result.success) {
        const issues = formatZodIssues(result.error.issues);
        console.warn(
          `[commandBus] Invalid query (${(action as Record<string, unknown>).type as string}):\n` +
            issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`).join("\n"),
          action,
        );
      }
    }

    return this.executor.run(action).value as T | undefined;
  }

  /**
   * Return the most recent audit trail entries (primarily for debugging /
   * introspection). Returns an empty array when the trail is disabled or
   * there are no entries yet.
   */
  getAuditLog(count?: number) {
    return this.auditTrail?.getRecent(count) ?? [];
  }
}

/**
 * Stable default bus used when no `EditorCommandBusProvider` is present (e.g.
 * the editor mounted in isolation or in tests). Mirrors the no-op fallback used
 * by the registry context so the editor never needs a provider to function.
 */
export const defaultEditorCommandBus = new EditorCommandBus();
