import { describe, expect, it, vi } from "vitest";
import { editorCommandsPlugin } from "../plugins/editorCommands";
import type { EditorCommand, PluginContext } from "../plugins/types";
import { EditorCommandBus } from "../core/commands/commandBus";
import { createMockCommandBus, expectAuditEntry } from "./helpers/commandTestUtils";
import type { MockExecutor } from "./helpers/commandTestUtils";

interface BuildContextResult {
  ctx: PluginContext;
  commands: EditorCommand[];
  toolbarItems: unknown[];
  executor: MockExecutor;
  emitIntent: ReturnType<typeof vi.fn>;
  bus: EditorCommandBus;
}

function buildContext(): BuildContextResult {
  const commands: EditorCommand[] = [];
  const toolbarItems: unknown[] = [];
  const emitIntent = vi.fn();
  const { bus, executor } = createMockCommandBus({ audit: true });
  const ctx = {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    commandBus: bus,
    stores: {} as any,
    schema: {} as any,
    emitIntent,
    registerProsePlugin: () => {},
    registerNodeView: () => {},
    registerToolbarItem: (i: unknown) => toolbarItems.push(i),
    registerCommand: (c: EditorCommand) => commands.push(c),
    registerOverlay: () => {},
    registerSetting: () => {},
    registerHost: () => {},
    editorPlugins: [],
    nodeViews: {},
    toolbarItems,
    commands,
    settings: [],
  } as unknown as PluginContext;
  return { ctx, commands, toolbarItems, executor, emitIntent, bus };
}

describe("editorCommands plugin", () => {
  it("registers the expected editing commands", () => {
    const { ctx, commands } = buildContext();
    editorCommandsPlugin.init(ctx);
    const ids = commands.map((c) => c.id);
    for (const id of [
      "bold",
      "italic",
      "underline",
      "strike",
      "code",
      "h1",
      "h2",
      "h3",
      "paragraph",
      "bullet",
      "numbered",
      "quote",
      "alignLeft",
      "alignCenter",
      "alignRight",
      "alignJustify",
      "undo",
      "redo",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("registers a toolbar item that triggers the showCommandPalette intent", () => {
    const { ctx, toolbarItems, emitIntent } = buildContext();
    editorCommandsPlugin.init(ctx);
    const item = toolbarItems.find((i) => (i as any).id === "command-palette") as any;
    expect(item).toBeTruthy();
    expect(item.label).toBe("Command Palette");
    // Invoking it emits a UI intent instead of touching the store directly.
    item.onClick(ctx);
    expect(emitIntent).toHaveBeenCalledWith({ type: "showCommandPalette" });
  });

  it("formatting commands dispatch to the bus with the right format", () => {
    const { ctx, commands, executor, bus } = buildContext();
    editorCommandsPlugin.init(ctx);
    const bold = commands.find((c) => c.id === "bold")!;
    bold.run(ctx);
    expect(executor.run).toHaveBeenCalledWith({ type: "format", format: "bold" });
    expectAuditEntry(bus, {
      action: { type: "format", format: "bold" },
      source: "user:keyboard",
      success: true,
    });

    const numbered = commands.find((c) => c.id === "numbered")!;
    numbered.run(ctx);
    expect(executor.run).toHaveBeenCalledWith({ type: "format", format: "numbered" });
    expectAuditEntry(bus, {
      action: { type: "format", format: "numbered" },
      source: "user:palette",
      success: true,
    });
  });

  it("undo/redo commands dispatch action types to the bus", () => {
    const { ctx, commands, executor, bus } = buildContext();
    editorCommandsPlugin.init(ctx);
    commands.find((c) => c.id === "undo")!.run(ctx);
    expect(executor.run).toHaveBeenCalledWith({ type: "undo" });
    expectAuditEntry(bus, { action: { type: "undo" }, source: "user:keyboard", success: true });
    commands.find((c) => c.id === "redo")!.run(ctx);
    expect(executor.run).toHaveBeenCalledWith({ type: "redo" });
    expectAuditEntry(bus, { action: { type: "redo" }, source: "user:keyboard", success: true });
  });
});
