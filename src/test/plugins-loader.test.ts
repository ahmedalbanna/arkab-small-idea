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

    // UI plugins (status bar + table of contents) register overlays.
    const overlayIds = loaded.collectors.overlays.map((o) => o.id).sort();
    expect(overlayIds).toContain("status-bar");
    expect(overlayIds).toContain("toc");

    // The tables plugin contributes its ProseMirror plugins (sort + row actions).
    expect(pmPlugins.length).toBeGreaterThanOrEqual(7);

    // No toolbar items registered yet.
    expect(loaded.collectors.toolbarItems).toHaveLength(0);
  });
});
