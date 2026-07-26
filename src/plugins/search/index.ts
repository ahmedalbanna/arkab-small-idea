import type { InkPlugin } from "../types";
import { createSearchPlugin, searchPluginKey } from "../../lib/searchPlugin";

export { searchPluginKey };

export const searchPlugin: InkPlugin = {
  id: "search",
  name: "Search",
  version: "1.0.0",
  init(ctx) {
    ctx.registerProsePlugin(createSearchPlugin(ctx.ragService), searchPluginKey);
  },
};

export default searchPlugin;
