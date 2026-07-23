/**
 * Scoped Plugin API — Plugin Command & Toolbar Interface
 *
 * The `CommandAPI` is a narrow, stable window into the editor that is given to
 * command and toolbar-item callbacks. It exposes exactly what those callbacks
 * need — the command bus (for dispatching editor actions), store access (for
 * reading state), and the intent system (for signalling the app shell) — while
 * hiding everything else (schema, registration hooks, lifecycle).
 *
 * This prevents plugins from reaching into the full `PluginContext` (which
 * includes `registerProsePlugin`, `registerNodeView`, etc.) from inside a
 * `run()` or `onClick()` callback, which would be a lifecycle violation.
 *
 * ## Design
 * - `PluginContext` **extends** `CommandAPI` structurally (it has all the same
 *   properties), so existing sites that pass `PluginContext` to `.run()` or
 *   `.onClick()` continue to compile without changes.
 * - New code is encouraged to type its parameter as `CommandAPI` explicitly.
 */

import type { EditorCommandBus } from "./editorCommandBus";
import type { AppStores } from "./types";
import type { PluginIntent } from "./intents";

/**
 * The public, scoped API available to command and toolbar-item callbacks.
 *
 * - **`commandBus`** — dispatch editor mutations and run queries.
 * - **`stores`** — read-only access to Zustand stores for querying UI/editor
 *   state without importing stores directly.
 * - **`emitIntent`** — signal a UI intent (show palette, toggle search, etc.)
 *   without knowing which store owns the state.
 */
export interface CommandAPI {
  /** The editor's command bus — the single typed command language. */
  commandBus: EditorCommandBus;
  /** Read-only access to Zustand stores. */
  stores: AppStores;
  /** Emit a UI intent to the app shell. */
  emitIntent(intent: PluginIntent): void;
}
