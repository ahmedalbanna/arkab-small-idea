import type { NodeSpec } from "prosemirror-model";

/**
 * A dedicated block node for diagrams. The source lives in `attrs.source`
 * (not as editable text), which lets the NodeView fully own the editing UX.
 * Markdown round-trips to a fenced code block via the editor serializer.
 */
export const diagramNodeSpec: NodeSpec = {
  group: "block",
  attrs: {
    lang: { default: "" },
    source: { default: "" },
  },
  leaf: true,
  selectable: true,
  draggable: true,
  isolating: true,
  parseDOM: [
    {
      tag: "div.diagram-block",
      getAttrs(dom: any) {
        return {
          lang: dom.getAttribute("data-lang") || "",
          source: dom.getAttribute("data-source") || "",
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "div",
      {
        class: "diagram-block",
        "data-lang": node.attrs.lang,
        "data-source": node.attrs.source,
      },
    ];
  },
};
