import type { DiagramAdapter } from "../types";
import { getKrokiUrl } from "../../kroki";

/**
 * Fallback adapter for engines that have no viable pure-browser renderer
 * (plantuml, ditaa, erd, blockdiag, c4plantuml, structurizr, d2, rackdiag,
 * seqdiag, actdiag, nwdiag, bpmn). Renders through the external Kroki service.
 */
export const krokiFallbackAdapter: DiagramAdapter = async (lang, source, opts) => {
  const url = getKrokiUrl(lang, source, opts.theme);
  if (!url) {
    return {
      ok: false,
      error: "Unsupported diagram type and no fallback available.",
      engine: "kroki",
    };
  }
  try {
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) {
      return {
        ok: false,
        error: `Diagram service returned ${res.status}.`,
        engine: "kroki",
      };
    }
    const svg = await res.text();
    if (!svg.trim().startsWith("<")) {
      return {
        ok: false,
        error: "Diagram service returned an invalid response.",
        engine: "kroki",
      };
    }
    return { ok: true, svg, engine: "kroki" };
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    return {
      ok: false,
      error: "Could not reach diagram service (are you offline?).",
      engine: "kroki",
    };
  }
};
