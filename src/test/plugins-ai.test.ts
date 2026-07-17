import { describe, it, expect, vi } from "vitest";
import { aiPlugin } from "../plugins/ai";
import { AIHost } from "../plugins/ai/AIHost";
import { useAIUIStore } from "../stores/aiUIStore";
import type { PluginContext } from "../plugins/types";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";

function fakeContext(): PluginContext {
  return {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    commandBus: defaultEditorCommandBus,
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
    toolbarItems: [],
    commands: [],
    settings: [],
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

  it("registers the 'ai-ask' slash command that opens the popover", () => {
    const commands: any[] = [];
    const ctx = { ...fakeContext(), registerCommand: (c: any) => commands.push(c) };
    aiPlugin.init(ctx);
    const ask = commands.find((c) => c.id === "ai-ask");
    expect(ask).toBeDefined();
    expect(ask.slash).toBe(true);
    useAIUIStore.setState({ showAiPopover: false });
    const open = vi.spyOn(useAIUIStore.getState(), "setShowAiPopover");
    ask.run({} as any);
    expect(open).toHaveBeenCalledWith(true);
  });
});
