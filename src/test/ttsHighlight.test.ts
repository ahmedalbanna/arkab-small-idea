import { describe, it, expect } from "vitest";
import { EditorState, Plugin } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import { withTestPlugin } from "./helpers/pluginTestUtils";
import { editorTTSHighlightPlugin } from "../plugins/editorTTSHighlight";
import { buildTTSSegments, mapCharIndexToDocPosition, type TTSSegment } from "../components/ttsMapping";

function getDecorations(state: EditorState): DecorationSet {
  const plugin = state.plugins[0] as Plugin;
  return plugin.props.decorations!.call(plugin, state) as DecorationSet;
}

describe("editorTTSHighlightPlugin", () => {
  function createState(bench: Awaited<ReturnType<typeof withTestPlugin>>) {
    const schema = bench.context.schema;
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("hello world foo bar")),
    ]);
    const prosePlugin = bench.contributions.prosePlugins[0].plugin;
    const plugin = typeof prosePlugin === "function" ? prosePlugin() : prosePlugin;
    return EditorState.create({ doc, schema, plugins: [plugin] });
  }

  it("renders a decoration for the given range", async () => {
    const bench = await withTestPlugin(editorTTSHighlightPlugin);
    let state = createState(bench);

    const tr = state.tr.setMeta("ttsHighlight", { from: 1, to: 6 });
    state = state.apply(tr);

    const decos = getDecorations(state);
    expect(decos).toBeDefined();
    const found = decos.find(1, 6);
    expect(found.length).toBe(1);

    bench.destroy();
  });

  it("clears the decoration when range is null", async () => {
    const bench = await withTestPlugin(editorTTSHighlightPlugin);
    let state = createState(bench);

    state = state.apply(state.tr.setMeta("ttsHighlight", { from: 1, to: 6 }));
    state = state.apply(state.tr.setMeta("ttsHighlight", null));

    const decos = getDecorations(state);
    const found = decos.find(0, state.doc.content.size);
    expect(found.length).toBe(0);

    bench.destroy();
  });

  it("clamps out-of-bounds ranges to the document size", async () => {
    const bench = await withTestPlugin(editorTTSHighlightPlugin);
    let state = createState(bench);

    const size = state.doc.content.size;
    state = state.apply(state.tr.setMeta("ttsHighlight", { from: -5, to: size + 100 }));

    const decos = getDecorations(state);
    const found = decos.find(0, size);
    expect(found.length).toBe(1);
    expect(found[0].from).toBe(0);
    expect(found[0].to).toBe(size);

    bench.destroy();
  });

  it("preserves an empty decoration set across unrelated transactions", async () => {
    const bench = await withTestPlugin(editorTTSHighlightPlugin);
    let state = createState(bench);

    state = state.apply(state.tr.setMeta("ttsHighlight", { from: 1, to: 6 }));
    // A transaction with no ttsHighlight meta should map the existing set forward.
    state = state.apply(state.tr);

    const decos = getDecorations(state);
    const found = decos.find(1, 6);
    expect(found.length).toBe(1);

    bench.destroy();
  });
});

describe("buildTTSSegments", () => {
  it("computes cumulative indices with a joining space between segments", () => {
    const { segments, fullText } = buildTTSSegments([
      { text: "hello", pos: 1 },
      { text: "world", pos: 10 },
    ]);

    expect(fullText).toBe("hello world");
    expect(segments[0].cumulativeIndex).toBe(0);
    expect(segments[1].cumulativeIndex).toBe(6); // "hello".length + 1
  });
});

describe("mapCharIndexToDocPosition", () => {
  const segments: TTSSegment[] = [
    { text: "hello world", pos: 1, cumulativeIndex: 0 },
    { text: "foo bar", pos: 20, cumulativeIndex: 12 },
  ];

  it("maps a charIndex within the first segment", () => {
    const range = mapCharIndexToDocPosition(segments, 6); // "world" starts at index 6
    expect(range).toEqual({ from: 7, to: 12 });
  });

  it("maps a charIndex at the start of the second segment", () => {
    const range = mapCharIndexToDocPosition(segments, 12); // "foo" starts of segment 2
    expect(range).toEqual({ from: 20, to: 23 });
  });

  it("maps a charIndex mid-way through the second segment", () => {
    const range = mapCharIndexToDocPosition(segments, 16); // "bar" in "foo bar"
    expect(range).toEqual({ from: 24, to: 27 });
  });

  it("falls back to a single-character range for non-word boundaries", () => {
    const punctuationSegments: TTSSegment[] = [{ text: "hi, there", pos: 1, cumulativeIndex: 0 }];
    const range = mapCharIndexToDocPosition(punctuationSegments, 2); // the comma
    expect(range).toEqual({ from: 3, to: 4 });
  });

  it("clamps to the last segment when charIndex exceeds the tracked text length", () => {
    // Mirrors the original component logic: the last segment has no "next"
    // boundary, so any charIndex at or beyond it is treated as part of it.
    const range = mapCharIndexToDocPosition(segments, 999);
    expect(range).not.toBeNull();
    expect(range!.from).toBeGreaterThan(segments[1].pos);
  });
});
