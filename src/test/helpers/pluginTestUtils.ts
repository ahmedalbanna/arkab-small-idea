/**
 * Plugin Test Utilities — convenience factories that wrap `pluginDevHelper.ts`
 * for common testing patterns.
 *
 * These utilities reduce boilerplate in plugin test files by providing:
 * - `createTestPluginContext()` — one-liner context builder
 * - `createTestCommandAPI()` — mock CommandAPI for command/toolbar callbacks
 * - `withTestPlugin()` — init + contributions capture + auto-cleanup
 *
 * ## Usage
 *
 * ```typescript
 * import { withTestPlugin } from "../helpers/pluginTestUtils";
 * import { myPlugin } from "../../plugins/myPlugin";
 *
 * it("registers commands", () => {
 *   const { contributions, destroy } = withTestPlugin(myPlugin);
 *   try {
 *     expect(contributions.commands).toHaveLength(2);
 *   } finally {
 *     destroy();
 *   }
 * });
 * ```
 */
import {
  createPluginTestBench,
  createTestCommandAPI as createDevCommandAPI,
} from "../../plugins/devtools/pluginDevHelper";
import type {
  PluginTestBench,
  PluginTestContext,
  PluginTestResult,
} from "../../plugins/devtools/pluginDevHelper";
import type { CommandAPI } from "../../plugins/pluginAPI";
import type { InkPlugin } from "../../plugins/types";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { PluginTestContext, PluginTestResult, PluginTestBench };

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

/**
 * Create a test `PluginTestContext` with default schema and a fresh command
 * bus. Shorthand for `createPluginTestBench().createPluginContext()`.
 */
export function createTestPluginContext(bench?: PluginTestBench): PluginTestContext {
  const b = bench ?? createPluginTestBench();
  return b.createPluginContext();
}

// ---------------------------------------------------------------------------
// CommandAPI factory
// ---------------------------------------------------------------------------

/**
 * Create a mock `CommandAPI` for testing command `run()` or toolbar
 * `onClick()` callbacks in isolation.
 *
 * The returned `commandBus` is a real `EditorCommandBus` with audit enabled
 * but no executor attached — dispatches are no-ops but recorded in the
 * audit trail for later inspection.
 */
export function createTestCommandAPI(): CommandAPI {
  return createDevCommandAPI();
}

// ---------------------------------------------------------------------------
// withTestPlugin — convenience lifecycle wrapper
// ---------------------------------------------------------------------------

/**
 * Initialise a plugin in a fresh test bench, capture its contributions, and
 * return a `PluginTestResult` with a `destroy()` function for cleanup.
 *
 * Use inside a `try/finally` block or a test-framework hook (`afterEach`)
 * to ensure the plugin is torn down.
 *
 * @example
 * ```typescript
 * it("registers two prose plugins", async () => {
 *   const { contributions, destroy } = await withTestPlugin(myPlugin);
 *   try {
 *     expect(contributions.prosePlugins).toHaveLength(2);
 *   } finally {
 *     destroy();
 *   }
 * });
 * ```
 */
export async function withTestPlugin(plugin: InkPlugin): Promise<PluginTestResult> {
  const bench = createPluginTestBench();
  const ctx = bench.createPluginContext();
  await bench.loadPlugin(plugin, ctx);
  const contributions = bench.getContributions();

  return {
    plugin,
    context: ctx,
    contributions,
    destroy: () => bench.destroy(),
  };
}
