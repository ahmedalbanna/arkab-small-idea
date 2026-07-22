// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import ProseMirrorEditor from "../components/ProseMirrorEditor";
import type { EditorRef } from "../components/ProseMirrorEditor";
import type { LoadedPlugins } from "../plugins";
import { defaultEditorCommandBus } from "../plugins/editorCommandBus";
import { useAIUIStore } from "../stores/aiUIStore";

// The embedding service instantiates a `Worker` at module load; stub it so the
// editor's import graph evaluates without spinning up a real worker.
vi.mock("../services/embeddingService", () => {
  const noop = () => {};
  return {
    embeddingService: {
      isReady: () => false,
      getStatus: () => "idle",
      getProgress: () => 0,
      loadModel: async () => {},
      generateEmbedding: async () => [] as number[],
      cosineSimilarity: () => 0,
      onStatusChange: noop,
    },
    vectorStore: {
      init: async () => {},
      getChunks: () => [],
      getEpisodes: () => [],
      setChunks: async () => {},
      setEpisodes: async () => {},
      addEpisodes: async () => {},
      searchEpisodes: () => [],
      searchWithScores: () => [],
    },
    cosineSimilarity: () => 0,
  };
});

/**
 * Phase 6 integration: the headless `CoreEditor` is the single source of truth.
 * Every `EditorRef` command is dispatched through the core, the live view
 * subscribes to the core, and `onChange` fires for both user- and
 * command-driven mutations.
 */
describe("CoreEditor <-> EditorView integration (Phase 6)", () => {
  afterEach(() => {
    cleanup();
    defaultEditorCommandBus.clearHistory();
  });

  it("routes commands through core and keeps the view in sync", async () => {
    const onChange = vi.fn();
    const onLoaded = vi.fn();
    const ref = createRef<EditorRef>();
    let loaded: LoadedPlugins | null = null;
    onLoaded.mockImplementation((l: LoadedPlugins) => {
      loaded = l;
    });

    render(<ProseMirrorEditor ref={ref} value="" onChange={onChange} onLoaded={onLoaded} />);

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());
    expect(loaded).not.toBeNull();
    expect(loaded!.core).toBeTruthy();

    // --- Command -> core -> view --------------------------------------------
    act(() => {
      ref.current?.insertText("Hello");
    });

    // The core document reflects the command.
    expect(loaded!.core.getState().doc.textContent).toContain("Hello");

    // EditorRef reads from the core (same doc object).
    expect(ref.current?.getDoc()).toBe(loaded!.core.getState().doc);

    // onChange fires for command-driven mutations (the key Phase 6 behavior:
    // previously only user typing went through dispatchTransaction).
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toContain("Hello");

    // --- Formatting applies inside the core -------------------------------
    act(() => {
      ref.current?.appendMarkdown("**bold text**");
    });
    let hasStrong = false;
    loaded!.core.getState().doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === "strong")) {
        hasStrong = true;
      }
    });
    expect(hasStrong).toBe(true);

    // --- External value sync does not echo back as onChange ---------------
    const callsBefore = onChange.mock.calls.length;
    const { rerender } = render(
      <ProseMirrorEditor ref={ref} value="# New Title" onChange={onChange} onLoaded={onLoaded} />,
    );
    // (rerender triggers a new render; value sync runs in an effect)
    await waitFor(() => {
      const heading = loaded!.core.getState().doc.firstChild;
      expect(heading?.type.name).toBe("heading");
    });
    // The programmatic external sync must NOT fire onChange (guarded).
    expect(onChange.mock.calls.length).toBe(callsBefore);

    // And the core document now matches the externally supplied value.
    expect(loaded!.core.getState().doc.textContent).toContain("New Title");

    rerender(<ProseMirrorEditor ref={ref} value="# New Title" onChange={onChange} />);
  });
});
