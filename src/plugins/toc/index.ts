import type { InkPlugin } from "../types";

/**
 * Placeholder — Table of Contents has been removed. Kept as a stub so that
 * `buildPluginModules` doesn't break if anything references `tocPlugin`.
 * Remove entirely when the plugin set is cleaned up.
 */
export const tocPlugin: InkPlugin = {
  id: "toc",
  name: "Table of Contents",
  version: "1.0.0",
  init(_ctx) {
    // no-op
  },
};
