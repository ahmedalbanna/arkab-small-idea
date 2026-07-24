import {
  useEffect,
  useImperativeHandle,
  useMemo,
  type Ref,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { EditorRef } from "../../ProseMirrorEditor";
import { useEditorCommandBus } from "../../../plugins/editorCommandContext";
import type {
  EditorCommandAction,
  EditorCommandExecutor,
  EditorCommandResult,
} from "../../../plugins/editorCommandBus";
import { createHeadlessExecutor } from "@core/commands/executor";
import type { CoreEditor } from "@core/CoreEditor";
import { useUIStore } from "../../../stores/uiStore";

interface ImperativeEditorApiParams {
  ref: Ref<EditorRef>;
  viewRef: RefObject<EditorView | null>;
  /** The headless core that owns document state. When absent (pre-load) the
   * executor degrades to a no-op and the handle still constructs safely. */
  core: CoreEditor | undefined;
  /** Guards `onChange` from echoing programmatic updates back out. */
  isUpdatingFromProps: MutableRefObject<boolean>;
}

/**
 * Wires the imperative `EditorRef` handle consumed by the rest of the app
 * (toolbars, AI sidebar, TTS, import). Every method delegates to the
 * `EditorCommandBus`, whose executor is now `createHeadlessExecutor(core)` —
 * the same operations that back the headless core. This keeps `EditorRef` a
 * thin, backward-compatible adapter and removes the duplicate ProseMirror
 * logic that previously lived here. React-only side effects the core cannot
 * express (TTS highlight store, view focus) are layered on by a thin wrapper.
 */
export function useImperativeEditorApi({
  ref,
  viewRef,
  core,
  isUpdatingFromProps,
}: ImperativeEditorApiParams): void {
  const bus = useEditorCommandBus();

  // The headless executor turns each command into a mutation of `core`'s state
  // (which the live `EditorView` subscribes to). Rebuilt whenever `core` changes.
  const headless = useMemo<EditorCommandExecutor | null>(
    () => (core ? createHeadlessExecutor(core) : null),
    [core],
  );

  const executor = useMemo<EditorCommandExecutor>(
    () => ({
      run(action: EditorCommandAction): EditorCommandResult {
        // React-only side effect: keep the TTS highlight store in sync.
        if (action.type === "setTTSHighlight") {
          useUIStore.getState().setTTSHighlightRange(action.range);
        }
        if (!headless) return {};
        const result = headless.run(action);
        // The core has no reference to the live view, so nudge focus for the
        // actions that would otherwise be invisible to the user.
        if (
          action.type === "focus" ||
          action.type === "setMarkdown" ||
          action.type === "scrollToText" ||
          action.type === "scrollToPos"
        ) {
          viewRef.current?.focus();
        }
        return result;
      },
    }),
    [headless, viewRef],
  );

  // Register the executor with the bus so dispatch/query reach the core.
  useEffect(() => {
    bus.setExecutor(executor);
    return () => bus.setExecutor(null);
  }, [bus, executor]);

  useImperativeHandle(
    ref,
    (): EditorRef => ({
      focus: () => bus.dispatch({ type: "focus" }),
      insertText: (before, after) => bus.dispatch({ type: "insertText", before, after }),
      insertImage: (src, alt, title) => bus.dispatch({ type: "insertImage", src, alt, title }),
      insertGallery: (srcs) => bus.dispatch({ type: "insertGallery", srcs }),
      insertScribble: () =>
        bus.dispatch({
          type: "insertNodeAt",
          nodeName: "scribble",
          attrs: { data: null, width: "100%", aspectRatio: 0.5 },
        }),
      appendMarkdown: (markdown) => bus.dispatch({ type: "appendMarkdown", markdown }),
      replaceSelectionWithMarkdown: (markdown) =>
        bus.dispatch({ type: "replaceSelectionWithMarkdown", markdown }),
      setMarkdown: (content) => {
        // Programmatic full replacement: don't echo it back as an onChange.
        isUpdatingFromProps.current = true;
        bus.dispatch({ type: "setMarkdown", content });
        isUpdatingFromProps.current = false;
      },
      getSelectedText: () => bus.query<string>({ type: "getSelectedText" }) ?? "",
      getHtml: () => bus.query<string>({ type: "getHtml" }) ?? "",
      getDoc: () => bus.query<Node>({ type: "getDoc" }),
      getTextWithPositions: () =>
        bus.query<{ text: string; pos: number }[]>({
          type: "getTextWithPositions",
        }) ?? [],
      getHeadings: () =>
        bus.query<{ text: string; level: number; pos: number; id: string }[]>({
          type: "getHeadings",
        }) ?? [],
      setTTSHighlight: (range) => bus.dispatch({ type: "setTTSHighlight", range }),
      handleFormat: (type) => bus.dispatch({ type: "format", format: type }),
      getCursorContext: () => bus.query<string>({ type: "getCursorContext" }) ?? "",
      scrollToText: (text) => bus.dispatch({ type: "scrollToText", text }),
      scrollToPos: (pos) => bus.dispatch({ type: "scrollToPos", pos }),
      streamMarkdown: (content, isNew) => bus.dispatch({ type: "streamMarkdown", content, isNew }),
    }),
    [bus, isUpdatingFromProps],
  );
}
