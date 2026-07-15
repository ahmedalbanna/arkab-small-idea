// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Schema } from "prosemirror-model";
import { diagramNodeSpec } from "../../lib/diagramNode";
import { createDiagramNodeView } from "../../lib/diagramNodeView";

vi.mock("../../lib/diagrams/engine", () => ({
  renderDiagram: vi.fn(async () => ({
    ok: true,
    svg: "<svg data-testid='rendered'></svg>",
    engine: "mermaid",
  })),
  isDiagramLang: () => true,
  DIAGRAM_LANGS: [],
}));

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
    diagram: diagramNodeSpec,
  },
});

/** Minimal stand-in for EditorView so we don't boot a full ProseMirror view. */
function makeFakeView() {
  let committed: { pos: number; source: string } | null = null;
  const tr = {
    setNodeAttribute: (pos: number, _key: string, val: string) => {
      committed = { pos, source: val };
      return tr;
    },
  };
  const view = {
    state: { tr },
    dispatch: () => {},
  } as any;
  return { view, getCommitted: () => committed };
}

describe("DiagramNodeView (click-to-edit)", () => {
  let node: any;
  let fake: ReturnType<typeof makeFakeView>;
  let nv: any;

  beforeEach(() => {
    node = schema.nodes.diagram.create({
      lang: "mermaid",
      source: "graph TD;\nA-->B",
    });
    fake = makeFakeView();
    const Ctor = createDiagramNodeView();
    nv = Ctor(node, fake.view, () => 5);
  });

  afterEach(() => {
    nv?.destroy();
  });

  it("renders the preview via the engine", async () => {
    expect(nv.dom.classList.contains("diagram-block")).toBe(true);
    await new Promise((r) => setTimeout(r, 200));
    expect(nv.dom.querySelector("svg[data-testid='rendered']")).not.toBeNull();
  });

  it("opens an inline editor when the preview is clicked", async () => {
    await new Promise((r) => setTimeout(r, 200));
    const preview = nv.dom.querySelector(".diagram-preview");
    const editor = nv.dom.querySelector(".diagram-editor");

    expect(editor.classList.contains("is-active")).toBe(false);
    preview.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(editor.classList.contains("is-active")).toBe(true);
    expect(editor.value).toBe("graph TD;\nA-->B");
  });

  it("commits edited source and collapses on Escape", async () => {
    await new Promise((r) => setTimeout(r, 200));
    const preview = nv.dom.querySelector(".diagram-preview");
    const editor = nv.dom.querySelector(".diagram-editor");

    preview.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    editor.value = "graph TD;\nC-->D";
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    // Allow the debounced commit (350ms) to fire.
    await new Promise((r) => setTimeout(r, 500));
    expect(fake.getCommitted()?.source).toBe("graph TD;\nC-->D");

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(editor.classList.contains("is-active")).toBe(false);
  });

  it("shows an error message when the engine fails", async () => {
    const { renderDiagram } = await import("../../lib/diagrams/engine");
    (renderDiagram as any).mockImplementationOnce(async () => ({
      ok: false,
      error: "boom",
      engine: "mermaid",
    }));
    // Trigger a re-render with the failing engine.
    nv.dom
      .querySelector(".diagram-preview")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    nv.dom.querySelector(".diagram-editor").value = "broken";
    nv.dom
      .querySelector(".diagram-editor")
      .dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));

    const err = nv.dom.querySelector(".diagram-error");
    expect(err).not.toBeNull();
    expect(err.textContent).toBe("boom");
  });
});
