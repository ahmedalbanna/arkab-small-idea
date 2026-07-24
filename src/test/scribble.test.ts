import { describe, it, expect } from "vitest";
import { buildEditorSchema } from "../plugins/editor/schema";
import { scribblePlugin } from "../plugins/scribble";
import type { SchemaContribution } from "../plugins/types";
import { strokeToPathD, distanceToStroke, hitTestStrokes, type Stroke } from "../lib/scribbleTypes";
import { serializeScribble, scribbleTokenGetAttrs } from "../core/serialization/scribbleTokens";

// ---------------------------------------------------------------------------
// Helper: build a schema that includes the scribble node
// ---------------------------------------------------------------------------
async function scribbleSchema() {
  const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
  return buildEditorSchema(contribution);
}

// ---------------------------------------------------------------------------
// strokeToPathD
// ---------------------------------------------------------------------------
describe("strokeToPathD", () => {
  it("returns empty string for zero points", () => {
    expect(strokeToPathD([])).toBe("");
  });

  it("produces a dot circle for a single point", () => {
    const d = strokeToPathD([[50, 100]]);
    expect(d).toContain("M 50");
    expect(d).toContain("a 1 1 0 1 0 2 0");
  });

  it("produces an M/L polyline for multiple points", () => {
    const d = strokeToPathD([
      [0, 0],
      [10, 20],
      [30, 40],
    ]);
    expect(d).toBe("M 0 0 L 10 20 L 30 40");
  });
});

// ---------------------------------------------------------------------------
// distanceToStroke
// ---------------------------------------------------------------------------
describe("distanceToStroke", () => {
  const stroke: Stroke = {
    id: "s1",
    color: "#000",
    width: 3,
    mode: "draw",
    points: [
      [0, 0],
      [100, 0],
    ],
  };

  it("returns 0 for a point exactly on the segment", () => {
    expect(distanceToStroke([50, 0], stroke)).toBeCloseTo(0, 5);
  });

  it("returns correct distance for a point above the segment", () => {
    expect(distanceToStroke([50, 10], stroke)).toBeCloseTo(10, 5);
  });

  it("returns correct distance for a point near an endpoint", () => {
    const d = distanceToStroke([110, 5], stroke);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(12);
  });

  it("returns Infinity for an empty stroke", () => {
    const empty: Stroke = { id: "e", color: "#000", width: 1, mode: "draw", points: [] };
    expect(distanceToStroke([0, 0], empty)).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// hitTestStrokes
// ---------------------------------------------------------------------------
describe("hitTestStrokes", () => {
  const strokes: Stroke[] = [
    {
      id: "a",
      color: "#000",
      width: 3,
      mode: "draw",
      points: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      id: "b",
      color: "#f00",
      width: 5,
      mode: "draw",
      points: [
        [0, 100],
        [100, 100],
      ],
    },
  ];

  it("finds the closest stroke within threshold", () => {
    expect(hitTestStrokes([50, 5], strokes, 10)).toBe("a");
  });

  it("returns null when no stroke is within threshold", () => {
    expect(hitTestStrokes([50, 50], strokes, 10)).toBeNull();
  });

  it("finds the second stroke", () => {
    expect(hitTestStrokes([50, 95], strokes, 10)).toBe("b");
  });

  it("returns null for empty strokes array", () => {
    expect(hitTestStrokes([0, 0], [], 10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Markdown round-trip
// ---------------------------------------------------------------------------
describe("scribble markdown round-trip", () => {
  it("serializes a scribble node with strokes and parses it back", async () => {
    const schema = (await scribbleSchema()).nodes;

    const strokes: Stroke[] = [
      {
        id: "s1",
        color: "#000000",
        width: 3,
        mode: "draw",
        points: [
          [10, 20],
          [30, 40],
        ],
      },
    ];

    // Build a node, serialize to markdown.
    const node = schema.scribble.create({
      data: null,
      width: "100%",
      aspectRatio: 0.5,
      strokes,
    });
    const doc = schema.doc.create({}, [node]);

    // Serialize via the shared function.
    let serialized = "";
    const fakeState = {
      write: (s: string) => {
        serialized += s;
      },
      text: (_t: string) => {},
      ensureNewLine: () => {},
      closeBlock: (_n: unknown) => {},
      renderInline: (_n: unknown) => {},
      renderContent: (_n: unknown) => {},
    };
    serializeScribble(fakeState as any, node);
    expect(serialized).toContain("```scribble");
    expect(serialized).toContain("aspect: 0.5");
    expect(serialized).toContain("strokes:");
    expect(serialized).toContain('"s1"');
    expect(serialized).toContain("```");

    // Parse the serialized markdown using the token's getAttrs.
    const content = serialized.replace("```scribble\n", "").replace("\n```\n", "").trim();
    const attrs = scribbleTokenGetAttrs({ content });
    expect(attrs.aspectRatio).toBe(0.5);
    expect(Array.isArray(attrs.strokes)).toBe(true);
    expect((attrs.strokes as any[]).length).toBe(1);
    expect((attrs.strokes as any[])[0].id).toBe("s1");
    expect((attrs.strokes as any[])[0].points).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("does not emit a strokes: line when strokes is empty", async () => {
    const schema = (await scribbleSchema()).nodes;
    const node = schema.scribble.create({
      data: null,
      width: "100%",
      aspectRatio: 0.5,
      strokes: [],
    });
    const doc = schema.doc.create({}, [node]);

    let serialized = "";
    const fakeState = {
      write: (s: string) => {
        serialized += s;
      },
      text: (_t: string) => {},
      ensureNewLine: () => {},
      closeBlock: (_n: unknown) => {},
      renderInline: (_n: unknown) => {},
      renderContent: (_n: unknown) => {},
    };
    serializeScribble(fakeState as any, node);
    expect(serialized).toContain("```scribble");
    expect(serialized).toContain("aspect: 0.5");
    expect(serialized).not.toContain("strokes:");
    expect(serialized).not.toContain("data:image");
  });

  it("parses legacy format (only data:image, no strokes)", () => {
    const content = "aspect: 0.5\ndata:image/png;base64,iVBORw0KGgo=";
    const attrs = scribbleTokenGetAttrs({ content });
    expect(attrs.aspectRatio).toBe(0.5);
    expect(attrs.data).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(attrs.strokes).toEqual([]);
  });

  it("parses entries with both strokes and legacy data", () => {
    const content =
      'aspect: 0.3\nstrokes: [{"id":"x","color":"#00f","width":5,"mode":"draw","points":[[0,0],[1,1]]}]\ndata:image/png;base64,abc==';
    const attrs = scribbleTokenGetAttrs({ content });
    expect(attrs.aspectRatio).toBe(0.3);
    expect(attrs.data).toBe("data:image/png;base64,abc==");
    const strokes = attrs.strokes as any[];
    expect(strokes).toHaveLength(1);
    expect(strokes[0].id).toBe("x");
  });

  it("gracefully handles malformed JSON in strokes line", () => {
    const content = "aspect: 0.5\nstrokes: {not-json}";
    const attrs = scribbleTokenGetAttrs({ content });
    expect(attrs.strokes).toEqual([]);
    expect(attrs.aspectRatio).toBe(0.5);
  });
});
