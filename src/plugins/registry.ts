import type { InkPlugin, SchemaContribution } from "./types";

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
          throw new Error(
            `Plugin "${id}" depends on unregistered plugin "${dep}".`,
          );
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
      const cycle = [...this.entries.keys()].filter(
        (id) => !order.includes(id),
      );
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
      schema: import("prosemirror-model").Schema;
      context: import("./types").PluginContext;
    }>,
  ): Promise<void> {
    const contributions = await this.collectSchemaContributions();
    const { context } = await ctxFactory(contributions);

    for (const id of this.resolveOrder()) {
      const entry = this.entries.get(id)!;
      if (entry.plugin.enabled === false) continue;
      await entry.plugin.init(context);
      entry.initialized = true;
    }
  }

  /** Tear down every initialized plugin in reverse order. */
  destroyAll(): void {
    const order = this.resolveOrder().reverse();
    for (const id of order) {
      const entry = this.entries.get(id)!;
      if (entry.initialized && !entry.destroyed && entry.plugin.destroy) {
        try {
          entry.plugin.destroy();
        } catch (err) {
          console.error(`Failed to destroy plugin "${id}":`, err);
        }
        entry.destroyed = true;
      }
    }
  }
}
