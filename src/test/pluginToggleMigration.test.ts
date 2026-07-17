// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  migratePluginToggles,
  validateDisabledPlugins,
  PLUGIN_TOGGLES_VERSION,
} from "../plugins/pluginToggleMigration";
import { PluginRegistry } from "../plugins/registry";
import type { InkPlugin } from "../plugins/types";

function fakePlugin(id: string): InkPlugin {
  return { id, name: id, version: "1.0.0", init: () => {} };
}

describe("migratePluginToggles (versioned schema)", () => {
  it("coerces malformed persisted values to a clean array", () => {
    expect(migratePluginToggles(undefined, 0)).toEqual([]);
    expect(migratePluginToggles(null, 0)).toEqual([]);
    expect(migratePluginToggles(42, 0)).toEqual([]);
    // a lone string is tolerated and wrapped
    expect(migratePluginToggles("search", 0)).toEqual(["search"]);
    // non-string array entries are dropped
    expect(migratePluginToggles(["search", 5, null], 0)).toEqual(["search"]);
  });

  it("applies legacy id renames across a version boundary", () => {
    const renames = { "old-search": "search", "old-math": "math" };
    const result = migratePluginToggles(
      ["old-search", "math", "old-math"],
      0, // from before the rename existed
      renames,
    );
    // old ids mapped forward, already-current ids untouched, deduped.
    expect(result).toEqual(["search", "math"]);
  });

  it("is a no-op when already at the current version", () => {
    expect(migratePluginToggles(["search", "math"], PLUGIN_TOGGLES_VERSION)).toEqual([
      "search",
      "math",
    ]);
  });

  it("deduplicates while preserving first-seen order", () => {
    expect(migratePluginToggles(["a", "b", "a", "c"], 0)).toEqual(["a", "b", "c"]);
  });
});

describe("validateDisabledPlugins (runtime safety)", () => {
  it("drops ids absent from the live registry and dedupes", () => {
    const registry = new PluginRegistry();
    registry.register(fakePlugin("core"));
    registry.register(fakePlugin("search"));
    registry.register(fakePlugin("math"));

    const result = validateDisabledPlugins(
      ["core", "ghost-plugin", "core", "search", "removed-2023"],
      registry,
    );
    expect(result).toEqual(["core", "search"]);
  });

  it("returns an empty list when no ids are valid", () => {
    const registry = new PluginRegistry();
    registry.register(fakePlugin("core"));
    expect(validateDisabledPlugins(["a", "b"], registry)).toEqual([]);
    expect(validateDisabledPlugins(undefined, registry)).toEqual([]);
  });

  it("keeps a newly added plugin enabled when absent from the disabled list", () => {
    const registry = new PluginRegistry();
    registry.register(fakePlugin("core"));
    registry.register(fakePlugin("brandNew"));
    // brandNew is not in the disabled list -> not returned, i.e. stays enabled.
    expect(validateDisabledPlugins(["core"], registry)).toEqual(["core"]);
  });
});

describe("runtime enable/disable stays safe with unknown ids", () => {
  it("ignores disable/enable for ids not in the registry", () => {
    const registry = new PluginRegistry();
    registry.register(fakePlugin("core"));

    // No throw, no state change, for ids that don't exist.
    expect(() => registry.disable("does-not-exist")).not.toThrow();
    expect(() => registry.enable("does-not-exist")).not.toThrow();
    expect(registry.has("does-not-exist")).toBe(false);

    // A real plugin toggles correctly.
    registry.disable("core");
    expect(registry.getEnabled().map((p) => p.id)).not.toContain("core");
    registry.enable("core");
    expect(registry.getEnabled().map((p) => p.id)).toContain("core");
  });
});
