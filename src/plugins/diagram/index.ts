import type { InkPlugin } from "../types";
import { createDiagramNodeView } from "../../lib/diagramNodeView";

export const diagramPlugin: InkPlugin = {
  id: "diagram",
  name: "Diagrams",
  version: "1.0.0",
  init(ctx) {
    ctx.registerNodeView({ name: "diagram", view: createDiagramNodeView() });
  },
};

export default diagramPlugin;
