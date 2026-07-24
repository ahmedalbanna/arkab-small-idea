import { describe, it, expect } from "vitest";
import { buildEditorSchema } from "../plugins/editor/schema";

describe("buildEditorSchema", () => {
  it("produces the core Ink & Quill schema without contributions", () => {
    const schema = buildEditorSchema();

    // Core custom nodes (scribble is now contributed by the scribble plugin)
    for (const name of [
      "paragraph",
      "heading",
      "image",
      "gallery",
      "diagram",
      "table",
      "table_row",
      "table_cell",
      "table_header",
    ]) {
      expect(schema.nodes[name], `node "${name}" should exist`).toBeTruthy();
    }

    // Core custom marks
    expect(schema.marks["strike"]).toBeTruthy();
    expect(schema.marks["underline"]).toBeTruthy();

    // Patched attrs
    expect(schema.nodes["paragraph"]!.spec.attrs).toHaveProperty("align");
    expect(schema.nodes["heading"]!.spec.attrs).toHaveProperty("id");
    expect(schema.nodes["heading"]!.spec.attrs).toHaveProperty("align");
  });

  it("appends a contributed node dynamically", () => {
    const schema = buildEditorSchema({
      nodes: {
        callout: {
          group: "block",
          content: "inline*",
          attrs: { tone: { default: "info" } },
          toDOM: () => ["div", 0],
          parseDOM: [{ tag: "div.callout" }],
        } as any,
      },
    });
    expect(schema.nodes["callout"]).toBeTruthy();
    expect(schema.nodes["callout"]!.spec.attrs).toHaveProperty("tone");
    // Core nodes still present
    expect(schema.nodes["image"]).toBeTruthy();
  });

  it("appends a contributed mark dynamically", () => {
    const schema = buildEditorSchema({
      marks: {
        highlight: {
          toDOM: () => ["mark", 0],
          parseDOM: [{ tag: "mark" }],
        } as any,
      },
    });
    expect(schema.marks["highlight"]).toBeTruthy();
  });

  it("patches an existing node spec", () => {
    const schema = buildEditorSchema({
      patchNodes: {
        paragraph: {
          attrs: { align: { default: "left" }, rtl: { default: false } },
        } as any,
      },
    });
    expect(schema.nodes["paragraph"]!.spec.attrs).toHaveProperty("rtl");
  });

  it("replaces an existing node spec entirely when a full spec is given", () => {
    const schema = buildEditorSchema({
      nodes: {
        image: {
          inline: true,
          group: "inline",
          attrs: { src: {} },
          toDOM: () => ["img", 0],
          parseDOM: [{ tag: "img[src]" }],
        } as any,
      },
    });
    expect(schema.nodes["image"]!.spec.attrs).toHaveProperty("src");
    // original extra attrs removed by replacement
    expect(schema.nodes["image"]!.spec.attrs).not.toHaveProperty("align");
  });
});
