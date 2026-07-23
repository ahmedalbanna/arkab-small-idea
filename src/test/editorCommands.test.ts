import { describe, expect, it, vi } from "vitest";
import { editorCommandsPlugin } from "../plugins/editorCommands";
import type { EditorCommand, PluginContext } from "../plugins/types";
import { useAIUIStore } from "../stores/aiUIStore";

function buildContext() {
  const commands: EditorCommand[] = [];
  const toolbarItems: unknown[] = [];
  const dispatch = vi.fn();
  const commandBus = { dispatch, query: vi.fn() } as any;
  const ctx = {
    editor: { getView: () => null, isReady: () => false, focus: () => {} },
    commandBus,
    stores: {} as any,
    schema: {} as any,
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
  return { ctx, commands, toolbarItems, dispatch };
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

  it("registers a toolbar item that opens the palette", () => {
    const { ctx, toolbarItems } = buildContext();
    editorCommandsPlugin.init(ctx);
    const item = toolbarItems.find((i) => (i as any).id === "command-palette") as any;
    expect(item).toBeTruthy();
    expect(item.label).toBe("Command Palette");
    // Invoking it flips the palette open in the shared UI store.
    item.onClick(ctx);
    expect(useAIUIStore.getState().commandPaletteOpen).toBe(true);
    useAIUIStore.getState().setCommandPaletteOpen(false);
  });

  it("formatting commands dispatch to the bus with the right format", () => {
    const { ctx, commands, dispatch } = buildContext();
    editorCommandsPlugin.init(ctx);
    const bold = commands.find((c) => c.id === "bold")!;
    bold.run(ctx);
    expect(dispatch).toHaveBeenCalledWith({ type: "format", format: "bold" });

    const numbered = commands.find((c) => c.id === "numbered")!;
    numbered.run(ctx);
    expect(dispatch).toHaveBeenCalledWith({
      type: "format",
      format: "numbered",
    });
  });

  it("undo/redo commands dispatch action types to the bus", () => {
    const { ctx, commands, dispatch } = buildContext();
    editorCommandsPlugin.init(ctx);
    commands.find((c) => c.id === "undo")!.run(ctx);
    expect(dispatch).toHaveBeenCalledWith({ type: "undo" });
    commands.find((c) => c.id === "redo")!.run(ctx);
    expect(dispatch).toHaveBeenCalledWith({ type: "redo" });
  });
});
