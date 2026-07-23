/**
 * Plugin Development Helper — isolated test bench for developing and testing
 * a single InkPlugin without the full editor bootstrap.
 *
 * Provides `createPluginTestBench()` which returns a `PluginTestBench` that
 * manages a plugin lifecycle (init, contributions capture, destroy) using a
 * lightweight environment that mirrors the production `PluginContext` shape
 * without requiring a real ProseMirror view, DOM, or Zustand stores.
 *
 * Dev/test only. Never import in production bundles.
 */
import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model";
import type { Plugin, PluginKey } from "prosemirror-state";
import { EditorCommandBus } from "../../core/commands/commandBus";
import { createCollectors, buildPluginContext } from "../context";
import type { ContextCollectors } from "../context";
import {
  type AppStores,
  type EditorAPI,
  type EditorCommand,
  type InkPlugin,
  type NodeViewRegistration,
  type PluginContext,
  type PluginOverlay,
  type PluginSettingDef,
  type ToolbarItem,
} from "../types";
import type { CommandAPI } from "../pluginAPI";
import type { EditorCommandAction } from "../editorCommandBus";
import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of `createPluginContext()`. */
export interface PluginTestContext {
  /** The full `PluginContext` passed to the plugin during `init()`. */
  context: PluginContext;
  /** Mutable collectors tracking every contribution the plugin registered. */
  collectors: ContextCollectors;
  /** The command bus (same reference as `context.commandBus`). */
  commandBus: EditorCommandBus;
  /** The editor schema (same reference as `context.schema`). */
  schema: Schema;
}

/** Result of `getContributions()`. */
export interface PluginContributions {
  commands: EditorCommand[];
  toolbarItems: ToolbarItem[];
  prosePlugins: { plugin: Plugin | (() => Plugin); key?: PluginKey }[];
  nodeViews: NodeViewRegistration[];
  overlays: PluginOverlay[];
  settings: PluginSettingDef[];
  hosts: ComponentType<any>[];
}

/**
 * Result of `withTestPlugin()` — bundles the initialized plugin, its test
 * context, and captured contributions for easy assertion.
 */
export interface PluginTestResult {
  plugin: InkPlugin;
  /** The test context (includes context, collectors, bus, schema). */
  context: PluginTestContext;
  /** Snapshot of contributions after `init()`. */
  contributions: PluginContributions;
  /** Cleanup: calls `plugin.destroy()` if defined. Safe to call multiple times. */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Default schema (matches pluginContributions.test.ts)
// ---------------------------------------------------------------------------

const DEFAULT_NODES: Record<string, NodeSpec> = {
  doc: { content: "block+" },
  paragraph: { group: "block", content: "inline*" },
  text: { group: "inline" },
};

const DEFAULT_MARKS: Record<string, MarkSpec> = {};

// ---------------------------------------------------------------------------
// PluginTestBench
// ---------------------------------------------------------------------------

/**
 * Lightweight test bench for a single plugin. Mirrors the production plugin
 * environment without requiring a full editor bootstrap.
 *
 * Usage:
 * ```typescript
 * const bench = createPluginTestBench();
 * const ctx = bench.createPluginContext();
 * await bench.loadPlugin(myPlugin, ctx);
 * const { commands } = bench.getContributions();
 * expect(commands).toHaveLength(3);
 * bench.destroy();
 * ```
 */
export interface PluginTestBench {
  /**
   * Build a test `PluginContext` with fresh collectors and the given options.
   * Each call returns an independent context with its own collectors.
   */
  createPluginContext(options?: {
    schema?: Schema;
    commandBus?: EditorCommandBus;
  }): PluginTestContext;

  /**
   * Initialise a plugin by calling `plugin.init(context)`. If the plugin has
   * already been loaded (via a previous `loadPlugin` call), it is destroyed
   * first to avoid double-init.
   */
  loadPlugin(plugin: InkPlugin, context: PluginTestContext): Promise<void>;

  /**
   * Simulate a user action by dispatching it through the bus attached to the
   * last loaded context. A no-op if no plugin has been loaded yet.
   */
  simulateUserAction(action: EditorCommandAction): void;

