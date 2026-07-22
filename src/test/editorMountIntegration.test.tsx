// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { PluginRegistryProvider, usePluginRegistry } from "../plugins/registryContext";
import { EditorCommandBusProvider } from "../plugins/editorCommandContext";
import ProseMirrorEditor from "../components/ProseMirrorEditor";
import type { EditorRef } from "../components/ProseMirrorEditor";
import { useSettingsStore } from "../stores/settingsStore";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";

// The embedding service instantiates a `Worker` and `VectorStore` (IndexedDB)
// at module load. Those browser APIs aren't available under the test DOM and
// aren't exercised by mounting the editor, so we stub the module to let the
// editor's import graph evaluate without spinning up a real worker.
vi.mock("../services/embeddingService", () => {
  const noop = () => {};
  const embeddingService = {
    isReady: () => false,
    getStatus: () => "idle",
    getProgress: () => 0,
    loadModel: async () => {},
    generateEmbedding: async () => [] as number[],
    cosineSimilarity: () => 0,
    onStatusChange: noop,
  };
  const vectorStore = {
    init: async () => {},
    getChunks: () => [],
    getEpisodes: () => [],
    setChunks: async () => {},
    setEpisodes: async () => {},
    addEpisodes: async () => {},
    searchEpisodes: () => [],
    searchWithScores: () => [],
  };
  return {
    embeddingService,
    vectorStore,
    cosineSimilarity: () => 0,
  };
});

/**
 * Full-editor integration coverage: mounts the editor inside the real App-level
 * providers (`PluginRegistryProvider` + `EditorCommandBusProvider`) and verifies
 * the complete plugin-load pipeline — schema build, registry creation, and
 * publication of that registry into React context — plus safe runtime
 * enable/disable (toggling a plugin in the settings store must rebuild the
 * editor and drop the plugin from the live set without crashing).
 *
 * This complements `ProseMirrorEditor.test.tsx` (which mounts the editor in
 * isolation, without providers) by exercising the provider/context wiring that
 * the settings UI and prior refactors depend on.
 */
describe("Full editor mount + plugin load (integration)", () => {
  afterEach(() => {
    cleanup();
    defaultEditorCommandBus.clearHistory();
    // Reset persisted plugin toggles so tests don't leak state into each other.
    useSettingsStore.setState({ disabledPlugins: [] });
  });

  it("mounts, loads plugins, and publishes the registry into context", async () => {
    const onLoaded = vi.fn();
    const ref = createRef<EditorRef>();

    // Capture the registry published into context by the editor's loader.
    let registryFromContext: ReturnType<typeof usePluginRegistry> = null;
    function Capture() {
      registryFromContext = usePluginRegistry();
      return null;
    }

    render(
      <PluginRegistryProvider>
        <EditorCommandBusProvider>
          <ProseMirrorEditor ref={ref} value="" onChange={() => {}} onLoaded={onLoaded} />
          <Capture />
        </EditorCommandBusProvider>
      </PluginRegistryProvider>,
    );

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());

    // The loader published a registry both via `onLoaded` and into context.
    const loaded = onLoaded.mock.calls[0][0];
    expect(loaded.registry).not.toBeNull();
    await waitFor(() => expect(registryFromContext).not.toBeNull());

    const ids = loaded.registry.getEnabled().map((p) => p.id);
    // Core + AI + editor-shell plugins are essential and must be present.
    expect(ids).toContain("core");
    expect(ids).toContain("ai");
    expect(ids).toContain("editorUI");
    // Collaboration is off by default (not passed a `collab` prop).
    expect(ids).not.toContain("collab");

    // The context-published registry is the same loaded instance.
    expect(registryFromContext!.getEnabled().map((p) => p.id)).toEqual(ids);

    // Editor is fully functional through the provider wiring.
    act(() => ref.current?.setMarkdown("# Integration\n\nHello world"));
    const html = ref.current?.getHtml() ?? "";
    expect(html).toContain("Hello world");
    const headings = ref.current?.getHeadings() ?? [];
    expect(headings[0].text).toBe("Integration");
  });

  it("rebuilds the editor when a plugin is toggled at runtime (safe enable/disable)", async () => {
    const onLoaded = vi.fn();
    render(
      <PluginRegistryProvider>
        <EditorCommandBusProvider>
          <ProseMirrorEditor value="" onChange={() => {}} onLoaded={onLoaded} />
        </EditorCommandBusProvider>
      </PluginRegistryProvider>,
    );

    await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());
    const firstLoads = onLoaded.mock.calls.length;
    const beforeIds = onLoaded.mock.calls[0][0].registry
      .getEnabled()
      .map((p: { id: string }) => p.id);
    expect(beforeIds).toContain("math");

    // Disable a non-essential plugin via the settings store — exactly what the
    // Settings UI does. The editor must rebuild and drop the plugin.
    act(() => {
      useSettingsStore.getState().setPluginEnabled("math", false);
    });

    // The preference is persisted...
    await waitFor(() => expect(useSettingsStore.getState().disabledPlugins).toContain("math"));
    // ...and the editor rebuilt (onLoaded fired again) with math removed,
    // without losing the document view.
    await waitFor(() => {
      const calls = onLoaded.mock.calls;
      expect(calls.length).toBeGreaterThan(firstLoads);
      const lastIds = calls[calls.length - 1][0].registry
        .getEnabled()
        .map((p: { id: string }) => p.id);
      expect(lastIds).not.toContain("math");
    });
    expect(document.querySelector(".ProseMirror")).not.toBeNull();

    // Re-enabling restores the plugin and rebuilds again.
    act(() => {
      useSettingsStore.getState().setPluginEnabled("math", true);
    });
    await waitFor(() => expect(useSettingsStore.getState().disabledPlugins).not.toContain("math"));
    await waitFor(() => {
      const calls = onLoaded.mock.calls;
      const lastIds = calls[calls.length - 1][0].registry
        .getEnabled()
        .map((p: { id: string }) => p.id);
      expect(lastIds).toContain("math");
    });
  });
});
