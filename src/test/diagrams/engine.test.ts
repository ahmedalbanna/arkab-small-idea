import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/diagrams/adapters/mermaid", () => ({
  mermaidAdapter: vi.fn(async () => ({ ok: true, svg: "<svg/>", engine: "mermaid" })),
}));

vi.mock("../../lib/diagrams/adapters/krokiFallback", () => ({
  krokiFallbackAdapter: vi.fn(async () => ({ ok: true, svg: "<svg kroki/>", engine: "kroki" })),
}));

import { renderDiagram, isDiagramLang, DIAGRAM_LANGS } from "../../lib/diagrams/engine";
import type { DiagramFailure } from "../../lib/diagrams/types";

describe("renderDiagram routing", () => {
  it("recognizes diagram languages case-insensitively", () => {
    expect(isDiagramLang("Mermaid")).toBe(true);
    expect(isDiagramLang("vega-lite")).toBe(true);
    expect(isDiagramLang("js")).toBe(false);
  });

  it("exposes the supported languages", () => {
    expect(DIAGRAM_LANGS).toContain("mermaid");
    expect(DIAGRAM_LANGS).toContain("plantuml");
    expect(DIAGRAM_LANGS).toContain("graphviz");
    expect(DIAGRAM_LANGS).toContain("nomnoml");
  });

  it("routes a local engine (mermaid) to its own adapter", async () => {
    const result = await renderDiagram("mermaid", "graph TD;A-->B", { theme: "light" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.engine).toBe("mermaid");
  });

  it("routes an engine without a local renderer to the Kroki fallback", async () => {
    const result = await renderDiagram("plantuml", "@startuml\nA->B\n@enduml", {
      theme: "dark",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.engine).toBe("kroki");
  });

  it("normalizes adapter errors into a failure result", async () => {
    // Force the mermaid adapter mock to fail for this case.
    const { mermaidAdapter } = await import("../../lib/diagrams/adapters/mermaid");
    (mermaidAdapter as any).mockImplementationOnce(async () => ({
      ok: false,
      error: "bad syntax",
      engine: "mermaid",
    }));
    const result = await renderDiagram("mermaid", "%%%", { theme: "light" });
    expect(result.ok).toBe(false);
    expect((result as DiagramFailure).error).toBe("bad syntax");
  });
});
