import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'ink-quill-storage';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

// Legacy localStorage keys that should be transparently migrated into IndexedDB
// on first read, so existing users don't lose data when we switch backends.
const LEGACY_KEYS = new Set([
  'ink-quill-editor-storage-v2',
  'ink-quill-settings',
  'ink-quill-ai-storage',
  'ink-quill-ui-storage',
]);

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function localGet(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota / unavailable errors — storage is best-effort.
  }
}

function localRemove(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function idbGet(key: string): Promise<string | null> {
  if (!hasIndexedDB()) return Promise.resolve(localGet(key));
  return openDB()
    .then(
      (db) =>
        new Promise<string | null>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(key);
          req.onsuccess = () => {
            const record = req.result as { key: string; value: string } | undefined;
            resolve(record ? record.value : null);
          };
          req.onerror = () => reject(req.error);
        }),
    )
    .then((value) => {
      if (value !== null) return value;
      // IndexedDB had nothing for this key — attempt a one-time migration
      // from the legacy localStorage entry before giving up.
      if (typeof window !== 'undefined' && LEGACY_KEYS.has(key)) {
        const legacy = window.localStorage.getItem(key);
        if (legacy != null) {
          void idbSet(key, legacy);
          window.localStorage.removeItem(key);
          return legacy;
        }
      }
      return null;
    })
    .catch(() => localGet(key));
}

function idbSet(key: string, value: string): Promise<void> {
  if (!hasIndexedDB()) {
    localSet(key, value);
    return Promise.resolve();
  }
  return openDB()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({ key, value });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    )
    .catch(() => {
      localSet(key, value);
    });
}

function idbRemove(key: string): Promise<void> {
  if (!hasIndexedDB()) {
    localRemove(key);
    return Promise.resolve();
  }
  return openDB()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    )
    .catch(() => {
      localRemove(key);
    });
}

export const idbStorage: StateStorage = {
  getItem: (name) => idbGet(name),
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => idbRemove(name),
};
