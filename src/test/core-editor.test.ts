// @vitest-environment node
import { describe, it, expect } from "vitest";
import { history } from "prosemirror-history";
import { schema as baseSchema } from "prosemirror-markdown";
import { CoreEditor } from "@core/CoreEditor";
import type { StorageAdapter, Draft } from "@core/types";

class MemoryStorage implements StorageAdapter {
  private kv = new Map<string, string>();
  private drafts: Draft[] = [];

  async getItem(key: string) {
    return this.kv.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.kv.set(key, value);
  }
  async removeItem(key: string) {
    this.kv.delete(key);
  }
  async saveDraft(draft: Draft) {
    const stored: Draft = { ...draft, id: String(this.drafts.length + 1) };
    this.drafts.unshift(stored);
    return stored;
  }
  async loadDrafts(pageId: string) {
    return this.drafts.filter((d) => d.pageId === pageId);
  }
  async deleteDraft(id: string) {
    this.drafts = this.drafts.filter((d) => d.id !== id);
  }
}

function makeCore(initialMarkdown?: string) {
  return new CoreEditor({
    schema: baseSchema,
    prosePlugins: [history()],
    storage: new MemoryStorage(),
    initialMarkdown,
  });
}

describe("CoreEditor controller", () => {
  it("seeds initial markdown", () => {
    const core = makeCore("# Hello");
    expect(core.getMarkdown()).toContain("Hello");
  });

  it("insertText routes through the command bus to the state", () => {
    const core = makeCore("Hello");
    core.insertText(" world");
    expect(core.getMarkdown()).toContain("world");
    expect(core.getMarkdown()).toContain("Hello");
  });

  it("executeCommand dispatches typed actions", () => {
    const core = makeCore("Hello");
    core.executeCommand({ type: "insertText", before: "X" });
    expect(core.getMarkdown()).toContain("X");
  });

  it("undo / redo revert and re-apply via native history", () => {
    const core = makeCore("First");
    core.setMarkdown("Second");
    expect(core.getMarkdown()).toContain("Second");
    core.undo();
    expect(core.getMarkdown()).toContain("First");
    core.redo();
    expect(core.getMarkdown()).toContain("Second");
  });

  it("notifies subscribers on every apply", () => {
    const core = makeCore("Hello");
    let calls = 0;
    const unsub = core.subscribe(() => {
      calls++;
    });
    core.insertText("!");
    expect(calls).toBeGreaterThanOrEqual(1);
    unsub();
    const before = calls;
    core.insertText("?");
    expect(calls).toBe(before); // unsubscribed
  });

  it("saveDraft / loadDraft round-trip through the storage adapter", async () => {
    const core = makeCore("Draft content");
    const draft = await core.saveDraft("page1");
    expect(draft.content).toContain("Draft content");
    const loaded = await core.loadDraft("page1");
    expect(loaded).not.toBeNull();
    expect(loaded!.content).toContain("Draft content");
    expect(loaded!.pageId).toBe("page1");
  });

  it("destroy detaches the executor so commands become no-ops", () => {
    const core = makeCore("Hello");
    core.destroy();
    const before = core.getMarkdown();
    core.insertText("NOPE");
    // With no executor, the bus dispatch is a no-op; state is unchanged.
    expect(core.getMarkdown()).toBe(before);
  });

  it("queries read the live state", () => {
    const core = makeCore("# Title\n\nbody text");
    const headings = core.getHeadings();
    expect(headings.map((h) => h.text)).toContain("Title");
    expect(core.getSelectedText()).toBeDefined();
    expect(core.getDoc()).toBeTruthy();
  });
});
