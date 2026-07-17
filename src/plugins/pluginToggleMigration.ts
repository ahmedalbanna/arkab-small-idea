import type { PluginRegistry } from "./registry";

/**
 * Versioned schema + migration for persisted plugin toggles.
 *
 * `disabledPlugins` is a list of plugin ids the user has turned off. Over time
 * plugins are renamed, removed, or added, and previously persisted storage can
 * contain ids that no longer mean anything. Two layers keep enable/disable
 * safe:
 *
 * 1. `migratePluginToggles` — versioned, structural migration applied during
 *    settings hydration (coerces shape, applies legacy id renames).
 * 2. `validateDisabledPlugins` — runtime reconciliation against the live
 *    registry, dropping ids that don't exist so a stale list can never break
 *    editor startup or leave a plugin half-initialized.
 */

/** Current schema version for persisted plugin-toggle data. */
export const PLUGIN_TOGGLES_VERSION = 1;

/**
 * Historical plugin-id renames, keyed by the *old* id. When a feature is
 * renamed, add `oldId -> newId` so a persisted toggle for the old id keeps
 * working after the rename. Consumed by `migratePluginToggles` and is the
 * single source of truth for id continuity across versions.
 */
const LEGACY_PLUGIN_ID_RENAMES: Record<string, string> = {
  // Example (keep the seam even when empty): "old-search": "search",
};

function toIdArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string" && value.length > 0) {
    // Tolerate a single string accidentally stored instead of an array.
    return [value];
  }
  return [];
}

/**
 * Migrate a persisted `disabledPlugins` value forward to the current schema
 * version. Each version boundary may rewrite ids (renames) and coerce the
 * shape. `renames` is injectable so tests can exercise the mechanism without
 * touching production data.
 */
export function migratePluginToggles(
  disabled: unknown,
  fromVersion: number,
  renames: Record<string, string> = LEGACY_PLUGIN_ID_RENAMES,
): string[] {
  let ids = toIdArray(disabled);
  const target = PLUGIN_TOGGLES_VERSION;
  for (let v = Math.max(0, fromVersion); v < target; v++) {
    ids = ids.map((id) => renames[id] ?? id);
  }
  // Deduplicate while preserving first-seen order.
  return [...new Set(ids)];
}

/**
 * Reconcile a persisted/proposed disabled-plugin list against the plugins
 * actually registered in the live registry. Drops ids that no longer exist
 * (renamed without a migration entry, removed, or never valid) so that
 * enable/disable stays safe at runtime regardless of stale storage.
 */
export function validateDisabledPlugins(
  disabled: string[] | undefined,
  registry: PluginRegistry,
): string[] {
  const known = new Set(registry.resolveOrder());
  const result = (disabled ?? []).filter((id) => known.has(id));
  return [...new Set(result)];
}
