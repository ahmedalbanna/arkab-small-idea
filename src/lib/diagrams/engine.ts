import type { DiagramAdapter, DiagramRenderResult, RenderOptions } from "./types";
import { mermaidAdapter } from "./adapters/mermaid";
import { vegaLiteAdapter } from "./adapters/vega";
import { nomnomlAdapter } from "./adapters/nomnoml";
import { graphvizAdapter } from "./adapters/graphviz";
import { krokiFallbackAdapter } from "./adapters/krokiFallback";

/** All languages recognized as diagram sources. */
export const DIAGRAM_LANGS = [
  "mermaid",
  "plantuml",
  "graphviz",
  "ditaa",
  "erd",
  "blockdiag",
  "c4plantuml",
  "structurizr",
  "vega",
  "vegalite",
  "vega-lite",
  "bpmn",
  "d2",
  "nomnoml",
  "rackdiag",
  "seqdiag",
  "actdiag",
  "nwdiag",
] as const;

export type DiagramLang = (typeof DIAGRAM_LANGS)[number];

/**
 * Engines rendered locally in the browser. Everything else falls through to
 * the Kroki fallback adapter (see `krokiFallbackAdapter`).
 */
const LOCAL_ENGINES: Record<string, DiagramAdapter> = {
  mermaid: mermaidAdapter,
  vega: vegaLiteAdapter,
  "vega-lite": vegaLiteAdapter,
  vegalite: vegaLiteAdapter,
  nomnoml: nomnomlAdapter,
  graphviz: graphvizAdapter,
};

export function isDiagramLang(lang: string): boolean {
  return (DIAGRAM_LANGS as readonly string[]).includes(lang.toLowerCase().trim());
}

/**
 * Renders a diagram for the given language + source. Routing is local-first:
 * if a local engine exists it is used (no network), otherwise the request is
 * delegated to the Kroki fallback. The `theme` hint switches dark/light output.
 */
export function renderDiagram(
  lang: string,
  source: string,
  opts: RenderOptions,
): Promise<DiagramRenderResult> {
  const normalized = lang.toLowerCase().trim();
  const adapter = LOCAL_ENGINES[normalized] ?? krokiFallbackAdapter;
  return adapter(normalized, source, opts);
}
