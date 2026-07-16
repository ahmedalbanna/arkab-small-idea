import { describe, it, expect, vi } from "vitest";
import { PluginRegistry } from "../plugins/registry";
import type { InkPlugin, PluginContext, SchemaContribution } from "../plugins/types";
import type { Schema } from "prosemirror-model";

function makePlugin(
  id: string,
  opts: Partial<InkPlugin> = {},
): InkPlugin {
  return {
    id,
    name: id,
    version: "1.0.0",
    init: vi.fn(),
    ...opts,
  };
}

function fakeContext(): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    stores: {} as any,
    schema: {} as Schema,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
  };
}

describe("PluginRegistry", () => {
  it("registers plugins and resolves dependency order", () => {
    const reg = new PluginRegistry();
    const a = makePlugin("a");
    const b = makePlugin("b", { dependencies: ["a"] });
    const c = makePlugin("c", { dependencies: ["b"] });
    reg.register(c);
    reg.register(a);
    reg.register(b);

    expect(reg.resolveOrder()).toEqual(["a", "b", "c"]);
  });

  it("throws on duplicate registration", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("a"));
    expect(() => reg.register(makePlugin("a"))).toThrow();
  });

  it("throws when a dependency is unregistered", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("b", { dependencies: ["missing"] }));
    expect(() => reg.resolveOrder()).toThrow(/unregistered plugin "missing"/);
  });

  it("throws on cyclic dependencies", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("a", { dependencies: ["b"] }));
    reg.register(makePlugin("b", { dependencies: ["a"] }));
    expect(() => reg.resolveOrder()).toThrow(/Cyclic/);
  });

  it("excludes disabled plugins from getEnabled", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("a"));
    reg.register(makePlugin("b", { enabled: false }));
    expect(reg.getEnabled().map((p) => p.id)).toEqual(["a"]);
  });

  it("collects and merges schema contributions from enabled plugins", async () => {
    const reg = new PluginRegistry();
    reg.register(
      makePlugin("nodes", {
        getSchemaContribution: () => ({
          nodes: { callout: { group: "block", content: "inline*" } as any },
        }),
      }),
    );
    reg.register(
      makePlugin("marks", {
        getSchemaContribution: () => ({
          marks: { highlight: { toDOM: () => ["mark", 0] } as any },
        }),
      }),
    );
    reg.register(
      makePlugin("disabled", {
        enabled: false,
        getSchemaContribution: () => ({
          nodes: { shouldNotAppear: {} as any },
        }),
      }),
    );

    const merged = await reg.collectSchemaContributions();
    expect(merged.nodes).toHaveProperty("callout");
    expect(merged.nodes).not.toHaveProperty("shouldNotAppear");
    expect(merged.marks).toHaveProperty("highlight");
  });

  it("initializes enabled plugins in dependency order", async () => {
    const reg = new PluginRegistry();
    const calls: string[] = [];
    reg.register(
      makePlugin("a", { init: () => { calls.push("a"); } }),
    );
    reg.register(
      makePlugin("b", {
        dependencies: ["a"],
        init: () => { calls.push("b"); },
      }),
    );

    await reg.initAll(async () => ({
      schema: {} as Schema,
      context: fakeContext(),
    }));

    expect(calls).toEqual(["a", "b"]);
  });

  it("calls destroy in reverse order", async () => {
    const reg = new PluginRegistry();
    const calls: string[] = [];
    reg.register(makePlugin("a", { destroy: () => { calls.push("a"); } }));
    reg.register(makePlugin("b", { destroy: () => { calls.push("b"); } }));

    await reg.initAll(async () => ({
      schema: {} as Schema,
      context: fakeContext(),
    }));
    reg.destroyAll();
    expect(calls).toEqual(["b", "a"]);
  });
});
