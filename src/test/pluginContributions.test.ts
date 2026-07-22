import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Schema } from "prosemirror-model";
import { createCollectors, buildPluginContext } from "../plugins/context";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";
import { addPluginLogSink, type PluginLogEntry } from "../plugins/logger";
import { PluginRegistry } from "../plugins/registry";
import type { InkPlugin, PluginContext } from "../plugins/types";

const baseSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: {},
});

function makeContext(collectors = createCollectors()) {
  const editor = {} as unknown as import("../plugins/types").EditorAPI;
  return buildPluginContext(baseSchema, collectors, editor, defaultEditorCommandBus);
}

describe("plugin contribution validation", () => {
  let sink: (e: PluginLogEntry) => void;
  let unsub: () => void;
  const events: PluginLogEntry[] = [];

  beforeEach(() => {
    events.length = 0;
    sink = (e) => events.push(e);
    unsub = addPluginLogSink(sink);
  });
  afterEach(() => {
    unsub();
  });

  it("keeps valid commands and drops invalid ones, attributing the error", async () => {
    const collectors = createCollectors();
    const ctx = makeContext(collectors);
    (ctx as { pluginId?: string }).pluginId = "test-plugin";

    const plugin: InkPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      init(c: PluginContext) {
        c.registerCommand({ id: "valid-cmd", label: "Valid", run: () => true });
        // Missing `run`.
        c.registerCommand({ id: "bad-cmd", label: "Bad" } as never);
        // `run` is not a function.
        c.registerCommand({ id: "bad-cmd2", label: "Bad2", run: "nope" } as never);
      },
    };
    await plugin.init(ctx as PluginContext);

    expect(collectors.commands.map((c) => c.id)).toEqual(["valid-cmd"]);

    const invalids = events.filter((e) => e.event === "contribution:invalid");
    expect(invalids).toHaveLength(2);
    expect(invalids.every((e) => e.plugin === "test-plugin")).toBe(true);
    expect(invalids.some((e) => (e.message ?? "").includes("command"))).toBe(true);
  });

  it("validates toolbar items, overlays, settings and node views", async () => {
    const collectors = createCollectors();
    const ctx = makeContext(collectors);
    (ctx as { pluginId?: string }).pluginId = "ui-plugin";

    const plugin: InkPlugin = {
      id: "ui-plugin",
      name: "UI Plugin",
      version: "1.0.0",
      init(c: PluginContext) {
        c.registerToolbarItem({
          id: "tb-ok",
          icon: (() => null) as never,
          label: "OK",
          onClick: () => {},
        });
        // Missing `icon` and `onClick`.
        c.registerToolbarItem({ id: "tb-bad", label: "Bad" } as never);
        c.registerOverlay({
          id: "ov-ok",
          component: (() => null) as never,
          mount: "modal",
        });
        // `component` is not callable.
        c.registerOverlay({ id: "ov-bad", component: 5, mount: "modal" } as never);
        c.registerSetting({
          pluginId: "ui-plugin",
          key: "st-ok",
          label: "S",
          type: "toggle",
          defaultValue: false,
        });
        // Missing `key`, `type`, `defaultValue`.
        c.registerSetting({ pluginId: "ui-plugin", label: "S" } as never);
        c.registerNodeView({ name: "nv-ok", view: (() => null) as never });
        // `view` is not callable.
        c.registerNodeView({ name: "nv-bad", view: 123 } as never);
      },
    };
    await plugin.init(ctx as PluginContext);

    expect(collectors.toolbarItems.map((t) => t.id)).toEqual(["tb-ok"]);
    expect(collectors.overlays.map((o) => o.id)).toEqual(["ov-ok"]);
    expect(collectors.settings.map((s) => s.key)).toEqual(["st-ok"]);
    expect(collectors.nodeViews.map((n) => n.name)).toEqual(["nv-ok"]);

    const invalids = events.filter((e) => e.event === "contribution:invalid");
    expect(invalids).toHaveLength(4);
  });

  it("rejects an invalid schema contribution and logs it", async () => {
    const registry = new PluginRegistry();
    registry.register({
      id: "schema-plugin",
      name: "Schema Plugin",
      version: "1.0.0",
      init: () => {},
      getSchemaContribution: async () => ({
        nodes: 5 as never,
        marks: {},
      }),
    });

    const merged = await registry.collectSchemaContributions();

    expect(merged.nodes).not.toHaveProperty("bad");
    const invalids = events.filter((e) => e.event === "contribution:invalid");
    expect(invalids).toHaveLength(1);
    expect(invalids[0]?.plugin).toBe("schema-plugin");
  });
});
