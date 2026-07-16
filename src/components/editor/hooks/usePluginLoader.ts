import { useEffect, useState, type RefObject } from "react";
import type { EditorView } from "prosemirror-view";
import { loadPlugins, type LoadedPlugins } from "../../../plugins";
import { useSettingsStore } from "../../../stores/settingsStore";

/**
 * Loads and tears down the editor plugin set.
 *
 * Re-runs whenever the enabled/disabled plugin signature changes so the editor
 * state is rebuilt without the toggled plugin's contributions. The returned
 * `LoadedPlugins` (or `null` before the first load resolves) is the source of
 * truth for the schema, resolved ProseMirror plugins and UI contributions
 * consumed by the rest of the editor.
 */
export function usePluginLoader(
  viewRef: RefObject<EditorView | null>,
  onLoaded?: (loaded: LoadedPlugins) => void,
): LoadedPlugins | null {
  const [loaded, setLoaded] = useState<LoadedPlugins | null>(null);

  // Re-run plugin loading whenever the enabled/disabled plugin set changes,
  // so the editor state is rebuilt without the toggled plugin's contributions.
  const pluginSignature = useSettingsStore((s) =>
    [...s.disabledPlugins].sort().join(","),
  );

  useEffect(() => {
    let cancelled = false;
    const editorApi = {
      getView: () => viewRef.current,
      isReady: () => viewRef.current !== null,
      focus: () => viewRef.current?.focus(),
    };
    loadPlugins(editorApi, {
      disabled: useSettingsStore.getState().disabledPlugins,
    }).then((result) => {
      if (!cancelled) {
        setLoaded(result);
        onLoaded?.(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pluginSignature, viewRef, onLoaded]);

  return loaded;
}
