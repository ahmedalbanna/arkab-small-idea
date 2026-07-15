import type { DiagramAdapter } from "../types";

function firstLine(message: string, fallback: string): string {
  if (!message) return fallback;
  const line = message.split("\n")[0];
  return line.trim() || fallback;
}

export const nomnomlAdapter: DiagramAdapter = async (lang, source, opts) => {
  try {
    const mod = await import("nomnoml");
    const nomnoml = (mod as any).default ?? mod;
    const svg = nomnoml.render(source);
    return { ok: true, svg, engine: "nomnoml" };
  } catch (e: any) {
    return {
      ok: false,
      error: firstLine(e?.message, "Invalid nomnoml source."),
      engine: "nomnoml",
    };
  }
};
