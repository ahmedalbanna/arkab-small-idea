import type { InkPlugin, SchemaContribution, PluginContext } from "./types";
import type { Schema } from "prosemirror-model";
import { pluginLogger } from "./logger";
import { schemaContributionSchema, formatIssues } from "./contributionSchemas";

/** Internal bookkeeping for a registered plugin. */
interface RegisteredEntry {
  plugin: InkPlugin;
  initialized: boolean;
  destroyed: boolean;
}

/**
 * Central registry of all Ink & Quill plugins.
 *
 * Responsibilities:
 * - Track registration and enable/disable state.
 * - Resolve a stable initialization order via dependency-based topological
 *   sort (Kahn's algorithm) so dependencies are initialized before dependents.
 * - Collect schema contributions from every enabled plugin prior to building
 *   the editor, enabling fully dynamic node/mark contribution.
 * - Drive `init` / `destroy` lifecycle.
 */
export class PluginRegistry {
  private entries = new Map<string, RegisteredEntry>();

  /** Register a plugin. Throws if the id is already taken. */
  register(plugin: InkPlugin): void {
    if (this.entries.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered.`);
    }
    this.entries.set(plugin.id, {
      plugin,
      initialized: false,
      destroyed: false,
    });
    pluginLogger.debug(plugin.id, "register", "Plugin registered");
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Plugin ids in topological (dependency-respecting) order. */
  resolveOrder(): string[] {
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const id of this.entries.keys()) {
      indegree.set(id, 0);
      dependents.set(id, []);
    }

    for (const [id, entry] of this.entries) {
      for (const dep of entry.plugin.dependencies ?? []) {
        if (!this.entries.has(dep)) {
          throw new Error(`Plugin "${id}" depends on unregistered plugin "${dep}".`);
        }
        indegree.set(id, (indegree.get(id) ?? 0) + 1);
        dependents.get(dep)!.push(id);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of indegree) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const next of dependents.get(id) ?? []) {
        const deg = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }

    if (order.length !== this.entries.size) {
      const cycle = [...this.entries.keys()].filter((id) => !order.includes(id));
      pluginLogger.error("*", "resolve:cycle", "Cyclic plugin dependency detected", {
        cycle,
      });
      throw new Error(`Cyclic plugin dependency detected: ${cycle.join(", ")}`);
    }

    return order;
  }

  /** Enabled plugin instances, in topological order. */
  getEnabled(): InkPlugin[] {
    return this.resolveOrder()
      .map((id) => this.entries.get(id)!)
      .filter((e) => e.plugin.enabled !== false)
      .map((e) => e.plugin);
  }

  /** Merge schema contributions from all enabled plugins. */
  async collectSchemaContributions(): Promise<SchemaContribution> {
    const merged: SchemaContribution = {
      nodes: {},
      marks: {},
      patchNodes: {},
      patchMarks: {},
    };

    for (const plugin of this.getEnabled()) {
      if (!plugin.getSchemaContribution) continue;
      const contribution = await plugin.getSchemaContribution();
      const result = schemaContributionSchema.safeParse(contribution);
      if (!result.success) {
        pluginLogger.error(plugin.id, "contribution:invalid", "Invalid schema contribution", {
          kind: "schema",
          issues: formatIssues(result.error.issues),
        });
        continue;
      }
      merged.nodes = { ...merged.nodes, ...contribution.nodes };
      merged.marks = { ...merged.marks, ...contribution.marks };
      merged.patchNodes = { ...merged.patchNodes, ...contribution.patchNodes };
      merged.patchMarks = { ...merged.patchMarks, ...contribution.patchMarks };
    }

    return merged;
  }

  /**
   * Initialize every enabled plugin in dependency order. `ctxFactory` is
   * called once the schema has been resolved so plugins receive the final
   * schema plus registration hooks.
   */
  async initAll(
    ctxFactory: (contributions: SchemaContribution) => Promise<{
      schema: Schema;
      context: PluginContext;
    }>,
  ): Promise<void> {
    const contributions = await this.collectSchemaContributions();
    const { context } = await ctxFactory(contributions);

    for (const id of this.resolveOrder()) {
      const entry = this.entries.get(id)!;
      if (entry.plugin.enabled === false) continue;
      pluginLogger.debug(id, "init:start", "Initializing plugin");
      const startedAt = performance.now();
      // Stamp the plugin id onto the shared context so registration-time
      // contribution validation can attribute errors to the right plugin,
      // then clear it so a later (or nested) plugin can't inherit it.
      (context as { pluginId?: string }).pluginId = id;
      try {
        await entry.plugin.init(context);
        entry.initialized = true;
        pluginLogger.debug(id, "init:done", "Plugin initialized", {
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch (err) {
        pluginLogger.error(id, "init:error", "Plugin failed to initialize", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        (context as { pluginId?: string }).pluginId = undefined;
      }
    }
  }

  /** Tear down every initialized plugin in reverse order. */
  destroyAll(): string[] {
    const order = this.resolveOrder().reverse();
    let destroyedCount = 0;
    for (const id of order) {
      const entry = this.entries.get(id)!;
      if (entry.initialized && !entry.destroyed) {
        pluginLogger.debug(id, "destroy:start", "Tearing down plugin");
        const startedAt = performance.now();
        if (entry.plugin.destroy) {
          try {
            entry.plugin.destroy();
          } catch (err) {
            pluginLogger.error(id, "destroy:error", "Plugin failed to destroy", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        // Mark as torn down even when no `destroy` hook exists, so the
        // lifecycle bookkeeping (and verifyCleanup) stays accurate.
        entry.destroyed = true;
        destroyedCount++;
        pluginLogger.debug(id, "destroy:done", "Plugin torn down", {
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
    }
    pluginLogger.info("*", "destroy:all", "All plugins torn down", {
      destroyed: destroyedCount,
    });
    return this.verifyCleanup();
  }

  /**
   * Report ids of plugins that were initialized but never destroyed — a sign
   * of a violated cleanup contract (resources left allocated). Called
   * automatically by `destroyAll`; logs a warning when any leak is detected.
   */
  verifyCleanup(): string[] {
    const leaked: string[] = [];
    for (const [id, entry] of this.entries) {
      if (entry.initialized && !entry.destroyed) leaked.push(id);
    }
    if (leaked.length > 0) {
      pluginLogger.warn("*", "leak", "Plugins initialized but not destroyed", {
        leaked,
      });
    }
    return leaked;
  }

  /**
   * Disable a plugin at runtime: run its cleanup and mark it disabled so it is
   * excluded from `getEnabled`, schema collection and `initAll`. The host must
   * rebuild the editor (e.g. re-run `loadPlugins`) for the plugin's
   * contributions to actually be removed from the live editor state.
   */
  disable(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    pluginLogger.info(id, "disable", "Plugin disabled at runtime");
    entry.plugin.enabled = false;
    if (entry.initialized && !entry.destroyed) {
      if (entry.plugin.destroy) {
        try {
          entry.plugin.destroy();
        } catch (err) {
          pluginLogger.error(id, "disable:error", "Plugin failed to destroy", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      entry.destroyed = true;
    }
  }

  /** Re-enable a plugin. A rebuild is required for its effects to return. */
  enable(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    pluginLogger.info(id, "enable", "Plugin re-enabled (rebuild required)");
    entry.plugin.enabled = true;
    entry.initialized = false;
    entry.destroyed = false;
  }
}
