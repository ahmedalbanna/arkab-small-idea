import { describe, it, expect, beforeEach, vi } from "vitest";
import { createJSONStorage } from "zustand/middleware";

// Minimal in-memory IndexedDB stub — just enough to exercise the real
// idbStorage code path (open / onupgradeneeded / transaction / get / put / delete)
// without pulling in a third-party polyfill.
function createFakeIndexedDB() {
  class FakeStore {
    data = new Map<string, any>();
    constructor(public keyPath: string) {}
    get(key: string) {
      const req: any = {};
      queueMicrotask(() => {
        req.result = this.data.get(key) ?? undefined;
        req.onsuccess?.({ target: { result: req.result } });
      });
      return req;
    }
    put(record: any) {
      const req: any = {};
      queueMicrotask(() => {
        this.data.set(record[this.keyPath], record);
        req.onsuccess?.({});
      });
      return req;
    }
    delete(key: string) {
      const req: any = {};
      queueMicrotask(() => {
        this.data.delete(key);
        req.onsuccess?.({});
      });
      return req;
    }
  }

  class FakeDB {
    stores = new Map<string, FakeStore>();
    objectStoreNames = {
      contains: (n: string) => this.stores.has(n),
    };
    constructor(public name: string) {}
    createObjectStore(name: string, opts: { keyPath: string }) {
      const store = new FakeStore(opts.keyPath);
      this.stores.set(name, store);
      return store;
    }
    transaction(storeNames: string | string[]) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx: any = {
        objectStore: (n: string) => this.stores.get(n)!,
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      queueMicrotask(() => tx.oncomplete?.({}));
      return tx;
    }
  }

  const databases = new Map<string, FakeDB>();
  return {
    open(name: string) {
      const req: any = {};
      queueMicrotask(() => {
        let isNew = false;
        let db = databases.get(name);
        if (!db) {
          db = new FakeDB(name);
          databases.set(name, db);
          isNew = true;
        }
        req.result = db;
        if (isNew) req.onupgradeneeded?.({ target: { result: db } });
        req.onsuccess?.({ target: { result: db } });
      });
      return req;
    },
  };
}

function makeLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

let localStorageMock: ReturnType<typeof makeLocalStorage>;

beforeEach(() => {
  vi.resetModules();
  localStorageMock = makeLocalStorage();
  (globalThis as any).window = { localStorage: localStorageMock };
  (globalThis as any).indexedDB = createFakeIndexedDB();
});

describe("idbStorage", () => {
  it("round-trips values through IndexedDB via createJSONStorage", async () => {
    const { idbStorage } = await import("../lib/idbStorage");
    const storage = createJSONStorage(() => idbStorage);

    await storage.setItem("test-key", { state: { foo: "bar", n: 1 }, version: 0 });
    expect(await storage.getItem("test-key")).toEqual({ state: { foo: "bar", n: 1 }, version: 0 });

    await storage.removeItem("test-key");
    expect(await storage.getItem("test-key")).toBeNull();
  });

  it("migrates a legacy localStorage key into IndexedDB and clears the old entry", async () => {
    const { idbStorage } = await import("../lib/idbStorage");
    const legacyValue = JSON.stringify({ state: { theme: "dark" }, version: 1 });
    localStorageMock.setItem("ink-quill-settings", legacyValue);

    const result = await idbStorage.getItem("ink-quill-settings");
    expect(result).toBe(legacyValue);
    // The legacy entry should have been migrated out of localStorage.
    expect(localStorageMock.getItem("ink-quill-settings")).toBeNull();
  });

  it("falls back to localStorage when IndexedDB is unavailable", async () => {
    delete (globalThis as any).indexedDB;
    const { idbStorage } = await import("../lib/idbStorage");
    const storage = createJSONStorage(() => idbStorage);

    await storage.setItem("fb-key", { state: { hello: "world" }, version: 0 });
    expect(localStorageMock.getItem("fb-key")).not.toBeNull();
    expect(await storage.getItem("fb-key")).toEqual({ state: { hello: "world" }, version: 0 });
  });

  it("returns null for unknown keys without throwing", async () => {
    const { idbStorage } = await import("../lib/idbStorage");
    expect(await idbStorage.getItem("does-not-exist")).toBeNull();
  });
});
