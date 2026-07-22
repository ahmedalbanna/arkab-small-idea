// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollabPlugin } from "../plugins/collab";
import type { PluginContext } from "../plugins/types";
import { PluginRegistry } from "../plugins/registry";

// BroadcastChannel isn't reliably present in the node test env, and we want to
// spy on `close` to prove the cleanup contract releases it.
class BroadcastChannelMock {
  static instances: BroadcastChannelMock[] = [];
  name: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor(name: string) {
    this.name = name;
    BroadcastChannelMock.instances.push(this);
  }
}

function makeMockContext(registered: unknown[]): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: (p: unknown) => registered.push(p),
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
    editorPlugins: [],
    nodeViews: {},
    toolbarItems: [],
    commands: [],
    settings: [],
  } as unknown as PluginContext;
}

describe("collab plugin (registry lifecycle)", () => {
  beforeEach(() => {
    BroadcastChannelMock.instances = [];
    vi.stubGlobal("BroadcastChannel", BroadcastChannelMock);
  });

  it("exposes registry-plugin metadata and is essential", () => {
    const plugin = createCollabPlugin({ docId: "doc-1", username: "Ada" });
    expect(plugin.id).toBe("collab");
    expect(plugin.name).toBe("Collaboration");
    expect(plugin.essential).toBe(true);
  });

  it("registers its ProseMirror plugins and allocates a channel on init", () => {
    const registered: unknown[] = [];
    const plugin = createCollabPlugin({ docId: "doc-1", username: "Ada" });
    plugin.init(makeMockContext(registered));

    // ySync, yCursor, yUndo, sectionTracking, keymap
    expect(registered).toHaveLength(5);
    expect(BroadcastChannelMock.instances).toHaveLength(1);
    expect(BroadcastChannelMock.instances[0].name).toBe("ink-quill-collab-doc-1");
  });

  it("closes the channel and releases Yjs resources on destroy (idempotent)", () => {
    const registered: unknown[] = [];
    const plugin = createCollabPlugin({ docId: "doc-2", username: "Lin" });
    plugin.init(makeMockContext(registered));

    const channel = BroadcastChannelMock.instances[0];
    plugin.destroy();

    expect(channel.close).toHaveBeenCalledTimes(1);
    // A second destroy (e.g. disable then teardown) must be safe.
    expect(() => plugin.destroy()).not.toThrow();
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it("runs through the registry lifecycle without leaking resources", async () => {
    const registry = new PluginRegistry();
    registry.register(createCollabPlugin({ docId: "doc-reg", username: "Reg" }));

    const registered: unknown[] = [];
    const ctx = makeMockContext(registered);
    await registry.initAll(async () => ({
      schema: {} as any,
      context: ctx,
    }));

    expect(registered).toHaveLength(5);

    // Teardown must close the channel and report no leaks.
    const leaked = registry.destroyAll();
    expect(leaked).toEqual([]);
    expect(BroadcastChannelMock.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when disabled (not registered by loadPlugins)", () => {
    // Sanity: a plugin built but never initialized allocates nothing.
    const plugin = createCollabPlugin({ docId: "doc-off" });
    expect(BroadcastChannelMock.instances).toHaveLength(0);
    // destroy before init must be safe.
    expect(() => plugin.destroy()).not.toThrow();
  });
});
