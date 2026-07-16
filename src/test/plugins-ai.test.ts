import { describe, it, expect, vi } from "vitest";
import { aiPlugin } from "../plugins/ai";
import { AIHost } from "../plugins/ai/AIHost";
import type { PluginContext } from "../plugins/types";

function fakeContext(): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    stores: {} as any,
    schema: {} as any,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: () => {},
    registerCommand: () => {},
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
    editorPlugins: [],
    nodeViews: {},
  };
}

describe("ai plugin", () => {
  it("registers the AI host that renders the assistant/search UI", () => {
    const registerHost = vi.fn();
    const ctx = { ...fakeContext(), registerHost };
    aiPlugin.init(ctx);
    expect(registerHost).toHaveBeenCalledWith(AIHost);
  });

  it("has stable metadata", () => {
    expect(aiPlugin.id).toBe("ai");
    expect(aiPlugin.name).toContain("AI");
  });
});
