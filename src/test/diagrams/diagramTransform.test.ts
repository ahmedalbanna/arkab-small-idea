import { describe, it, expect } from "vitest";
import { Schema } from "prosemirror-model";
import { diagramNodeSpec } from "../../lib/diagramNode";
import { diagramTransform } from "../../lib/markdown/diagramTransform";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
    code_block: {
      group: "block",
      content: "text*",
      code: true,
      attrs: { params: { default: "" } },
      toDOM: () => ["pre", ["code", 0]],
      parseDOM: [{ tag: "pre" }],
    },
    diagram: diagramNodeSpec,
  },
});

describe("diagramTransform", () => {
  it("converts a diagram-language code_block into a diagram node", () => {
    const cb = schema.nodes.code_block.create(
      { params: "mermaid" },
      schema.text("graph TD;\nA-->B"),
    );
    const doc = schema.nodes.doc.create(null, cb);

    const out = diagramTransform(doc);
    const child = out.firstChild!;

    expect(child.type.name).toBe("diagram");
    expect(child.attrs.lang).toBe("mermaid");
    expect(child.attrs.source).toBe("graph TD;\nA-->B");
  });

  it("is case-insensitive about the language", () => {
    const cb = schema.nodes.code_block.create(
      { params: "MERMAID" },
      schema.text("A-->B"),
    );
    const out = diagramTransform(schema.nodes.doc.create(null, cb));
    expect(out.firstChild!.type.name).toBe("diagram");
  });

  it("leaves non-diagram code blocks untouched", () => {
    const cb = schema.nodes.code_block.create(
      { params: "javascript" },
      schema.text("const x = 1;"),
    );
    const out = diagramTransform(schema.nodes.doc.create(null, cb));
    expect(out.firstChild!.type.name).toBe("code_block");
  });

  it("converts multiple diagram blocks", () => {
    const a = schema.nodes.code_block.create({ params: "mermaid" }, schema.text("A-->B"));
    const b = schema.nodes.code_block.create({ params: "plantuml" }, schema.text("@startuml\n@enduml"));
    const out = diagramTransform(schema.nodes.doc.create(null, [a, b]));
    expect(out.childCount).toBe(2);
    expect(out.child(0).type.name).toBe("diagram");
    expect(out.child(1).type.name).toBe("diagram");
    expect(out.child(1).attrs.lang).toBe("plantuml");
  });

  it("returns the same doc when there is nothing to convert", () => {
    const p = schema.nodes.paragraph.create(null, schema.text("hello"));
    const doc = schema.nodes.doc.create(null, p);
    expect(diagramTransform(doc)).toBe(doc);
  });
});
