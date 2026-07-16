import type { Plugin, PluginKey } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import type { ComponentType } from "react";
import type { NodeViewConstructor } from "prosemirror-view";
import { useEditorStore } from "../stores/editorStore";
import { useUIStore } from "../stores/uiStore";
import { useAIStore } from "../stores/aiStore";
import { useSettingsStore } from "../stores/settingsStore";
import type {
  EditorAPI,
  NodeViewRegistration,
  PluginContext,
  PluginOverlay,
  PluginSettingDef,
  SchemaContribution,
  ToolbarItem,
  EditorCommand,
} from "./types";

/**
 * Mutable collectors that plugins push into during `init`. After all plugins
 * have initialized, the editor consumes these to assemble its final state.
 */
export interface ContextCollectors {
  prosePlugins: { plugin: Plugin | (() => Plugin); key?: PluginKey }[];
  nodeViews: NodeViewRegistration[];
  toolbarItems: ToolbarItem[];
  commands: EditorCommand[];
  overlays: PluginOverlay[];
  settings: PluginSettingDef[];
  /** App-level React host components that run plugin hooks/effects. */
  hosts: ComponentType<any>[];
}

export function createCollectors(): ContextCollectors {
  return {
    prosePlugins: [],
    nodeViews: [],
    toolbarItems: [],
    commands: [],
    overlays: [],
    settings: [],
    hosts: [],
  };
}

/**
 * Builds the `PluginContext` handed to each plugin. The schema is final at
 * this point; registration hooks simply append to the shared collectors so
 * the host (editor + app shell) can materialize them after `initAll`.
 */
export function buildPluginContext(
  schema: Schema,
  collectors: ContextCollectors,
  editor: EditorAPI,
): PluginContext {
  const stores = {
    editor: useEditorStore,
    ui: useUIStore,
    ai: useAIStore,
    settings: useSettingsStore,
  };

  return {
    editor,
    stores,
    schema,
    registerProsePlugin(plugin, key) {
      collectors.prosePlugins.push({ plugin, key });
    },
    registerNodeView(reg) {
      collectors.nodeViews.push(reg);
    },
    registerToolbarItem(item) {
      collectors.toolbarItems.push(item);
    },
    registerCommand(cmd) {
      collectors.commands.push(cmd);
    },
    registerOverlay(overlay) {
      collectors.overlays.push(overlay);
    },
    registerSetting(setting) {
      collectors.settings.push(setting);
    },
    registerHost(host) {
      collectors.hosts.push(host);
    },
    // Populated by `loadPlugins` after all plugins have initialized.
    editorPlugins: [],
    nodeViews: {},
    toolbarItems: [],
    commands: [],
    settings: [],
  };
}

/** Helper to merge several schema contributions into one. */
export function mergeSchemaContributions(
  contributions: SchemaContribution[],
): SchemaContribution {
  return contributions.reduce<SchemaContribution>(
    (acc, c) => ({
      nodes: { ...acc.nodes, ...c.nodes },
      marks: { ...acc.marks, ...c.marks },
      patchNodes: { ...acc.patchNodes, ...c.patchNodes },
      patchMarks: { ...acc.patchMarks, ...c.patchMarks },
    }),
    { nodes: {}, marks: {}, patchNodes: {}, patchMarks: {} },
  );
}
