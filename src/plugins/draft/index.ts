import type { InkPlugin } from "../types";
import { draftHighlightPlugin } from "../../lib/draftPlugin";

export const draftPlugin: InkPlugin = {
  id: "draft",
  name: "AI Draft Highlight",
  version: "1.0.0",
  init(ctx) {
    ctx.registerProsePlugin(draftHighlightPlugin);
  },
};

export default draftPlugin;
