import type { DiagramAdapter } from "../types";

function firstLine(message: string, fallback: string): string {
  if (!message) return fallback;
  const line = message.split("\n")[0];
  return line.trim() || fallback;
}

export const graphvizAdapter: DiagramAdapter = async (_lang, source, _opts) => {
  try {
    const mod = await import("@hpcc-js/wasm");
    const graphviz = await (mod as any).Graphviz.load();
    const svg = graphviz.layout(source, "svg", "dot");
    return { ok: true, svg, engine: "graphviz" };
  } catch (e: any) {
    return {
      ok: false,
      error: firstLine(e?.message, "Invalid Graphviz source."),
      engine: "graphviz",
    };
  }
};
