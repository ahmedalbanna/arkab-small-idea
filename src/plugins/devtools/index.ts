/**
 * Developer Tools Plugin — InkPlugin for inspecting the editor's command bus
 * and registered commands at runtime.
 *
 * Dev-only. The plugin is registered in `buildPluginModules()` but only
 * renders its overlay when `import.meta.env.DEV` is true. In production this
 * file is still imported (tree-shaking may eliminate the overlay component
 * bundle) but the overlay's `show` predicate returns `false`, so it never
 * renders.
 */
import React from "react";
import type { InkPlugin, PluginContext, EditorCommand } from "../types";
import { CommandInspector } from "./commandInspector";

// ---------------------------------------------------------------------------
// Module-level state — shared between the plugin and the overlay component
// ---------------------------------------------------------------------------

/** The inspector instance, created during `init()`. */
let _inspector: CommandInspector | null = null;

/** Whether the inspector panel is currently visible. */
let _inspectorOpen = false;

// ---------------------------------------------------------------------------
// Public API (imported by CommandInspectorPanel and app shell)
// ---------------------------------------------------------------------------

/** Get the singleton inspector instance. */
export function getInspector(): CommandInspector | null {
  return _inspector;
}

/** Whether the inspector panel is open. */
export function isInspectorOpen(): boolean {
  return _inspectorOpen;
}

/** Show or hide the inspector panel. */
export function setInspectorOpen(open: boolean): void {
  _inspectorOpen = open;
}

/** Toggle the inspector panel visibility. */
export function toggleInspector(): void {
  _inspectorOpen = !_inspectorOpen;
}

// ---------------------------------------------------------------------------
// devtoolsPlugin — InkPlugin
// ---------------------------------------------------------------------------

export const devtoolsPlugin: InkPlugin = {
  id: "devtools",
  name: "Developer Tools",
  version: "1.0.0",

  init(ctx: PluginContext) {
    // Create the inspector with just the bus (commands are populated later).
    _inspector = new CommandInspector(ctx.commandBus);

    // Register the "dev:inspect" command to toggle the inspector panel.
    ctx.registerCommand({
      id: "dev:inspect",
      label: "Open Command Inspector",
      key: "Mod-Shift-i",
      slash: false,
      run: () => {
        toggleInspector();
        return true;
      },
    });

    // Register the overlay that renders the inspector panel.
    // Uses React.lazy + dynamic import so the component module (with PanelSlot
    // and other heavy deps) is only fetched when the overlay is actually shown.
    ctx.registerOverlay({
      id: "command-inspector",
      component: React.lazy(() =>
        import("../../components/devtools/CommandInspectorPanel").then((mod) => ({
          default: mod.CommandInspectorPanel,
        })),
      ),
      mount: "sidebar",
      show: () => import.meta.env.DEV && _inspectorOpen,
    });

    // Tag our own commands as "plugin" source so the inspector can display it.
    _inspector?.setCommandSource("dev:inspect", "plugin");
  },

  destroy() {
    _inspector = null;
    _inspectorOpen = false;
  },
};
