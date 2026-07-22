import type { Plugin, PluginKey } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import type { ComponentType } from "react";
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
import type { EditorCommandBus } from "./editorCommandBus";
import { pluginLogger } from "./logger";
import {
  editorCommandSchema,
  toolbarItemSchema,
  pluginOverlaySchema,
  pluginSettingSchema,
  nodeViewRegistrationSchema,
  formatIssues,
} from "./contributionSchemas";

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
 * Validate a plugin contribution against its Zod schema. On failure, emit a
 * structured error (attributed to the plugin currently initializing, if known)
 * and skip the contribution so one malformed item can't break editor startup.
 * On success, push it into the collector.
 */
function validateAndCollect<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: any[] } } },
  kind: string,
  value: unknown,
  collector: T[],
  ctx: PluginContext,
): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    const pluginId = (ctx as { pluginId?: string }).pluginId;
    pluginLogger.error(pluginId ?? "*", "contribution:invalid", `Invalid ${kind} contribution`, {
      kind,
      id: (value as { id?: string })?.id,
      issues: formatIssues(result.error.issues),
    });
    return;
  }
  collector.push(value as T);
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
  commandBus: EditorCommandBus,
): PluginContext {
  const stores = {
    editor: useEditorStore,
    ui: useUIStore,
    ai: useAIStore,
    settings: useSettingsStore,
  };

  // Declared with `let` so the registration hooks (defined inside the object
  // literal) can close over it. The registry stamps `pluginId` onto the object
  // during `initAll` so validation errors are attributed to the right plugin.
  const context: PluginContext = {
    editor,
    commandBus,
    stores,
    schema,
    registerProsePlugin(plugin, key) {
      collectors.prosePlugins.push({ plugin, key });
    },
    registerNodeView(reg) {
      validateAndCollect(
        nodeViewRegistrationSchema,
        "nodeView",
        reg,
        collectors.nodeViews,
        context,
      );
    },
    registerToolbarItem(item) {
      validateAndCollect(toolbarItemSchema, "toolbarItem", item, collectors.toolbarItems, context);
    },
    registerCommand(cmd) {
      validateAndCollect(editorCommandSchema, "command", cmd, collectors.commands, context);
    },
    registerOverlay(overlay) {
      validateAndCollect(pluginOverlaySchema, "overlay", overlay, collectors.overlays, context);
    },
    registerSetting(setting) {
      validateAndCollect(pluginSettingSchema, "setting", setting, collectors.settings, context);
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

  return context;
}

/** Helper to merge several schema contributions into one. */
export function mergeSchemaContributions(contributions: SchemaContribution[]): SchemaContribution {
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
