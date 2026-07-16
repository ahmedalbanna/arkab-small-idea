import type { Schema } from "prosemirror-model";
import { PluginRegistry } from "./registry";
import {
  buildPluginContext,
  createCollectors,
  type ContextCollectors,
} from "./context";
import { buildEditorSchema } from "./editor/schema";
import type { EditorAPI, InkPlugin, PluginContext, SchemaContribution } from "./types";

import { highlightPluginInstance } from "./highlight";
import { draftPlugin } from "./draft";
import { headingPlugin } from "./heading";
import { searchPlugin } from "./search";
import { mathPlugin } from "./math";
import { imagePlugin } from "./image";
import { scribblePlugin } from "./scribble";
import { diagramPlugin } from "./diagram";
import { tablesPlugin } from "./tables";
import { statusBarPlugin } from "./statusbar";
import { tocPlugin } from "./toc";
import { documentPlugin } from "./document";

/**
 * The active plugin set. As features are extracted into plugins (later
 * phases) they are registered here. Order does not matter — dependency
 * resolution handles initialization order.
 */
const pluginModules: InkPlugin[] = [
  // Editor ProseMirror plugins & node views (extracted in phase 1).
  highlightPluginInstance,
  draftPlugin,
  searchPlugin,
  headingPlugin,
  mathPlugin,
  imagePlugin,
  scribblePlugin,
  diagramPlugin,
  // UI plugins (overlays + table helpers).
  tablesPlugin,
  statusBarPlugin,
  tocPlugin,
  documentPlugin,
];

export interface LoadedPlugins {
  registry: PluginRegistry;
  collectors: ContextCollectors;
  context: PluginContext;
  schema: Schema;
  /** Resolve the final schema contributions actually used. */
  contributions: SchemaContribution;
}

/**
 * Registers all known plugins, collects their schema contributions, builds
 * the final schema, constructs the plugin context and initializes every
 * enabled plugin in dependency order.
 */
export async function loadPlugins(editor: EditorAPI): Promise<LoadedPlugins> {
  const registry = new PluginRegistry();
  for (const plugin of pluginModules) {
    registry.register(plugin);
  }

  const collectors = createCollectors();
  const contributions = await registry.collectSchemaContributions();
  const schema = buildEditorSchema(contributions);
  const context = buildPluginContext(schema, collectors, editor);

  await registry.initAll(async () => ({ schema, context }));

  return { registry, collectors, context, schema, contributions };
}

/** Convenience re-exports for consumers. */
export { PluginRegistry } from "./registry";
export { buildEditorSchema } from "./editor/schema";
export { buildPluginContext, createCollectors } from "./context";
export type {
  InkPlugin,
  PluginContext,
  EditorAPI,
  SchemaContribution,
  NodeViewRegistration,
  ToolbarItem,
  EditorCommand,
  PluginOverlay,
  PluginSettingDef,
} from "./types";
