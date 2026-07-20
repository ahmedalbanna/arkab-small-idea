// @vitest-environment node
import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { history } from "prosemirror-history";
import { schema as baseSchema } from "prosemirror-markdown";
import {
  insertText,
  insertImage,
  setMarkdown,
  appendMarkdown,
  replaceSelectionWithMarkdown,
  streamMarkdown,
  applyFormat,
  getSelectedText,
  getHeadings,
  getCursorContext,
  getHtml,
  applyUndo,
  applyRedo,
} from "@core/operations";
import { serializeDoc, createMarkdownIO } from "@core/serialization/markdown";
import type { Schema } from "prosemirror-model";

const schema: Schema = baseSchema;
const io = createMarkdownIO(schema);

function paragraphDoc(text: string) {
  return schema.node("doc", null, [
    schema.node("paragraph", null, text ? [schema.text(text)] : []),
  ]);
}

function atEnd(doc: import("prosemirror-model").Node) {
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.atEnd(doc),
    plugins: [history()],
  });
}

describe("operations/text", () => {
  it("insertText inserts before (and after) at the selection", () => {
    let state = atEnd(paragraphDoc("Hello"));
    const result = insertText(state, " world", "!");
    state = state.apply(result.tr);
    expect(state.doc.textContent).toBe("Hello world!");
  });

  it("insertImage creates an image node", () => {
    let state = atEnd(paragraphDoc(""));
    const result = insertImage(state, schema, "img.png", "alt", "title");
    state = state.apply(result.tr);
    let img: import("prosemirror-model").Node | null = null;
    state.doc.descendants((n) => {
      if (n.type.name === "image") {
        img = n;
        return false;
      }
      return true;
    });
    expect(img).toBeTruthy();
    expect(img!.attrs.src).toBe("img.png");
  });

  it("does not declare an inverse (native history undoes inserts)", () => {
    const state = atEnd(paragraphDoc("Hello"));
    expect(insertText(state, "x").inverse).toBeUndefined();
  });
});

describe("operations/markdown", () => {
  it("setMarkdown replaces the whole document and records an inverse", () => {
    let state = atEnd(paragraphDoc("old"));
    const { tr, inverse } = setMarkdown(state, "# Title\n\nBody", io);
    expect(inverse).toEqual({ type: "setMarkdown", content: "old" });
    state = state.apply(tr);
    expect(getHeadings(state).map((h) => h.text)).toContain("Title");
  });

  it("round-trips markdown through setMarkdown", () => {
    let state = atEnd(paragraphDoc(""));
    const md = "# Heading\n\nSome **bold** and *em* text.";
    state = state.apply(setMarkdown(state, md, io).tr);
    const serialized = serializeDoc(state.doc);
    expect(serialized).toContain("Heading");
    // Re-parse the serialized output and confirm structure is stable.
    const state2 = state.apply(setMarkdown(state, serialized, io).tr);
    expect(getHeadings(state2).map((h) => h.text)).toEqual(["Heading"]);
  });

  it("appendMarkdown appends to the end", () => {
    let state = atEnd(paragraphDoc("A"));
    state = state.apply(appendMarkdown(state, "\n\nB", io).tr);
    expect(state.doc.textContent).toContain("A");
    expect(state.doc.textContent).toContain("B");
  });

  it("replaceSelectionWithMarkdown replaces the selection only", () => {
    const doc = paragraphDoc("Keep REPLACE Keep");
    const sel = TextSelection.create(doc, 6, 13); // "REPLACE"
    let state = EditorState.create({ schema, doc, selection: sel });
    state = state.apply(
      replaceSelectionWithMarkdown(state, "**NEW**", io).tr,
    );
    expect(state.doc.textContent).toBe("Keep NEW Keep");
  });

  it("streamMarkdown replaces the given range", () => {
    let state = atEnd(paragraphDoc("prefix suffix"));
    // replace range that currently holds "prefix " (trailing space included)
    const range = { from: 1, to: 8 };
    state = state.apply(streamMarkdown(state, "STREAMED", io, range).tr);
    expect(state.doc.textContent).toBe("STREAMEDsuffix");
  });
});

