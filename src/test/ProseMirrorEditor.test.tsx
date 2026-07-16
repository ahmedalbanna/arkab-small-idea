// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import ProseMirrorEditor from "../components/ProseMirrorEditor";
import type { EditorRef } from "../components/ProseMirrorEditor";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";

// The embedding service instantiates a `Worker` (and `VectorStore`, which uses
// IndexedDB) at module load. Those browser APIs aren't available under the test
// DOM and aren't exercised by mounting the editor, so we stub the module to let
// the editor's import graph evaluate without spinning up a real worker.
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
 * Integration coverage for the editor's mount path: async plugin loading,
 * ProseMirror `EditorView` creation, and the imperative `EditorRef` API.
 *
 * This is the first test that actually boots the editor component (every other
 * editor test drives ProseMirror pieces in isolation), so it guards the wiring
 * between the plugin system and the live view.
 */
describe("ProseMirrorEditor (mount + plugin loading)", () => {
  afterEach(() => {
    cleanup();
    defaultEditorCommandBus.clearHistory();
  });

  it("loads plugins, builds the EditorView, and exposes a working API", async () => {
    const onChange = vi.fn();
    const onLoaded = vi.fn();
    const ref = createRef<EditorRef>();

    render(
      <ProseMirrorEditor ref={ref} value="" onChange={onChange} onLoaded={onLoaded} />,
    );

    // `loadPlugins` resolves asynchronously; the EditorView is only constructed
    // once the plugin context (schema + ProseMirror plugins) is ready.
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).not.toBeNull(),
    );

    // Imperative handle is wired to the live view.
    expect(ref.current).toBeTruthy();

    const pm = document.querySelector(".ProseMirror") as HTMLElement;
    // `contenteditable` is applied by ProseMirror to the live view; happy-dom
    // doesn't reflect the `role`/`aria-*` attributes, so we assert on this.
    expect(pm.getAttribute("contenteditable")).toBe("true");

    // Plugin context was surfaced (schema present) so the view could build.
    expect(onLoaded.mock.calls[0][0].context.schema).toBeTruthy();

    // Seed content through the imperative API and verify the round-trip.
    act(() => {
      ref.current?.setMarkdown("# Hello\n\nWorld");
    });

    const html = ref.current?.getHtml() ?? "";
    expect(html).toContain("Hello");
    expect(html).toContain("World");

    const headings = ref.current?.getHeadings() ?? [];
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(1);
    expect(headings[0].text).toBe("Hello");

    // --- EditorCommandBus wiring & undo integration -------------------------
    // The setMarkdown call above went through the bus, so it recorded history.
    expect(defaultEditorCommandBus.canUndo).toBe(true);
    const htmlBeforeUndo = ref.current?.getHtml() ?? "";

    // Undo should restore the empty document (the "before" captured at
    // setMarkdown time).
    act(() => {
      defaultEditorCommandBus.undo();
    });
    await waitFor(() => {
      const htmlAfterUndo = ref.current?.getHtml() ?? "";
      expect(htmlAfterUndo).not.toContain("Hello");
    });

    // Redo should re-apply the undone command.
    act(() => {
      defaultEditorCommandBus.redo();
    });
    await waitFor(() => {
      const htmlAfterRedo = ref.current?.getHtml() ?? "";
      expect(htmlAfterRedo).toBe(htmlBeforeUndo);
    });
  });

  it("syncs an external value-prop change into the document", async () => {
    const onChange = vi.fn();
    const ref = createRef<EditorRef>();

    const { rerender } = render(
      <ProseMirrorEditor ref={ref} value="" onChange={onChange} />,
    );

    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).not.toBeNull(),
    );

    // Changing the external `value` prop should flow into the editor document.
    await act(async () => {
      rerender(
        <ProseMirrorEditor
          ref={ref}
          value="Some **bold** text"
          onChange={onChange}
        />,
      );
    });

    await waitFor(() => {
      const html = ref.current?.getHtml() ?? "";
      expect(html).toContain("Some");
    });
  });
});
