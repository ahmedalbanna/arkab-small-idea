import type { InkPlugin } from "../types";
import { createHeadingPlugin } from "../../lib/headingPlugin";

export const headingPlugin: InkPlugin = {
  id: "heading",
  name: "Headings (collapsible)",
  version: "1.0.0",
  init(ctx) {
    ctx.registerProsePlugin(createHeadingPlugin());
  },
};

export default headingPlugin;
