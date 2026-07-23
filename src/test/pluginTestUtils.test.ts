/**
 * Tests for plugin development helpers in `pluginDevHelper.ts` and
 * `pluginTestUtils.ts`.
 *
 * Verifies that the test bench correctly mirrors the production plugin
 * lifecycle (init, contributions capture, destroy) and that the convenience
 * wrappers in pluginTestUtils reduce boilerplate without hiding behaviour.
 */
import { describe, it, expect, vi } from "vitest";
import { Schema } from "prosemirror-model";
import { createPluginTestBench, createTestCommandAPI } from "../plugins/devtools/pluginDevHelper";
import { createTestPluginContext, withTestPlugin } from "./helpers/pluginTestUtils";
import type { InkPlugin, PluginContext } from "../plugins/types";
import type { EditorCommandBus } from "../plugins/editorCommandBus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal test plugin that registers one of each contribution type. */
function demoPlugin(destroyFn?: () => void): InkPlugin {
  return {
    id: "demo",
    name: "Demo Plugin",
    version: "1.0.0",
    init(ctx: PluginContext) {
      ctx.registerCommand({
        id: "demo:greet",
        label: "Greet",
        run: () => true,
        slash: true,
      });
      ctx.registerToolbarItem({
        id: "demo:btn",
        icon: (() => null) as never,
        label: "Demo",
        onClick: () => {},
      });
      ctx.registerProsePlugin(() => ({}) as never);
      ctx.registerNodeView({ name: "demo:view", view: () => ({}) as never });
      ctx.registerOverlay({
        id: "demo:panel",
        component: (() => null) as never,
        mount: "modal",
      });
      ctx.registerSetting({
        pluginId: "demo",
        key: "enabled",
        label: "Enabled",
        type: "toggle",
        defaultValue: true,
      });
      ctx.registerHost((() => null) as never);
    },
    destroy: destroyFn,
  };
}

