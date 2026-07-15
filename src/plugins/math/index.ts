import type { InkPlugin } from "../types";
import { createMathPlugin } from "../../lib/mathPlugin";

export const mathPlugin: InkPlugin = {
  id: "math",
  name: "Math (KaTeX)",
  version: "1.0.0",
  init(ctx) {
    ctx.registerProsePlugin(createMathPlugin());
  },
};

export default mathPlugin;
