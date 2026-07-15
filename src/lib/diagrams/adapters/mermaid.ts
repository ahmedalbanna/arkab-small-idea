import type { DiagramAdapter } from "../types";

let mermaidMod: typeof import("mermaid") | null = null;
let lastTheme: string | null = null;

function firstLine(message: string, fallback: string): string {
  if (!message) return fallback;
  const line = message.split("\n")[0];
  return line.trim() || fallback;
}

export const mermaidAdapter: DiagramAdapter = async (lang, source, opts) => {
  try {
    if (!mermaidMod) {
      mermaidMod = await import("mermaid");
    }
    const mermaid = (mermaidMod as any).default ?? mermaidMod;
    const themeName = opts.theme === "dark" ? "dark" : "default";
    if (lastTheme !== themeName) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: themeName,
        fontFamily: "inherit",
      });
      lastTheme = themeName;
    }
    const id = "mermaid-" + Math.random().toString(36).slice(2, 10);
    const { svg } = await mermaid.render(id, source);
    return { ok: true, svg, engine: "mermaid" };
  } catch (e: any) {
    return { ok: false, error: firstLine(e?.message, "Invalid Mermaid syntax."), engine: "mermaid" };
  }
};
