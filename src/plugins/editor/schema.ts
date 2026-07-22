import { Schema } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";
import { tableNodes } from "prosemirror-tables";
import { diagramNodeSpec } from "../../lib/diagramNode";
import { slugify } from "../../lib/utils";
import type { SchemaContribution } from "../types";

/**
 * Builds the editor schema.
 *
 * Starts from the ProseMirror markdown base schema, applies the core Ink &
 * Quill customizations (paragraph/heading alignment, tables, images, gallery,
 * scribble, diagrams, extra marks) and then layers in any dynamic
 * contributions supplied by enabled plugins. This is what makes every plugin
 * able to own its own nodes/marks instead of them being hard-coded here.
 */
export function buildEditorSchema(extra?: SchemaContribution): Schema {
  let nodes = baseSchema.spec.nodes
    .update("paragraph", {
      content: "inline*",
      group: "block",
      attrs: { align: { default: "left" } },
      parseDOM: [
        {
          tag: "p",
          getAttrs: (dom: any) => ({
            align: dom.style.textAlign || "left",
          }),
        },
      ],
      toDOM(node) {
        const { align } = node.attrs;
        return ["p", { style: align && align !== "left" ? `text-align: ${align}` : null }, 0];
      },
    })
    .update("heading", {
      attrs: {
        level: { default: 1 },
        align: { default: "left" },
        id: { default: null },
      },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        {
          tag: "h1",
          getAttrs: (dom: any) => ({
            level: 1,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
        {
          tag: "h2",
          getAttrs: (dom: any) => ({
            level: 2,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
        {
          tag: "h3",
          getAttrs: (dom: any) => ({
            level: 3,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
        {
          tag: "h4",
          getAttrs: (dom: any) => ({
            level: 4,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
        {
          tag: "h5",
          getAttrs: (dom: any) => ({
            level: 5,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
        {
          tag: "h6",
          getAttrs: (dom: any) => ({
            level: 6,
            align: dom.style.textAlign || "left",
            id: dom.id || null,
          }),
        },
      ],
      toDOM(node) {
        const { level, align, id } = node.attrs;
        const autoId = id || (node.textContent ? slugify(node.textContent) : null);
        return [
          "h" + level,
          {
            id: autoId,
            style: align && align !== "left" ? `text-align: ${align}` : null,
          },
          0,
        ];
      },
    })
    .append(
      tableNodes({
        tableGroup: "block",
        cellContent: "block+",
        cellAttributes: {
          align: {
            default: "left",
            getFromDOM(dom) {
              return (dom as HTMLElement).style.textAlign || "left";
            },
            setDOMAttr(value, attrs) {
              if (value && value !== "left")
                attrs.style = (attrs.style || "") + `text-align: ${value};`;
            },
          },
          background: {
            default: null,
            getFromDOM(dom) {
              return (dom as HTMLElement).style.backgroundColor || null;
            },
            setDOMAttr(value, attrs) {
              if (value) attrs.style = (attrs.style || "") + `background-color: ${value};`;
            },
          },
          sort: {
            default: null,
            getFromDOM(dom) {
              return dom.getAttribute("data-sort") || null;
            },
            setDOMAttr(value, attrs) {
              if (value) attrs["data-sort"] = value;
            },
          },
        },
      }),
    )
    .update("image", {
      inline: true,
      group: "inline",
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        align: { default: "center" },
        width: { default: "100%" },
        float: { default: "none" },
      },
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs(dom: any) {
            return {
              src: dom.getAttribute("src"),
              title: dom.getAttribute("title"),
              alt: dom.getAttribute("alt"),
              align: dom.getAttribute("data-align") || "center",
              width: dom.style.width || "100%",
              float: dom.style.float || "none",
            };
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title, align, width, float } = node.attrs;
        return [
          "img",
          {
            src,
            alt,
            title,
            "data-align": align,
            style: `width: ${width}; float: ${float};`,
          },
        ];
      },
    })
    .append({
      gallery: {
        group: "block",
        content: "image*",
        attrs: {
          layout: { default: "grid" },
        },
        parseDOM: [
          {
            tag: "div.image-gallery",
            getAttrs: (dom: any) => ({
              layout: dom.getAttribute("data-layout") || "grid",
            }),
          },
        ],
        toDOM(node) {
          return ["div", { class: "image-gallery", "data-layout": node.attrs.layout }, 0];
        },
      },
      scribble: {
        group: "block",
        attrs: {
          data: { default: null },
          width: { default: "100%" },
          aspectRatio: { default: 0.5 },
        },
        draggable: true,
        selectable: true,
        parseDOM: [
          {
            tag: "div.scribble-block",
            getAttrs: (dom: any) => ({
              data: dom.getAttribute("data-scribble"),
              width: dom.style.width || "100%",
              aspectRatio: parseFloat(dom.getAttribute("data-aspect") || "0.5"),
            }),
          },
        ],
        toDOM(node) {
          return [
            "div",
            {
              class: "scribble-block",
              "data-scribble": node.attrs.data,
              "data-aspect": node.attrs.aspectRatio,
              style: `width: ${node.attrs.width}; position: relative;`,
            },
          ];
        },
      },
      diagram: diagramNodeSpec,
    });

  let marks = baseSchema.spec.marks.append({
    strike: {
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        { style: "text-decoration=line-through" },
      ],
      toDOM() {
        return ["s", 0];
      },
    },
    underline: {
      parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
      toDOM() {
        return ["u", 0];
      },
    },
  });

  // Apply plugin contributions (and core patches) dynamically.
  if (extra) {
    for (const [name, spec] of Object.entries(extra.patchNodes ?? {})) {
      if (nodes.get(name)) {
        nodes = nodes.update(name, { ...nodes.get(name), ...spec });
      }
    }
    for (const [name, spec] of Object.entries(extra.nodes ?? {})) {
      if (nodes.get(name)) {
        nodes = nodes.update(name, spec);
      } else {
        nodes = nodes.append({ [name]: spec });
      }
    }
    for (const [name, spec] of Object.entries(extra.patchMarks ?? {})) {
      if (marks.get(name)) {
        marks = marks.update(name, { ...marks.get(name), ...spec });
      }
    }
    for (const [name, spec] of Object.entries(extra.marks ?? {})) {
      if (marks.get(name)) {
        marks = marks.update(name, spec);
      } else {
        marks = marks.append({ [name]: spec });
      }
    }
  }

  return new Schema({ nodes, marks });
}
