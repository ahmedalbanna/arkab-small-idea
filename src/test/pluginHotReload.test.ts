// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

// The embedding service instantiates a `Worker` at module load, which isn't
// available under the test DOM. Stub it so importing the plugin graph evaluates.
vi.mock("../services/embeddingService", () => {
  const noop = () => {};
  return {
    embeddingService: {
      isReady: () => false,
      getStatus: () => "idle",
      getProgress: () => 0,
      loadModel: async () => {},
      generateEmbedding: async () => [] as number[],
      cosineSimilarity: () => 0,
      onStatusChange: noop,
    },
    vectorStore: {
      init: async () => {},
      getChunks: () => [],
      getEpisodes: () => [],
      setChunks: async () => {},
      setEpisodes: async () => {},
      addEpisodes: async () => {},
      searchEpisodes: () => [],
      searchWithScores: () => [],
    },
    cosineSimilarity: () => 0,
  };
});

import { buildPluginModules, notifyPluginsChanged, onPluginsChanged } from "../plugins";

describe("plugin hot-reload (dev)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buildPluginModules returns the full static plugin set", () => {
    const ids = buildPluginModules().map((p) => p.id);
    expect(ids).toContain("core");
    expect(ids).toContain("math");
    expect(ids).toContain("ai");
    expect(ids).toContain("editorUI");
    // 16 static plugins (collab is registered dynamically, not in this set).
    expect(ids).toHaveLength(16);
  });

  it("notifyPluginsChanged wakes registered listeners and unsubscribe removes them", () => {
    const listener = vi.fn();
    const unsubscribe = onPluginsChanged(listener);

    notifyPluginsChanged();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyPluginsChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
