import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import type { NodeViewConstructor } from "prosemirror-view";
import { PluginRegistry } from "./registry";
import {
  buildPluginContext,
  createCollectors,
  type ContextCollectors,
} from "./context";
import { buildEditorSchema } from "./editor/schema";
import type { EditorAPI, InkPlugin, PluginContext, SchemaContribution } from "./types";
import { defaultEditorCommandBus } from "./editorCommandBus";

import { corePlugin } from "./core";
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
import { editorUIPlugin } from "./editorUI";
import { editorCommandsPlugin } from "./editorCommands";
import { aiPlugin } from "./ai";
import { createCollabPlugin, type CollabPluginOptions } from "./collab";
import { validateDisabledPlugins } from "./pluginToggleMigration";

/**
 * The active plugin set. As features are extracted into plugins (later
 * phases) they are registered here. Returned from a function (not a constant
 * array) so dev hot-reload picks up new module exports — each call re-reads the
 * live `InkPlugin` bindings. Order does not matter — dependency resolution
 * handles initialization order, except `corePlugin` which is intentionally
 * first so its base editor plugins lead the plugin list.
 */
export function buildPluginModules(): InkPlugin[] {
  return [
    // Core editor ProseMirror plugins (history, keymaps, input rules, ...).
    corePlugin,
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
    editorUIPlugin,
    editorCommandsPlugin,
    aiPlugin,
  ];
}

/**
 * Dev-only hot-reload signaling. When any plugin module is hot-updated by Vite,
 * `notifyPluginsChanged` wakes the editor loader so it rebuilds the plugin set
 * and the ProseMirror view without a full page reload. No-op outside dev/HMR.
 */
const pluginReloadListeners = new Set<() => void>();

export function onPluginsChanged(listener: () => void): () => void {
  pluginReloadListeners.add(listener);
  return () => {
    pluginReloadListeners.delete(listener);
  };
}

export function notifyPluginsChanged(): void {
  pluginReloadListeners.forEach((l) => l());
}

if (import.meta.hot && import.meta.env.DEV) {
  // Accept updates to any plugin entry module so editing a plugin's code (or
  // its deps) triggers a targeted editor rebuild instead of a full page reload.
  import.meta.hot.accept(
    [
      "./core",
      "./highlight",
      "./draft",
      "./heading",
      "./search",
      "./math",
      "./image",
      "./scribble",
      "./diagram",
      "./tables",
      "./statusbar",
      "./toc",
      "./document",
      "./editorUI",
      "./ai",
      "./collab",
    ],
    () => {
      notifyPluginsChanged();
    },
  );
}

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
export async function loadPlugins(
  editor: EditorAPI,
  options?: {
    disabled?: string[];
    collab?: CollabPluginOptions;
    commandBus?: import("./editorCommandBus").EditorCommandBus;
  },
): Promise<LoadedPlugins> {
  const registry = new PluginRegistry();

  // Collaboration is registered (when enabled) ahead of the static plugin set
  // so its ProseMirror plugins (ySync, yCursor, yUndo, keymap) lead the editor
  // plugin list — matching the previous ordering where collab was prepended
  // inline. This also routes its setup/teardown through the registry lifecycle.
  if (options?.collab?.enabled) {
    registry.register(createCollabPlugin(options.collab));
  }

  for (const plugin of buildPluginModules()) {
    registry.register(plugin);
  }

  // Apply the persisted enable/disable state, dropping ids that aren't part of
  // the live registry so stale/removed/renamed plugins can't break startup.
  const disabled = new Set(
    validateDisabledPlugins(options?.disabled, registry),
  );
  for (const plugin of buildPluginModules()) {
    plugin.enabled = !disabled.has(plugin.id);
  }

  const collectors = createCollectors();
  const contributions = await registry.collectSchemaContributions();
  const schema = buildEditorSchema(contributions);
  const context = buildPluginContext(
    schema,
    collectors,
    editor,
    options?.commandBus ?? defaultEditorCommandBus,
  );

  await registry.initAll(async () => ({ schema, context }));

  // Resolve the collected contributions into the concrete ProseMirror plugins
  // and node-view map the editor consumes.
  context.editorPlugins = collectors.prosePlugins.map((entry) =>
    typeof entry.plugin === "function" ? entry.plugin() : entry.plugin,
  ) as Plugin[];
  context.nodeViews = Object.fromEntries(
    collectors.nodeViews.map((n) => [n.name, n.view as NodeViewConstructor]),
  ) as Record<string, NodeViewConstructor>;

  // Surface the resolved UI contributions so the app shell renders them.
  context.toolbarItems = collectors.toolbarItems;
  context.commands = collectors.commands;
  context.settings = collectors.settings;

  return { registry, collectors, context, schema, contributions };
}

/** Metadata for every known plugin, for building the Settings UI. */
export function getPluginList(): {
  id: string;
  name: string;
  essential: boolean;
}[] {
  return buildPluginModules().map((p) => ({
    id: p.id,
    name: p.name,
    essential: !!p.essential,
  }));
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
