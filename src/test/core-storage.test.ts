// @vitest-environment node
import { describe, it, expect } from "vitest";
import { schema as baseSchema } from "prosemirror-markdown";
import { history } from "prosemirror-history";
import { noopStorage, type Draft, type StorageAdapter } from "@core/types";
import { countWords } from "@core/util/words";
import { CoreEditor } from "@core/CoreEditor";

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
    this.drafts.unshift(stored); // newest first
    return stored;
  }
  async loadDrafts(pageId: string) {
    return this.drafts.filter((d) => d.pageId === pageId);
  }
  async deleteDraft(id: string) {
    this.drafts = this.drafts.filter((d) => d.id !== id);
  }
}

function makeCore(storage?: StorageAdapter, initialMarkdown?: string) {
  return new CoreEditor({
    schema: baseSchema,
    prosePlugins: [history()],
    storage,
    initialMarkdown,
  });
}

describe("countWords", () => {
  it("counts whitespace-separated tokens", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  hello   world ")).toBe(2);
  });
});

describe("noopStorage", () => {
  it("does not persist anything", async () => {
    expect(await noopStorage.getItem("x")).toBeNull();
    await noopStorage.setItem("x", "y");
    expect(await noopStorage.getItem("x")).toBeNull();
    const draft = await noopStorage.saveDraft({ pageId: "p", content: "c", timestamp: 1 });
    expect(draft.content).toBe("c");
    expect(await noopStorage.loadDrafts("p")).toEqual([]);
    await expect(noopStorage.deleteDraft("1")).resolves.toBeUndefined();
  });
});

describe("MemoryStorage adapter", () => {
  it("round-trips drafts and orders newest first", async () => {
    const store = new MemoryStorage();
    const first = await store.saveDraft({ pageId: "p", content: "first", timestamp: 1 });
    const second = await store.saveDraft({ pageId: "p", content: "second", timestamp: 2 });
    expect(first.id).toBe("1");
    expect(second.id).toBe("2");
    const drafts = await store.loadDrafts("p");
    expect(drafts.map((d) => d.content)).toEqual(["second", "first"]);
    await store.deleteDraft("1");
    expect((await store.loadDrafts("p")).map((d) => d.id)).toEqual(["2"]);
  });

  it("isolates drafts by pageId", async () => {
    const store = new MemoryStorage();
    await store.saveDraft({ pageId: "a", content: "A", timestamp: 1 });
    await store.saveDraft({ pageId: "b", content: "B", timestamp: 2 });
    expect((await store.loadDrafts("a")).map((d) => d.content)).toEqual(["A"]);
    expect((await store.loadDrafts("b")).map((d) => d.content)).toEqual(["B"]);
  });
});

describe("CoreEditor draft persistence", () => {
  it("saveDraft computes word count and round-trips through the adapter", async () => {
    const store = new MemoryStorage();
    const core = makeCore(store, "one two three four five");
    const draft = await core.saveDraft("page1");
    expect(draft.wordCount).toBe(5);
    const loaded = await core.loadDraft("page1");
    expect(loaded).not.toBeNull();
    expect(loaded!.content).toContain("one two");
    expect(loaded!.wordCount).toBe(5);
  });

  it("falls back to noop storage without throwing", async () => {
    const core = makeCore(undefined, "Just text");
    const draft = await core.saveDraft("pageX");
    expect(draft.content).toContain("Just text");
    // No adapter => no drafts persisted.
    expect(await core.loadDraft("pageX")).toBeNull();
  });
});
