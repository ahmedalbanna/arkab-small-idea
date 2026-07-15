import type { InkPlugin } from "../types";
import { StatusBar } from "../../components/layout/StatusBar";

/**
 * Renders the bottom status bar. The component is self-contained (it reads
 * the active page and embedding state from stores), so this plugin only has
 * to register it as an overlay.
 */
export const statusBarPlugin: InkPlugin = {
  id: "status-bar",
  name: "Status Bar",
  version: "1.0.0",
  init(ctx) {
    ctx.registerOverlay({
      id: "status-bar",
      component: StatusBar,
      mount: "statusbar",
    });
  },
};
