import type { InkPlugin } from "../types";
import { TableOfContentsOverlay } from "./TableOfContentsOverlay";

/**
 * Renders the document outline (table of contents). The overlay resolves the
 * active editor through `AppApi` and hands it to the existing component, so
 * no app-level prop drilling is required.
 */
export const tocPlugin: InkPlugin = {
  id: "toc",
  name: "Table of Contents",
  version: "1.0.0",
  init(ctx) {
    ctx.registerOverlay({
      id: "toc",
      component: TableOfContentsOverlay,
      mount: "overlay",
    });
  },
};