describe("operations/format", () => {
  it("applies bold to the selection", () => {
    const doc = paragraphDoc("Hello");
    const sel = TextSelection.create(doc, 1, 6);
    let state = EditorState.create({ schema, doc, selection: sel });
    const tr = applyFormat(state, "bold", schema, io);
    expect(tr).not.toBeNull();
    state = state.apply(tr!);
    const textNode = state.doc.firstChild!.firstChild!;
    expect(textNode.marks.some((m) => m.type.name === "strong")).toBe(true);
  });

  it("applies heading level 1", () => {
    const doc = paragraphDoc("Title");
    const sel = TextSelection.create(doc, 1, 6);
    let state = EditorState.create({ schema, doc, selection: sel });
    state = state.apply(applyFormat(state, "h1", schema, io)!);
    expect(state.doc.firstChild!.type.name).toBe("heading");
    expect(state.doc.firstChild!.attrs.level).toBe(1);
  });

  it("applies bullet list", () => {
    const doc = paragraphDoc("item");
    const sel = TextSelection.create(doc, 1, 5);
    let state = EditorState.create({ schema, doc, selection: sel });
    state = state.apply(applyFormat(state, "bullet", schema, io)!);
    expect(state.doc.firstChild!.type.name).toBe("bullet_list");
  });

  it("returns null for an unknown format", () => {
    const state = atEnd(paragraphDoc("x"));
    expect(applyFormat(state, "nope", schema, io)).toBeNull();
  });
});

describe("operations/query", () => {
  it("getSelectedText returns the selected text", () => {
    const doc = paragraphDoc("Hello world");
    const sel = TextSelection.create(doc, 1, 6); // "Hello"
    const state = EditorState.create({ schema, doc, selection: sel });
    expect(getSelectedText(state)).toBe("Hello");
  });

  it("getHeadings returns heading metadata", () => {
    let state = atEnd(paragraphDoc(""));
    state = state.apply(setMarkdown(state, "# One\n\n## Two", io).tr);
    const headings = getHeadings(state);
    expect(headings.map((h) => [h.text, h.level])).toEqual([
      ["One", 1],
      ["Two", 2],
    ]);
    expect(headings[0].id).toBeTruthy();
  });

  it("getCursorContext reflects the block under the cursor", () => {
    let state = atEnd(paragraphDoc(""));
    state = state.apply(setMarkdown(state, "# Section\n\ncursor here", io).tr);

    // Cursor inside the heading text -> the heading is both the current block
    // and the (only) ancestor in the path.
    const inHeading = EditorState.create({
      schema,
      doc: state.doc,
      selection: TextSelection.create(state.doc, 4),
    });
    const ctxHeading = getCursorContext(inHeading);
    expect(ctxHeading).toContain("Section");
    expect(ctxHeading).toContain("Path: Section");

    // Cursor inside the body paragraph -> current block is "cursor here".
    const inPara = EditorState.create({
      schema,
      doc: state.doc,
      selection: TextSelection.create(state.doc, state.doc.content.size - 1),
    });
    expect(getCursorContext(inPara)).toContain("cursor here");
  });
});

describe("operations/html", () => {
  it("getHtml throws without a DOM environment", () => {
    const state = atEnd(paragraphDoc("Hi"));
    expect(() => getHtml(state, schema)).toThrow(/DOM environment/);
  });
});

describe("operations/history", () => {
  it("applyUndo reverts an insertion", () => {
    let state = atEnd(paragraphDoc("Hello"));
    const before = state.doc.textContent;
    state = state.apply(insertText(state, "!!!").tr);
    expect(state.doc.textContent).toBe("Hello!!!");
    const undoTr = applyUndo(state);
    expect(undoTr).not.toBeNull();
    state = state.apply(undoTr!);
    expect(state.doc.textContent).toBe(before);
  });

  it("applyRedo re-applies an undone insertion", () => {
    let state = atEnd(paragraphDoc("Hello"));
    state = state.apply(insertText(state, "!!!").tr);
    state = state.apply(applyUndo(state)!);
    const redoTr = applyRedo(state);
    expect(redoTr).not.toBeNull();
    state = state.apply(redoTr!);
    expect(state.doc.textContent).toBe("Hello!!!");
  });
});
