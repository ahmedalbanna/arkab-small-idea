import type { DiagramAdapter } from "../types";

function firstLine(message: string, fallback: string): string {
  if (!message) return fallback;
  const line = message.split("\n")[0];
  return line.trim() || fallback;
}

export const vegaLiteAdapter: DiagramAdapter = async (lang, source, opts) => {
  try {
    const spec = JSON.parse(source);

    // Detect whether this is a Vega-Lite spec or a raw Vega spec.
    const isVegaLite =
      !spec.$schema ||
      /vega-lite/.test(spec.$schema) ||
      (!spec.marks && (spec.mark || spec.encoding));

    let vgSpec: any;
    if (isVegaLite) {
      const vl = await import("vega-lite");
      vgSpec = (vl as any).compile(spec).spec;
    } else {
      vgSpec = spec;
    }

    const vega = await import("vega");
    const runtime = (vega as any).parse(vgSpec);
    const view = new (vega as any).View(runtime, { renderer: "none" });
    const svg = await view.toSVG();
    return { ok: true, svg, engine: "vega" };
  } catch (e: any) {
    return {
      ok: false,
      error: firstLine(e?.message, "Invalid Vega / Vega-Lite spec."),
      engine: "vega",
    };
  }
};
