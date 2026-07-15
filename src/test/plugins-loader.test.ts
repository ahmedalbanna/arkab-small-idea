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

    // No overlays/toolbar/commands registered yet (UI plugins come later).
    expect(loaded.collectors.overlays).toHaveLength(0);
    expect(loaded.collectors.toolbarItems).toHaveLength(0);
  });
});
