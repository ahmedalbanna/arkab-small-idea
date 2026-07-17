import { Command } from "lucide-react";
import type { EditorCommand, InkPlugin, PluginContext } from "../types";
import { useAIUIStore } from "../../stores/aiUIStore";

/**
 * Core editing commands surfaced through the command palette (and any other
 * consumer of `context.commands`). Each command delegates to the editor's
 * command bus so the actual ProseMirror operation stays defined in one place
 * (the bus executor / `useFormatting`), avoiding a second implementation that
 * could drift from the toolbar and context menu.
 */
function formatCommand(
  id: string,
  label: string,
  format: string,
  key?: string,
): EditorCommand {
  return {
    id,
    label,
    key,
    run: (ctx: PluginContext) => {
      ctx.commandBus.dispatch({ type: "format", format });
      return true;
    },
  };
}

export const editorCommandsPlugin: InkPlugin = {
  id: "editorCommands",
  name: "Editor Commands",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    // Marks & inline formatting.
    ctx.registerCommand(formatCommand("bold", "Bold", "bold", "Mod-b"));
    ctx.registerCommand(formatCommand("italic", "Italic", "italic", "Mod-i"));
    ctx.registerCommand(
      formatCommand("underline", "Underline", "underline", "Mod-u"),
    );
    ctx.registerCommand(formatCommand("strike", "Strikethrough", "strike"));
    ctx.registerCommand(formatCommand("code", "Inline Code", "code", "Mod-e"));

    // Block types.
    ctx.registerCommand(formatCommand("h1", "Heading 1", "h1"));
    ctx.registerCommand(formatCommand("h2", "Heading 2", "h2"));
    ctx.registerCommand(formatCommand("h3", "Heading 3", "h3"));
    ctx.registerCommand(formatCommand("paragraph", "Paragraph", "paragraph"));
    ctx.registerCommand(formatCommand("bullet", "Bullet List", "bullet"));
    ctx.registerCommand(formatCommand("numbered", "Numbered List", "numbered"));
    ctx.registerCommand(formatCommand("quote", "Blockquote", "quote"));

    // Alignment.
    ctx.registerCommand(formatCommand("alignLeft", "Align Left", "alignLeft"));
    ctx.registerCommand(
      formatCommand("alignCenter", "Align Center", "alignCenter"),
    );
    ctx.registerCommand(formatCommand("alignRight", "Align Right", "alignRight"));
    ctx.registerCommand(
      formatCommand("alignJustify", "Justify", "alignJustify"),
    );

    // History — routed through the bus so undo/redo respects the recorded
    // command history (including plugin-driven mutations).
    ctx.registerCommand({
      id: "undo",
      label: "Undo",
      key: "Mod-z",
      run: (c) => {
        c.commandBus.undo();
        return true;
      },
    });
    ctx.registerCommand({
      id: "redo",
      label: "Redo",
      key: "Mod-y",
      run: (c) => {
        c.commandBus.redo();
        return true;
      },
    });

    // Toolbar entry that opens the command palette.
    ctx.registerToolbarItem({
      id: "command-palette",
      icon: Command,
      label: "Command Palette",
      group: "editor",
      onClick: () => {
        useAIUIStore.getState().setCommandPaletteOpen(true);
      },
    });
  },
};
