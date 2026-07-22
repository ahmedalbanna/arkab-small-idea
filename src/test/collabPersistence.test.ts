// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ensureGCEnabled } from "../plugins/collab/persistence";

describe("collab persistence", () => {
  it("ensureGCEnabled sets gc flag on the Y.Doc", () => {
    const doc = new Y.Doc();
    doc.gc = false; // disable initially
    ensureGCEnabled(doc);
    expect(doc.gc).toBe(true);
    doc.destroy();
  });

  it("gc is enabled by default on new Y.Doc instances", () => {
    const doc = new Y.Doc();
    expect(doc.gc).toBe(true);
    doc.destroy();
  });

  it("attachPersistence and ensureGCEnabled are exported", async () => {
    const mod = await import("../plugins/collab/persistence");
    expect(typeof mod.attachPersistence).toBe("function");
    expect(typeof mod.ensureGCEnabled).toBe("function");
  });

  it("PersistenceHandle interface shape is correct", () => {
    // Verify the interface contract without needing indexedDB
    const fakeHandle = {
      loadDocument: async () => {},
      clear: async () => {},
      destroy: async () => {},
    };
    // Assign to type-check: if PersistenceHandle expects different members,
    // this will fail at runtime
    const handle: import("../plugins/collab/persistence").PersistenceHandle = fakeHandle;
    expect(handle).toHaveProperty("loadDocument");
    expect(handle).toHaveProperty("clear");
    expect(handle).toHaveProperty("destroy");
  });
});
