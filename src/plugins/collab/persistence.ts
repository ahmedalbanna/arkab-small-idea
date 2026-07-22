/**
 * Yjs document persistence via y-indexeddb.
 *
 * Persists a Yjs document to IndexedDB so that edits survive page reloads
 * and are available offline.  On reconnection the persisted state is merged
 * with the server state via Yjs's built-in merge algorithm (the document
 * with the higher clock value wins for each item).
 *
 * Garbage collection removes unnecessary structs from the Yjs document to
 * keep memory and storage under control.
 */

import type * as Y from "yjs";

// We use a dynamic import for y-indexeddb in ensureLoaded() since IndexedDB
// may not be available in all environments (e.g., SSR, tests).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- needed for type extraction
type YDocPersistenceModule = typeof import("y-indexeddb");

let ydocPersistence: YDocPersistenceModule | null = null;

async function ensureLoaded(): Promise<YDocPersistenceModule> {
  if (!ydocPersistence) {
    ydocPersistence = await import("y-indexeddb");
  }
  return ydocPersistence;
}

export interface PersistenceOptions {
  /** The IndexedDB database name (per-doc prefix). */
  dbNamePrefix: string;
}

const defaultOptions: PersistenceOptions = {
  dbNamePrefix: "ink-quill-collab",
};

/**
 * Persistence handle bound to a single Y.Doc.
 * Call `destroy()` during plugin teardown to close the IndexedDB connection.
 */
export interface PersistenceHandle {
  /** Load the full document state from IndexedDB. */
  loadDocument: () => Promise<void>;
  /** Clear persisted state for this document. */
  clear: () => Promise<void>;
  /** Destroy the persistence handle and close its DB connection. */
  destroy: () => Promise<void>;
}

/**
 * Attach persistence to a Yjs document using y-indexeddb.
 *
 * The returned handle wraps an `IndexeddbPersistence` instance that
 * automatically syncs every Yjs update to IndexedDB.
 */
export async function attachPersistence(
  doc: Y.Doc,
  docId: string,
  options?: Partial<PersistenceOptions>,
): Promise<PersistenceHandle> {
  const opts = { ...defaultOptions, ...options };
  const { IndexeddbPersistence } = await ensureLoaded();
  const dbName = `${opts.dbNamePrefix}-${docId}`;

  // IndexeddbPersistence binds the Y.Doc to IndexedDB — every update is
  // automatically persisted.
  const persistenceProvider = new IndexeddbPersistence(dbName, doc);

  // Wait for the initial load from IndexedDB to complete.
  await persistenceProvider.whenSynced;

  const handle: PersistenceHandle = {
    loadDocument: async () => {
      // The document was already loaded in the constructor.  If we need to
      // force a reload we can destroy and re-create, but in practice the
      // auto-load is sufficient.
      await persistenceProvider.whenSynced;
    },

    clear: async () => {
      await persistenceProvider.clearData();
    },

    destroy: async () => {
      await persistenceProvider.destroy();
    },
  };

  return handle;
}

/**
 * Yjs garbage collection is automatic by default (`doc.gc = true`).
 * If you need to force a cleanup, set `doc.gc = true` before a transaction.
 *
 * This is a no-op that documents the availability of auto-GC.
 */
export function ensureGCEnabled(doc: Y.Doc): void {
  doc.gc = true;
}
