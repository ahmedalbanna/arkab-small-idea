import { describe, it, expect } from "vitest";
import { loadPlugins } from "../plugins";
import type { EditorAPI } from "../plugins/types";

function fakeEditor(): EditorAPI {
  return {
    getView: () => null,
    isReady: () => false,
    focus: () => {},
  };
}

describe("loadPlugins (phase 1 wiring)", () => {
  it("registers the extracted editor plugins and resolves the schema", async () => {
    const loaded = await loadPlugins(fakeEditor());

    // ProseMirror plugins contributed by extracted features.
    const pmPlugins = loaded.collectors.prosePlugins;
    expect(pmPlugins.length).toBeGreaterThanOrEqual(5);

    // Node views contributed by image/scribble/diagram features.
    const nodeViewNames = loaded.collectors.nodeViews.map((n) => n.name).sort();
    expect(nodeViewNames).toEqual(["diagram", "gallery", "image", "scribble"]);

    // Final schema still carries every core + contributed node.
    for (const name of [
      "paragraph",
      "heading",
      "image",
      "gallery",
      "scribble",
      "diagram",
      "table",
    ]) {
      expect(loaded.schema.nodes[name], `schema should have "${name}"`).toBeTruthy();
    }

    // TOC overlay was removed; confirm it no longer appears.
    const overlayIds = loaded.collectors.overlays.map((o) => o.id).sort();
    expect(overlayIds).not.toContain("status-bar");
    expect(overlayIds).not.toContain("toc");

    // The tables plugin contributes its ProseMirror plugins (sort + row actions).
    expect(pmPlugins.length).toBeGreaterThanOrEqual(7);

    // Phase 8: plugin-driven UI is surfaced through the collectors and the
    // resolved plugin context. The editorUI plugin contributes the focus /
    // typewriter toolbar buttons; the ai plugin contributes the "/ask-ai"
    // slash command; the status-bar plugin contributes its visibility setting.
    const toolbarIds = loaded.collectors.toolbarItems.map((t) => t.id).sort();
    expect(toolbarIds).toEqual([
      "command-palette",
      "focus-mode",
      "typewriter",
    ]);

    const slashIds = loaded.collectors.commands
      .filter((c) => c.slash)
      .map((c) => c.id);
    expect(slashIds).toContain("ai-ask");

    const settingKeys = loaded.collectors.settings.map(
      (s) => `${s.pluginId}.${s.key}`,
    );
    expect(settingKeys).toContain("status-bar.visible");

    // The same contributions are exposed on the resolved PluginContext.
    expect(loaded.context.toolbarItems).toHaveLength(3);
    expect(loaded.context.commands.some((c) => c.id === "ai-ask")).toBe(true);
    expect(loaded.context.commands.some((c) => c.id === "bold")).toBe(true);
    expect(
      loaded.context.settings.some((s) => s.pluginId === "status-bar"),
    ).toBe(true);
  });

  it("excludes disabled plugins from collectors", async () => {
    const before = (await loadPlugins(fakeEditor())).collectors.prosePlugins
      .length;
    const loaded = await loadPlugins(fakeEditor(), { disabled: ["math"] });

    // The math plugin contributes exactly one ProseMirror plugin; disabling it
    // removes that contribution.
    expect(loaded.collectors.prosePlugins.length).toBe(before - 1);
  });
});
