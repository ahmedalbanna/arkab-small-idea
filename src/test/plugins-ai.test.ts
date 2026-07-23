import { describe, it, expect, vi } from "vitest";
import { aiPlugin } from "../plugins/ai";
import { AIHost } from "../plugins/ai/AIHost";
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
    emitIntent: () => {},
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

  it("registers AI editing commands in the command palette", () => {
    const commands: any[] = [];
    const ctx = { ...fakeContext(), registerCommand: (c: any) => commands.push(c) };
    aiPlugin.init(ctx);
    const ids = commands.map((c) => c.id);
    expect(ids).toContain("ai-improve");
    expect(ids).toContain("ai-fix-grammar");
    expect(ids).toContain("ai-summarize");
    expect(ids).toContain("ai-expand");
    expect(ids).toContain("ai-rewrite");
    // No slash commands should be registered by the ai plugin.
    expect(commands.every((c) => !c.slash)).toBe(true);
  });
});
