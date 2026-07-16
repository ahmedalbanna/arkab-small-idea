import { describe, it, expect } from "vitest";
import type { PluginContext } from "../plugins/types";
import { tablesPlugin } from "../plugins/tables";
import { statusBarPlugin } from "../plugins/statusbar";
import { tocPlugin } from "../plugins/toc";
import { loadPlugins } from "../plugins";

function fakeEditor() {
  return {
    getView: () => null,
    isReady: () => false,
    focus: () => {},
  };
}

/** Captures only the registrations a plugin performs during `init`. */
function captureInit(plugin: {
  init?: (ctx: PluginContext) => void;
}) {
  const prosePlugins: unknown[] = [];
  const overlays: unknown[] = [];
  plugin.init?.({
    editor: fakeEditor() as any,
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: (p) => prosePlugins.push(p),
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: (o) => overlays.push(o),
    registerSetting: () => {},
    registerHost: () => {},
  } as PluginContext);
  return { prosePlugins, overlays };
}

describe("UI plugin extraction", () => {
  it("tables plugin registers its two ProseMirror plugins", () => {
    const { prosePlugins } = captureInit(tablesPlugin);
    expect(prosePlugins).toHaveLength(2);
  });

  it("status-bar plugin registers a statusbar overlay", () => {
    const { overlays } = captureInit(statusBarPlugin);
    expect(overlays).toHaveLength(1);
    expect((overlays[0] as any).mount).toBe("statusbar");
  });

  it("toc plugin registers an overlay", () => {
    const { overlays } = captureInit(tocPlugin);
    expect(overlays).toHaveLength(1);
  });

  it("loadPlugins wires status-bar and toc overlays into the collectors", async () => {
    const loaded = await loadPlugins(fakeEditor());
    const overlayIds = loaded.collectors.overlays.map((o) => o.id).sort();
    expect(overlayIds).toContain("status-bar");
    expect(overlayIds).toContain("toc");
  });
});
