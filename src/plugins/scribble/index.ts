import type { InkPlugin } from "../types";
import { createScribbleNodeView } from "../../lib/scribblePlugin";

export const scribblePlugin: InkPlugin = {
  id: "scribble",
  name: "Scribble",
  version: "1.0.0",
  init(ctx) {
    ctx.registerNodeView({ name: "scribble", view: createScribbleNodeView() });
  },
};

export default scribblePlugin;
