import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";

/**
 * Public type surface for the headless core (`@core`).
 *
 * The core deliberately imports nothing from React, `prosemirror-view`, the
 * Zustand stores, or any DOM-rendering code. Everything environment-specific
 * (IndexedDB, the live editor view, key events) is injected through the
 * interfaces below or applied at the app boundary.
 */

/** A single document draft (autosave snapshot) for a page. */
export interface Draft {
  id?: string;
  pageId: string;
  /** Document content as markdown. */
  content: string;
  timestamp: number;
  wordCount?: number;
  userNote?: string;
}

/**
 * Persistence boundary for the headless core.
 *
 * The core never imports IndexedDB or any browser-only API directly — it talks
 * to this interface. A browser implementation (IndexedDB) is provided at the
 * app boundary; tests supply an in-memory implementation.
 *
 * `getItem`/`setItem`/`removeItem` cover generic key/value storage (settings,
 * caches); the draft helpers layer document-specific persistence on top.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;

  /** Persist a draft snapshot. Implementations assign `id` when missing. */
  saveDraft(draft: Draft): Promise<Draft>;
  /** List drafts for a page, newest first. */
  loadDrafts(pageId: string): Promise<Draft[]>;
  /** Delete a draft by id. */
  deleteDraft(id: string): Promise<void>;
}

/**
 * A keyboard shortcut registered with the core. `keys` uses the ProseMirror
 * keymap syntax (e.g. `"Mod-b"`, `"Shift-Mod-z"`). The core compiles registered
 * shortcuts into a ProseMirror keymap plugin; the actual DOM key listening
 * happens at the view boundary.
 */
export interface Shortcut {
  id?: string;
  keys: string;
  action: () => void;
}

/**
 * Configuration for creating a headless `CoreEditor`.
 *
 * The UI's plugin loader builds the schema and collects the headless
 * ProseMirror plugins, then hands them to the core. The core owns the
 * resulting `EditorState` and every mutation applied to it.
 */
export interface CoreConfig {
  /** Resolved ProseMirror schema, built headlessly by the plugin loader. */
  schema?: Schema;
  /** Headless ProseMirror plugins (history, keymap, input rules, features...). */
  prosePlugins?: Plugin[];
  /** Initial markdown content used to seed the document. */
  initialMarkdown?: string;
  /** Persistence adapter. When omitted, draft operations become no-ops. */
  storage?: StorageAdapter;
}

/** Marker helper: a no-op storage adapter used when none is configured. */
export const noopStorage: StorageAdapter = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  saveDraft: async (draft) => draft,
  loadDrafts: async () => [],
  deleteDraft: async () => {},
};
