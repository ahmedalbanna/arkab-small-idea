// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { addPluginLogSink, pluginLogger, type PluginLogEntry } from "../plugins/logger";
import { PluginRegistry } from "../plugins/registry";
import { loadPlugins } from "../plugins";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";
import type { InkPlugin, PluginContext, EditorAPI } from "../plugins/types";

function fakeEditor(): EditorAPI {
  return { getView: () => null, isReady: () => false, focus: () => {} };
}

function fakeContext(): PluginContext {
  return {
    editor: fakeEditor(),
    commandBus: defaultEditorCommandBus,
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
    emitIntent: () => {},
    ragService: null,
    embeddingService: null,
    vectorStore: null,
    editorPlugins: [],
    nodeViews: {},
    toolbarItems: [],
    commands: [],
    settings: [],
  };
}

describe("plugin structured logger", () => {
  let captured: PluginLogEntry[];
  let unsub: () => void;

  beforeEach(() => {
    captured = [];
    unsub = addPluginLogSink((e) => captured.push(e));
  });

  afterEach(() => unsub());

  it("emits structured entries with level, plugin, event and meta", () => {
    pluginLogger.info("core", "init:done", "Plugin initialized", {
      durationMs: 3,
    });
    expect(captured).toHaveLength(1);
    const entry = captured[0];
    expect(entry.level).toBe("info");
    expect(entry.plugin).toBe("core");
    expect(entry.event).toBe("init:done");
    expect(entry.message).toBe("Plugin initialized");
    expect(entry.meta).toEqual({ durationMs: 3 });
    expect(typeof entry.ts).toBe("number");
  });

  it("supports multiple independent sinks and unsubscribe", () => {
    const other: PluginLogEntry[] = [];
    const unsub2 = addPluginLogSink((e) => other.push(e));
    pluginLogger.warn("x", "leak", "leak", { leaked: ["a"] });
    expect(captured).toHaveLength(1);
    expect(other).toHaveLength(1);
    unsub2();
    pluginLogger.warn("x", "leak", "leak2", { leaked: ["b"] });
    expect(captured).toHaveLength(2);
    expect(other).toHaveLength(1); // second sink stopped receiving
  });

  it("logs register/init/destroy lifecycle through the registry", async () => {
    const registry = new PluginRegistry();
    const init = vi.fn();
    const destroy = vi.fn();
    const plugin: InkPlugin = {
      id: "sample",
      name: "Sample",
      version: "1.0.0",
      init,
      destroy,
    };
    registry.register(plugin);
    expect(captured.some((e) => e.event === "register" && e.plugin === "sample")).toBe(true);

    await registry.initAll(async () => ({
      schema: {} as any,
      context: fakeContext(),
    }));
    expect(init).toHaveBeenCalledTimes(1);
    expect(captured.some((e) => e.event === "init:done" && e.plugin === "sample")).toBe(true);

    registry.destroyAll();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(captured.some((e) => e.event === "destroy:done" && e.plugin === "sample")).toBe(true);
    expect(captured.some((e) => e.event === "destroy:all")).toBe(true);
  });

  it("logs a leak warning when an initialized plugin is never destroyed", async () => {
    const registry = new PluginRegistry();
    registry.register({
      id: "leaky",
      name: "Leaky",
      version: "1.0.0",
      init: () => {},
    });
    await registry.initAll(async () => ({
      schema: {} as any,
      context: fakeContext(),
    }));
    const leaked = registry.verifyCleanup();
    expect(leaked).toEqual(["leaky"]);
    const leakEntry = captured.find((e) => e.event === "leak");
    expect(leakEntry).toBeTruthy();
    expect(leakEntry!.level).toBe("warn");
    expect(leakEntry!.meta).toEqual({ leaked: ["leaky"] });
  });

  it("logs load:start, schema:built and load:done with a summary during loadPlugins", async () => {
    await loadPlugins(fakeEditor(), { commandBus: defaultEditorCommandBus });

    expect(captured.some((e) => e.event === "load:start")).toBe(true);
    expect(captured.some((e) => e.event === "schema:built")).toBe(true);

    const done = captured.find((e) => e.event === "load:done");
    expect(done).toBeTruthy();
    expect(done!.level).toBe("info");
    expect(done!.meta).toMatchObject({
      plugins: expect.any(Number),
      commands: expect.any(Number),
      toolbarItems: expect.any(Number),
      nodeViews: expect.any(Number),
      prosePlugins: expect.any(Number),
      durationMs: expect.any(Number),
    });
    expect((done!.meta as any).plugins).toBeGreaterThan(0);
    // Core plugin should report a successful init.
    expect(captured.some((e) => e.event === "init:done" && e.plugin === "core")).toBe(true);
  });
});
