/**
 * Core plugin architecture types for Ink & Quill.
 *
 * Every feature (AI assistant, search, math, diagrams, tables, collaboration,
 * TTS, semantic folders, export, etc.) is expressed as an `InkPlugin` that
 * contributes to the editor dynamically: ProseMirror plugins, node views,
 * schema nodes/marks, toolbar items, commands, overlays and settings.
 */
import type { Plugin, PluginKey } from "prosemirror-state";
import type { NodeSpec, MarkSpec, Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { ComponentType } from "react";

import type { useEditorStore } from "../stores/editorStore";
import type { useUIStore } from "../stores/uiStore";
import type { useAIStore } from "../stores/aiStore";
import type { useSettingsStore } from "../stores/settingsStore";

export type LucideIcon = ComponentType<{ className?: string }>;

/** Aggregated Zustand stores available to every plugin. */
export interface AppStores {
  editor: typeof useEditorStore;
  ui: typeof useUIStore;
  ai: typeof useAIStore;
  settings: typeof useSettingsStore;
}

/**
 * A thin, stable facade over the live ProseMirror editor. Plugins should
 * depend on this interface rather than touching the raw `EditorView` so the
 * editor can be rebuilt (e.g. schema changes) without breaking plugins.
 */
export interface EditorAPI {
  /** The live view, or `null` before the editor mounts. */
  getView(): EditorView | null;
  /** Whether the editor view has been created. */
  isReady(): boolean;
  focus(): void;
}

/** Nodes/marks a plugin wants to add to (or patch on) the editor schema. */
export interface SchemaContribution {
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
  /** Override an existing node spec by merging these fields in. */
  patchNodes?: Record<string, Partial<NodeSpec>>;
  /** Override an existing mark spec by merging these fields in. */
  patchMarks?: Record<string, Partial<MarkSpec>>;
}

/** Custom node renderer contributed by a plugin. */
export interface NodeViewRegistration {
  name: string;
  view: (node: any, view: EditorView, getPos: () => number | undefined) => any;
}

/** A command bound to a keymap and/or exposed through the slash menu. */
export interface EditorCommand {
  id: string;
  /** ProseMirror keymap binding, e.g. `"Mod-b"`. Optional. */
  key?: string;
  label?: string;
  /** Returns true if the command handled the event. */
  run: (ctx: PluginContext) => boolean | void;
  /** Whether the command should appear in the slash menu. */
  slash?: boolean;
}

/** A toolbar button contributed by a plugin. */
export interface ToolbarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  group?: string;
  order?: number;
  onClick: (ctx: PluginContext) => void;
  isActive?: () => boolean;
  show?: () => boolean;
}

export type OverlayMount = "panel" | "modal" | "sidebar";

/** A React overlay (modal, panel, sidebar) contributed by a plugin. */
export interface PluginOverlay {
  id: string;
  component: ComponentType<any>;
  mount: OverlayMount;
  show?: () => boolean;
}

export type SettingType = "toggle" | "select" | "text" | "number" | "slider";

/** A user-facing setting contributed by a plugin. */
export interface PluginSettingDef {
  pluginId: string;
  key: string;
  label: string;
  type: SettingType;
  defaultValue: unknown;
  description?: string;
  options?: { label: string; value: string }[];
  group?: string;
}

/**
 * The context handed to each plugin during `init`. It exposes the final
 * schema plus registration hooks for every extension point.
 */
export interface PluginContext {
  editor: EditorAPI;
  stores: AppStores;
  schema: Schema;
  registerProsePlugin(plugin: Plugin | (() => Plugin), key?: PluginKey): void;
  registerNodeView(reg: NodeViewRegistration): void;
  registerToolbarItem(item: ToolbarItem): void;
  registerCommand(cmd: EditorCommand): void;
  registerOverlay(overlay: PluginOverlay): void;
  registerSetting(setting: PluginSettingDef): void;
}

/**
 * A feature module. `getSchemaContribution` runs before the editor is built
 * (so it can inject nodes/marks); `init` runs afterwards with the final
 * schema and registration hooks. `destroy` must release any resources.
 */
export interface InkPlugin {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  /** Plugin ids that must be initialized first. */
  dependencies?: string[];
  getSchemaContribution?(): SchemaContribution | Promise<SchemaContribution>;
  init(ctx: PluginContext): void | Promise<void>;
  destroy?(): void;
}
