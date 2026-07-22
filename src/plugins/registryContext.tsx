import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { PluginRegistry } from "./registry";
import { useSettingsStore } from "../stores/settingsStore";

/**
 * Holds the registry backing the currently active editor, replacing the old
 * module-level `activeRegistry` global.
 *
 * Why a Context instead of a module global:
 * - No mutable module state, so the editor is SSR-safe and can be mounted
 *   multiple times on one page (each editor owns its own registry).
 * - The "active" registry is whatever the nearest mounted editor publishes,
 *   rather than a single hard-coded global.
 */
interface PluginRegistryContextValue {
  registry: PluginRegistry | null;
  /** Publish the active editor's registry (or `null` when it unmounts). */
  setRegistry: (registry: PluginRegistry | null) => void;
}

export const PluginRegistryContext = createContext<PluginRegistryContextValue | null>(null);

/** Stable no-op used when there is no provider (e.g. editor mounted in isolation). */
const NOOP = () => {};

/** Provides the active editor's registry to the app shell and plugin UI. */
export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null);
  return (
    <PluginRegistryContext.Provider value={{ registry, setRegistry }}>
      {children}
    </PluginRegistryContext.Provider>
  );
}

/** Read the active editor's registry (or `null` before any editor loads). */
export function usePluginRegistry(): PluginRegistry | null {
  return useContext(PluginRegistryContext)?.registry ?? null;
}

/** Publish the active editor's registry into the context. No-op without a provider. */
export function useSetPluginRegistry(): (registry: PluginRegistry | null) => void {
  const ctx = useContext(PluginRegistryContext);
  return ctx?.setRegistry ?? NOOP;
}

/**
 * Toggle a plugin's enabled state. Persists the preference to the settings
 * store (which every editor reads to rebuild) and applies the lifecycle
 * `enable`/`disable` to the active registry from context.
 */
export function useSetPluginEnabled(): (id: string, enabled: boolean) => void {
  const ctx = useContext(PluginRegistryContext);
  return useCallback(
    (id: string, enabled: boolean) => {
      // Always persist the user's preference; it is keyed by id and reconciled
      // against the live registry in `loadPlugins` (validateDisabledPlugins),
      // so a stale/renamed id can never break startup. Applying to the registry
      // is a no-op when the id isn't present (e.g. editor not yet loaded), so
      // we never drop a legitimate toggle.
      useSettingsStore.getState().setPluginEnabled(id, enabled);
      const registry = ctx?.registry ?? null;
      if (registry) {
        if (enabled) registry.enable(id);
        else registry.disable(id);
      }
    },
    [ctx?.registry],
  );
}
