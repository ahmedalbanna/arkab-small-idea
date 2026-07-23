/**
 * Editor UI Plugin — Aggregation Wrapper
 *
 * This module re-exports a single `editorUIPlugin` that delegates to three
 * focused sub-plugins so consumers that import from `./editorUI` continue
 * to work without changes.
 *
 * The sub-plugins have been extracted (Sprint 3) into separate modules:
 * - `editorMenus`        — hover side menu, context menu, bubble menu
 * - `editorActiveFormats` — active formatting marks/block-types tracking
 * - `editorTTSHighlight`  — TTS highlight decorations
 *
 * If only a subset of these features is needed, import the sub-plugin
 * directly instead of this wrapper.
 */

import type { InkPlugin, PluginContext } from "../types";
import { editorMenusPlugin } from "../editorMenus";
import { editorActiveFormatsPlugin } from "../editorActiveFormats";
import { editorTTSHighlightPlugin } from "../editorTTSHighlight";

/** Aggregate plugin that runs all three editor-UI sub-plugins. */
export const editorUIPlugin: InkPlugin = {
  id: "editorUI",
  name: "Editor UI",
  version: "1.0.0",
  essential: true,
  init(ctx: PluginContext) {
    editorMenusPlugin.init(ctx);
    editorActiveFormatsPlugin.init(ctx);
    editorTTSHighlightPlugin.init(ctx);
  },
};

/** Re-export sub-plugins for consumers that want granular control. */
export { editorMenusPlugin } from "../editorMenus";
export { editorActiveFormatsPlugin } from "../editorActiveFormats";
export { editorTTSHighlightPlugin } from "../editorTTSHighlight";
