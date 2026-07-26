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
function captureInit(plugin: { init?: (ctx: PluginContext) => void }) {
  const prosePlugins: unknown[] = [];
  const overlays: unknown[] = [];
  plugin.init?.({
    editor: fakeEditor() as any,
    commandBus: {} as any,
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: (p) => prosePlugins.push(p),
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: (o) => overlays.push(o),
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
  } as PluginContext);
  return { prosePlugins, overlays };
}

describe("UI plugin extraction", () => {
  it("tables plugin registers its two ProseMirror plugins", () => {
    const { prosePlugins } = captureInit(tablesPlugin);
    expect(prosePlugins).toHaveLength(2);
  });

  it("status-bar plugin registers a visibility setting (no overlay — BottomBar is part of AppShell)", () => {
    const { overlays } = captureInit(statusBarPlugin);
    expect(overlays).toHaveLength(0);
  });

  it("status-bar plugin registers its visibility setting", () => {
    const settings: any[] = [];
    const ctx = {
      ...({} as any),
      editor: fakeEditor(),
      stores: {} as any,
      schema: {} as any,
      registerProsePlugin: () => {},
      registerNodeView: () => {},
      registerToolbarItem: () => {},
      registerCommand: () => {},
      registerOverlay: () => {},
      registerSetting: (s: any) => settings.push(s),
      registerHost: () => {},
      emitIntent: () => {},
      editorPlugins: [] as any[],
      nodeViews: {} as any,
      toolbarItems: [] as any[],
      commands: [] as any[],
      settings: [] as any[],
    };
    statusBarPlugin.init(ctx as any);
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      pluginId: "status-bar",
      key: "visible",
      type: "toggle",
    });
  });

  it("toc plugin is a no-op stub (overlay removed)", () => {
    const { overlays } = captureInit(tocPlugin);
    expect(overlays).toHaveLength(0);
  });

  it("loadPlugins collectors no longer include toc overlay", async () => {
    const loaded = await loadPlugins(fakeEditor());
    const overlayIds = loaded.collectors.overlays.map((o) => o.id).sort();
    expect(overlayIds).not.toContain("toc");
  });
});
