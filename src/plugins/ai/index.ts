import type { InkPlugin } from "../types";
import { AIHost } from "./AIHost";

/**
 * Owns the AI assistant, search dialog, semantic folders, TTS, and shortcuts
 * UI — previously inline in `App.tsx`. The host runs the AI/search side-effects
 * and renders the panels; shared state/handlers live in `aiUIStore` and
 * `handlers.ts` so the editor tree can read them too.
 */
export const aiPlugin: InkPlugin = {
  id: "ai",
  name: "AI Assistant & Search",
  version: "1.0.0",
  init(ctx) {
    ctx.registerHost(AIHost);
  },
};
