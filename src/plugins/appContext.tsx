import { createContext, useContext, type ReactNode } from "react";
import type { EditorRef } from "../components/ProseMirrorEditor";
import type { PluginContext } from "./types";

/**
 * A small, stable facade over the app shell that UI plugins (overlays such as
 * the table of contents or status bar) can use to reach the live editors
 * without depending on `App.tsx` internals.
 */
export interface AppApi {
  /** Editor ref for a page, or the focused page's ref when omitted. */
  getEditorRef(pageId?: string): EditorRef | null;
  /** Id of the currently focused page, or `null`. */
  getActivePageId(): string | null;
}

export const AppApiContext = createContext<AppApi | null>(null);

export function useAppApi(): AppApi {
  const api = useContext(AppApiContext);
  if (!api) {
    throw new Error("useAppApi must be used within an <AppApiContext.Provider>");
  }
  return api;
}

/**
 * Everything a plugin's React side (hosts / hooks) needs: the live app-shell
 * facade plus the resolved `PluginContext` produced during plugin loading.
 */
export interface PluginServices {
  appApi: AppApi;
  pluginContext: PluginContext;
}

export const PluginServicesContext = createContext<PluginServices | null>(null);

export function usePluginServices(): PluginServices {
  const services = useContext(PluginServicesContext);
  if (!services) {
    throw new Error("usePluginServices must be used within a <PluginProvider>");
  }
  return services;
}

/** Convenience provider that exposes both `AppApi` and `PluginContext`. */
export function PluginProvider({
  appApi,
  pluginContext,
  children,
}: {
  appApi: AppApi;
  pluginContext: PluginContext | null;
  children: ReactNode;
}) {
  return (
    <AppApiContext.Provider value={appApi}>
      <PluginServicesContext.Provider
        value={pluginContext ? { appApi, pluginContext } : null}
      >
        {children}
      </PluginServicesContext.Provider>
    </AppApiContext.Provider>
  );
}
