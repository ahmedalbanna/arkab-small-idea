// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import ProseMirrorEditor from "../components/ProseMirrorEditor";
import type { EditorRef } from "../components/ProseMirrorEditor";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";
import { useAIUIStore } from "../stores/aiUIStore";

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

  it("closes the slash menu when its trigger is removed or the cursor leaves", async () => {
    const onChange = vi.fn();
    const ref = createRef<EditorRef>();

    render(<ProseMirrorEditor ref={ref} value="Hello" onChange={onChange} editorId="ed-1" />);

    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).not.toBeNull(),
    );

    // Simulate the menu having been opened by typing "/" at the start.
    act(() => {
      useAIUIStore.getState().setSlashMenu({
        show: true,
        pos: 1,
        query: "",
        x: 0,
        y: 0,
        editorId: "ed-1",
      });
    });
    expect(useAIUIStore.getState().slashMenu.show).toBe(true);

    // A document change (here via the imperative API) goes through
    // `dispatchTransaction`, which must read the *live* menu state and close it
    // once the trigger slash is gone / the cursor has moved away.
    act(() => {
      ref.current?.setMarkdown("Hello world");
    });

    await waitFor(() => {
      expect(useAIUIStore.getState().slashMenu.show).toBe(false);
    });
  });

  it("closes the owning editor's slash menu when clicking outside it", async () => {
    const onChange = vi.fn();

    const { container: containerA } = render(
      <ProseMirrorEditor value="" onChange={onChange} editorId="ed-A" />,
    );
    const { container: containerB } = render(
      <ProseMirrorEditor value="" onChange={onChange} editorId="ed-B" />,
    );

    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).not.toBeNull(),
    );

    // Open the slash menu owned by editor A (it owns the shared slot).
    act(() => {
      useAIUIStore.getState().setSlashMenu({
        show: true,
        pos: 1,
        query: "",
        x: 0,
        y: 0,
        editorId: "ed-A",
      });
    });
    expect(useAIUIStore.getState().slashMenu.editorId).toBe("ed-A");

    // Clicking inside editor B is "outside editor A", so A's (owning) menu
    // closes — and only the owning editor's handler is authorized to close it.
    const targetInsideB = containerB.querySelector(".ProseMirror") as HTMLElement;
    act(() => {
      targetInsideB.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(useAIUIStore.getState().slashMenu.show).toBe(false);
  });

  it("keeps the bubble menu open on click while text is selected", async () => {
    const onChange = vi.fn();

    const { container } = render(
      <ProseMirrorEditor value="" onChange={onChange} editorId="ed-1" />,
    );

    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).not.toBeNull(),
    );

    // Simulate a non-empty selection having opened the bubble menu.
    act(() => {
      useAIUIStore.getState().setBubbleMenu({
        show: true,
        x: 0,
        y: 0,
        editorId: "ed-1",
      });
      // A context menu opened at the same time should still be dismissable.
      useAIUIStore.getState().setContextMenu({
        show: true,
        x: 0,
        y: 0,
        pos: 0,
        editorId: "ed-1",
      });
    });
    expect(useAIUIStore.getState().bubbleMenu.show).toBe(true);
    expect(useAIUIStore.getState().contextMenu.show).toBe(true);

    // Clicking (e.g. finishing a text selection) must NOT force-close the bubble
    // menu — the selection-driven plugin owns its visibility. The context menu,
    // which is not selection-driven, should still close.
    const target = container.querySelector(".ProseMirror") as HTMLElement;
    act(() => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(useAIUIStore.getState().bubbleMenu.show).toBe(true);
    expect(useAIUIStore.getState().contextMenu.show).toBe(false);
  });
});