  /**
   * Return a snapshot of every contribution the plugin registered during
   * `init()`. Returns empty arrays when no plugin has been loaded.
   */
  getContributions(): PluginContributions;

  /**
   * Run the loaded plugin's `destroy()` (if defined) and reset internal state.
   * Safe to call multiple times.
   */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new `PluginTestBench` with its own lifecycle state.
 */
export function createPluginTestBench(): PluginTestBench {
  let loadedPlugin: InkPlugin | null = null;
  let currentContext: PluginTestContext | null = null;

  /** Create a minimal fake EditorAPI. */
  function fakeEditor(): EditorAPI {
    return {
      getView: () => null,
      isReady: () => false,
      focus: () => {},
    };
  }

  /** Create a minimal AppStores with all store accessors stubbed. */
  function fakeStores(): AppStores {
    const stubStore = { getState: () => ({}), setState: () => {}, subscribe: () => () => {} };
    return {
      editor: stubStore as unknown as AppStores["editor"],
      ui: stubStore as unknown as AppStores["ui"],
      ai: stubStore as unknown as AppStores["ai"],
      settings: stubStore as unknown as AppStores["settings"],
      aiUI: stubStore as unknown as AppStores["aiUI"],
    };
  }

  const bench: PluginTestBench = {
    createPluginContext(options) {
      const schema = options?.schema ?? new Schema({ nodes: DEFAULT_NODES, marks: DEFAULT_MARKS });
      const commandBus = options?.commandBus ?? new EditorCommandBus({ audit: { enabled: true } });

      const collectors = createCollectors();
      const context = buildPluginContext(schema, collectors, fakeEditor(), commandBus);

      return { context, collectors, commandBus, schema };
    },

    async loadPlugin(plugin, ctx) {
      // Destroy previous if any.
      if (loadedPlugin) {
        bench.destroy();
      }

      loadedPlugin = plugin;
      currentContext = ctx;

      // Stamp the pluginId so validation errors are attributed correctly.
      (ctx.context as { pluginId?: string }).pluginId = plugin.id;

      await plugin.init(ctx.context);
    },

    simulateUserAction(action) {
      if (!currentContext) return;
      currentContext.commandBus.dispatch(action, { source: "user:toolbar" });
    },

    getContributions() {
      if (!currentContext) {
        return {
          commands: [],
          toolbarItems: [],
          prosePlugins: [],
          nodeViews: [],
          overlays: [],
          settings: [],
          hosts: [],
        };
      }
      const c = currentContext.collectors;
      return {
        commands: [...c.commands],
        toolbarItems: [...c.toolbarItems],
        prosePlugins: [...c.prosePlugins],
        nodeViews: [...c.nodeViews],
        overlays: [...c.overlays],
        settings: [...c.settings],
        hosts: [...c.hosts],
      };
    },

    destroy() {
      if (loadedPlugin?.destroy) {
        loadedPlugin.destroy();
      }
      loadedPlugin = null;
      currentContext = null;
    },
  };

  return bench;
}

// ---------------------------------------------------------------------------
// Convenience: createTestCommandAPI
// ---------------------------------------------------------------------------

/**
 * Create a minimal `CommandAPI` suitable for testing command `run()` or
 * toolbar `onClick()` callbacks in isolation.
 *
 * The returned `commandBus` is a real `EditorCommandBus` with audit enabled
 * and a minimal no-op executor attached (so `dispatch()` records entries
 * in the audit trail even though no real editor is running).
 */
export function createTestCommandAPI(): CommandAPI {
  const bus = new EditorCommandBus({ audit: { enabled: true } });
  // Attach a minimal no-op executor so dispatch() records audit entries.
  bus.setExecutor({ run: () => ({}) });
  return {
    commandBus: bus,
    stores: {
      editor: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} },
      ui: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} },
      ai: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} },
      settings: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} },
      aiUI: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} },
    } as unknown as AppStores,
    emitIntent: () => {},
  };
}
