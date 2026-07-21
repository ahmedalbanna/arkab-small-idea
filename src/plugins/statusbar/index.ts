import type { InkPlugin } from "../types";

/**
 * Status Bar visibility setting.
 *
 * The BottomBar component (rendered by AppShell) now handles both desktop
 * status-bar and mobile toolbar duties.  This plugin keeps the Appearance
 * toggle so users can continue controlling visibility.
 */
export const statusBarPlugin: InkPlugin = {
  id: "status-bar",
  name: "Status Bar",
  version: "1.0.0",
  init(ctx) {
    ctx.registerSetting({
      pluginId: "status-bar",
      key: "visible",
      label: "Show status bar",
      type: "toggle",
      defaultValue: true,
      group: "Appearance",
    });
  },
};
