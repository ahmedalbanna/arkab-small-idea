import type { InkPlugin } from "../types";
import { StatusBar } from "../../components/layout/StatusBar";
import { useSettingsStore } from "../../stores/settingsStore";

/**
 * Renders the bottom status bar. The component is self-contained (it reads
 * the active page and embedding state from stores), so this plugin only has
 * to register it as an overlay and contribute its visibility setting.
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

    ctx.registerOverlay({
      id: "status-bar",
      component: StatusBar,
      mount: "statusbar",
      show: () =>
        useSettingsStore.getState().pluginSettings["status-bar.visible"] !== false,
    });
  },
};
