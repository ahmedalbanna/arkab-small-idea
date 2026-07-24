import { PenTool } from "lucide-react";
import type { NodeSpec } from "prosemirror-model";
import type { InkPlugin, PluginContext, SchemaContribution } from "../types";
import { createScribbleNodeView } from "../../lib/scribblePlugin";

/**
 * ProseMirror node spec for the `scribble` block.
 *
 * The node stores vector strokes (Stroke[]) in the `strokes` attribute for
 * resolution-independent rendering with per-stroke undo/redo.  Legacy documents
 * (pre-stroke-model) still carry a flattened base64 PNG in the `data` attribute;
 * the node renders it as a static background image behind any new strokes.
 *
 * The `aspectRatio` controls the SVG viewBox height relative to its container
 * width, and `width` sets the container width (default 100%).
 */
const scribbleNodeSpec: NodeSpec = {
  group: "block",
  attrs: {
    /** Legacy base64 PNG data URL (pre-stroke-model documents). */
    data: { default: null },
    strokes: { default: [] as import("../../lib/scribbleTypes").Stroke[] },
    width: { default: "100%" },
    aspectRatio: { default: 0.5 },
  },
  draggable: true,
  selectable: true,
  isolating: true,
  parseDOM: [
    {
      tag: "div.scribble-block",
      getAttrs: (dom: unknown) => {
        const el = dom as HTMLElement;
        let strokes: unknown[] = [];
        const strokesRaw = el.getAttribute("data-strokes");
        if (strokesRaw) {
          try {
            const parsed = JSON.parse(strokesRaw);
            if (Array.isArray(parsed)) strokes = parsed;
          } catch {
            // Malformed — fall back to empty strokes.
          }
        }
        return {
          data: el.getAttribute("data-scribble"),
          strokes,
          width: el.style.width || "100%",
          aspectRatio: parseFloat(el.getAttribute("data-aspect") || "0.5"),
        };
      },
    },
  ],
  toDOM(node) {
    const strokes: unknown = node.attrs.strokes;
    const attrs: Record<string, string> = {
      class: "scribble-block",
      "data-aspect": String(node.attrs.aspectRatio),
      style: `width: ${node.attrs.width}; position: relative;`,
    };
    if (node.attrs.data) attrs["data-scribble"] = node.attrs.data;
    if (Array.isArray(strokes) && strokes.length > 0) {
      attrs["data-strokes"] = JSON.stringify(strokes);
    }
    return ["div", attrs];
  },
};

export const scribblePlugin: InkPlugin = {
  id: "scribble",
  name: "Scribble",
  version: "1.0.0",

  getSchemaContribution(): SchemaContribution {
    return {
      nodes: {
        scribble: scribbleNodeSpec,
      },
    };
  },

  init(ctx: PluginContext) {
    // Register the custom node view for rendering the drawing canvas.
    ctx.registerNodeView({ name: "scribble", view: createScribbleNodeView() });

    // Register a command that inserts a new scribble block.
    // Accessible via the command palette and slash menu.
    ctx.registerCommand({
      id: "scribble.insert",
      label: "Insert Scribble",
      slash: true,
      run(api) {
        api.commandBus.dispatch({
          type: "insertNodeAt",
          nodeName: "scribble",
          attrs: { data: null, width: "100%", aspectRatio: 0.5 },
        });
        return true;
      },
    });

    // Register a toolbar item for the floating toolbar (desktop).
    ctx.registerToolbarItem({
      id: "scribble",
      icon: PenTool,
      label: "Scribble",
      group: "insert",
      onClick(api) {
        api.commandBus.dispatch({
          type: "insertNodeAt",
          nodeName: "scribble",
          attrs: { data: null, width: "100%", aspectRatio: 0.5 },
        });
      },
    });
  },
};

export default scribblePlugin;
