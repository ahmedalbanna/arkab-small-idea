import type { InkPlugin } from "../types";
import { highlightPlugin } from "../../components/prose-highlight";

export const highlightPluginInstance: InkPlugin = {
  id: "highlight",
  name: "Syntax Highlight",
  version: "1.0.0",
  init(ctx) {
    ctx.registerProsePlugin(highlightPlugin);
  },
};

export default highlightPluginInstance;
