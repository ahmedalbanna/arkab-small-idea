import { describe, it, expect } from "vitest";
import { Z_LAYERS, Z_CSS_VAR, Z_CLASS, type ZLayer } from "../lib/zIndex";

describe("Z_LAYERS", () => {
  it("contains all expected layers", () => {
    const expected: ZLayer[] = [
      "base",
      "above",
      "sticky",
      "floating",
      "panel",
      "overlay",
      "modal",
      "editorMenu",
      "command",
    ];
    expect(Object.keys(Z_LAYERS)).toEqual(expected);
  });

  it("has all values >= 0", () => {
    for (const value of Object.values(Z_LAYERS)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("has no duplicate values (no collisions)", () => {
    const values = Object.values(Z_LAYERS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("has values in strictly ascending order", () => {
    const entries = Object.entries(Z_LAYERS) as [ZLayer, number][];
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i][1]).toBeGreaterThan(entries[i - 1][1]);
    }
  });
});

describe("Z_CSS_VAR", () => {
  it("has an entry for every layer", () => {
    expect(Object.keys(Z_CSS_VAR)).toEqual(Object.keys(Z_LAYERS));
  });

  it("produces valid CSS var() references", () => {
    for (const [key, value] of Object.entries(Z_CSS_VAR)) {
      expect(value).toBe(`var(--z-${key})`);
    }
  });
});

describe("Z_CLASS", () => {
  it("has an entry for every layer", () => {
    expect(Object.keys(Z_CLASS)).toEqual(Object.keys(Z_LAYERS));
  });

  it("produces valid Tailwind arbitrary value class names", () => {
    for (const [key, value] of Object.entries(Z_CLASS)) {
      expect(value).toBe(`z-[var(--z-${key})]`);
    }
  });
});
