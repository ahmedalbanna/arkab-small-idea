/**
 * Shared scribble markdown serialization / parse-token config.
 *
 * Both the core `editorSerializer` (__core/serialization/markdown.ts__) and the
 * React-side `useMarkdownSerializer` (__components/editor/hooks__) need the
 * same scribble fence-code handlers.  This module is the single source of truth
 * so the two sites never drift apart.
 */
import type { Node } from "prosemirror-model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

// ---------------------------------------------------------------------------
// Markdown format
// ---------------------------------------------------------------------------
//
// ```scribble
// aspect: 0.5
// strokes: [{"id":"…","color":"#000","width":3,"mode":"draw","points":[[10,20],[30,40]]}]
// data:image/png;base64,…   ← only present for legacy (pre-stroke-model) documents
// ```

/**
 * Serialize a scribble node into a fenced code block.
 * Designed to be passed as the `scribble` entry in a `MarkdownSerializer` node map.
 */
export function serializeScribble(state: MarkdownSerializerState, node: Node): void {
  state.write("\n```scribble\n");
  state.write(`aspect: ${node.attrs.aspectRatio}\n`);

  const strokes: unknown = node.attrs.strokes;
  if (Array.isArray(strokes) && strokes.length > 0) {
    // Compact JSON — no extra whitespace.
    state.write(`strokes: ${JSON.stringify(strokes)}\n`);
  }

  // Legacy background image (pre-stroke-model documents).
  if (node.attrs.data) {
    state.write(`${node.attrs.data}\n`);
  }

  state.write("```\n");
}

/**
 * Parser token `getAttrs` callback.
 * Extracts `aspectRatio`, `strokes` (parsed from JSON), and legacy `data` from a
 * scribble fenced-code token.
 *
 * Designed to be used in a token map like:
 * ```ts
 * tokens.scribble = { block: "scribble", getAttrs: scribbleTokenGetAttrs };
 * ```
 */
export function scribbleTokenGetAttrs(tok: { content: string }): Record<string, unknown> {
  const lines = tok.content.split("\n");

  const aspectLine = lines.find((l: string) => l.startsWith("aspect:"));
  const strokesLine = lines.find((l: string) => l.startsWith("strokes:"));
  const dataLine = lines.find((l: string) => l.startsWith("data:image"));

  let strokes: unknown[] = [];
  if (strokesLine) {
    try {
      const raw = strokesLine.slice("strokes:".length).trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) strokes = parsed;
    } catch {
      // Malformed JSON — silently fall back to empty strokes.
    }
  }

  return {
    data: dataLine || null,
    aspectRatio: aspectLine ? parseFloat(aspectLine.split(":")[1]) : 0.5,
    strokes,
  };
}