describe("createPluginTestBench", () => {
  it("creates a bench with a working createPluginContext", () => {
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    expect(ctx.context).toBeDefined();
    expect(ctx.collectors).toBeDefined();
    expect(ctx.commandBus).toBeDefined();
    expect(ctx.schema).toBeDefined();
    expect(ctx.schema.nodes).toHaveProperty("doc");
    expect(ctx.schema.nodes).toHaveProperty("paragraph");
    expect(ctx.schema.nodes).toHaveProperty("text");
  });

  it("accepts custom schema in createPluginContext", () => {
    const bench = createPluginTestBench();
    const customSchema = new Schema({
      nodes: {
        doc: { content: "block+" },
        blockquote: { group: "block", content: "block+" },
        paragraph: { group: "block", content: "inline*" },
        text: { group: "inline" },
      },
      marks: {},
    });
    const ctx = bench.createPluginContext({ schema: customSchema });
    expect(ctx.schema.nodes).toHaveProperty("blockquote");
    expect(ctx.schema.nodes).not.toHaveProperty("callout");
  });

  it("accepts custom command bus", async () => {
    const bench = createPluginTestBench();
    const { bus: customBus } = await import("./helpers/commandTestUtils").then((m) =>
      m.createMockCommandBus(),
    );
    const ctx = bench.createPluginContext({ commandBus: customBus });
    expect(ctx.commandBus).toBe(customBus);
  });

  it("loadPlugin calls plugin.init with the context", async () => {
    const initFn = vi.fn();
    const plugin: InkPlugin = {
      id: "test",
      name: "Test",
      version: "1.0.0",
      init: initFn,
    };
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin(plugin, ctx);
    expect(initFn).toHaveBeenCalledTimes(1);
    expect(initFn).toHaveBeenCalledWith(ctx.context);
  });

  it("loadPlugin stamps pluginId on context for error attribution", async () => {
    const plugin: InkPlugin = {
      id: "my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      init(ctx) {
        expect((ctx as { pluginId?: string }).pluginId).toBe("my-plugin");
      },
    };
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin(plugin, ctx);
  });

  it("loadPlugin destroys previous plugin before loading a new one", async () => {
    const destroyA = vi.fn();
    const destroyB = vi.fn();
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();

    await bench.loadPlugin(demoPlugin(destroyA), ctx);
    expect(destroyA).not.toHaveBeenCalled();

    await bench.loadPlugin(
      { id: "b", name: "B", version: "1.0.0", init: vi.fn(), destroy: destroyB },
      ctx,
    );
    expect(destroyA).toHaveBeenCalledTimes(1);
  });

  it("getContributions returns all registered contributions after loadPlugin", async () => {
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin(demoPlugin(), ctx);

    const contribs = bench.getContributions();
    expect(contribs.commands).toHaveLength(1);
    expect(contribs.commands[0]?.id).toBe("demo:greet");
    expect(contribs.toolbarItems).toHaveLength(1);
    expect(contribs.toolbarItems[0]?.id).toBe("demo:btn");
    expect(contribs.prosePlugins).toHaveLength(1);
    expect(contribs.nodeViews).toHaveLength(1);
    expect(contribs.nodeViews[0]?.name).toBe("demo:view");
    expect(contribs.overlays).toHaveLength(1);
    expect(contribs.overlays[0]?.id).toBe("demo:panel");
    expect(contribs.settings).toHaveLength(1);
    expect(contribs.settings[0]?.key).toBe("enabled");
    expect(contribs.hosts).toHaveLength(1);
  });

  it("getContributions returns empty arrays before any plugin is loaded", () => {
    const bench = createPluginTestBench();
    const contribs = bench.getContributions();
    expect(contribs.commands).toEqual([]);
    expect(contribs.toolbarItems).toEqual([]);
    expect(contribs.prosePlugins).toEqual([]);
    expect(contribs.nodeViews).toEqual([]);
    expect(contribs.overlays).toEqual([]);
    expect(contribs.settings).toEqual([]);
    expect(contribs.hosts).toEqual([]);
  });

  it("simulateUserAction dispatches through the bus", async () => {
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    // Attach a mock executor to the bus so dispatch actually records.
    const { bus } = await import("./helpers/commandTestUtils").then((m) =>
      m.createMockCommandBus(),
    );
    const ctxWithBus = bench.createPluginContext({ commandBus: bus });
    await bench.loadPlugin(
      { id: "dummy", name: "Dummy", version: "1.0.0", init: vi.fn() },
      ctxWithBus,
    );

    bench.simulateUserAction({ type: "focus" });
    expect(bus.getAuditLog()).toHaveLength(1);
    expect(bus.getAuditLog()[0]?.action).toEqual({ type: "focus" });
    expect(bus.getAuditLog()[0]?.source).toBe("user:toolbar");
  });

  it("simulateUserAction is a no-op when no plugin is loaded", () => {
    const bench = createPluginTestBench();
    expect(() => bench.simulateUserAction({ type: "focus" })).not.toThrow();
  });

  it("destroy calls the plugin's destroy function", async () => {
    const destroyFn = vi.fn();
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin(demoPlugin(destroyFn), ctx);

    bench.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it("destroy is idempotent (safe to call multiple times)", async () => {
    const destroyFn = vi.fn();
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin(demoPlugin(destroyFn), ctx);

    bench.destroy();
    bench.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it("destroy does not throw on plugins without destroy", async () => {
    const bench = createPluginTestBench();
    const ctx = bench.createPluginContext();
    await bench.loadPlugin({ id: "noop", name: "Noop", version: "1.0.0", init: vi.fn() }, ctx);
    expect(() => bench.destroy()).not.toThrow();
  });

  it("createPluginContext can be called multiple times for independent contexts", () => {
    const bench = createPluginTestBench();
    const ctx1 = bench.createPluginContext();
    const ctx2 = bench.createPluginContext();
    expect(ctx1.context).not.toBe(ctx2.context);
    expect(ctx1.collectors).not.toBe(ctx2.collectors);
  });
});

describe("createTestCommandAPI", () => {
  it("returns a CommandAPI with bus, stores, and emitIntent", () => {
    const api = createTestCommandAPI();
    expect(api.commandBus).toBeDefined();
    expect(api.stores).toBeDefined();
    expect(api.emitIntent).toBeInstanceOf(Function);
  });

  it("dispatch on the bus records audit entries", () => {
    const api = createTestCommandAPI();
    api.commandBus.dispatch({ type: "focus" });
    expect(api.commandBus.getAuditLog()).toHaveLength(1);
  });
});

describe("createTestPluginContext (convenience)", () => {
  it("returns a PluginTestContext with default schema", () => {
    const ctx = createTestPluginContext();
    expect(ctx.schema.nodes).toHaveProperty("doc");
    expect(ctx.schema.nodes).toHaveProperty("paragraph");
    expect(ctx.schema.nodes).toHaveProperty("text");
  });

  it("accepts a pre-created bench", () => {
    const bench = createPluginTestBench();
    const ctx = createTestPluginContext(bench);
    expect(ctx.context).toBeDefined();
  });
});

describe("withTestPlugin (convenience)", () => {
  it("initialises a plugin and returns contributions", async () => {
    const result = await withTestPlugin(demoPlugin());
    expect(result.plugin.id).toBe("demo");
    expect(result.context).toBeDefined();
    expect(result.contributions.commands).toHaveLength(1);
    expect(result.contributions.commands[0]?.id).toBe("demo:greet");
  });

  it("destroy() cleans up the plugin", async () => {
    const destroyFn = vi.fn();
    const result = await withTestPlugin(demoPlugin(destroyFn));
    expect(destroyFn).not.toHaveBeenCalled();
    result.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it("destroy() is safe to call twice", async () => {
    const destroyFn = vi.fn();
    const result = await withTestPlugin(demoPlugin(destroyFn));
    result.destroy();
    result.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });
});
