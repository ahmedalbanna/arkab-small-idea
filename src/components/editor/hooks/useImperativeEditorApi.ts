import {
  useCallback,
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
  /** Unique id of this editor — used to scope bus dispatch to the correct
   * executor when multiple editors are mounted simultaneously. */
  editorId: string;
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
  editorId,
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

  // Register this editor's executor with the bus so dispatch/query target
  // the correct editor. On cleanup only this editor's slot is removed — other
  // editors keep working (fixes R1/R2 from the review).
  useEffect(() => {
    bus.setExecutorForEditor(editorId, executor);
    return () => bus.removeExecutor(editorId);
  }, [bus, executor, editorId]);

  // Thread `editorId` through every dispatch/query call so the bus routes
  // to this editor's executor, not the last-registered one.
  const dispatch = useCallback(
    (action: EditorCommandAction) => bus.dispatch(action, { editorId }),
    [bus, editorId],
  );
  const query = useCallback(
    <T>(action: EditorCommandAction): T | undefined => bus.query<T>(action, editorId),
    [bus, editorId],
  );

  useImperativeHandle(
    ref,
    (): EditorRef => ({
      focus: () => dispatch({ type: "focus" }),
      insertText: (before, after) => dispatch({ type: "insertText", before, after }),
      insertImage: (src, alt, title) => dispatch({ type: "insertImage", src, alt, title }),
      insertGallery: (srcs) =>
        dispatch({
          type: "insertGallery",
          srcs,
        }),
      insertScribble: () =>
        dispatch({
          type: "insertNodeAt",
          nodeName: "scribble",
          attrs: { data: null, width: "100%", aspectRatio: 0.5 },
        }),
      appendMarkdown: (markdown) => dispatch({ type: "appendMarkdown", markdown }),
      replaceSelectionWithMarkdown: (markdown) =>
        dispatch({ type: "replaceSelectionWithMarkdown", markdown }),
      replaceRangeWithMarkdown: (from, to, markdown) =>
        dispatch({ type: "replaceRangeWithMarkdown", from, to, markdown }),
      setMarkdown: (content) => {
        // Programmatic full replacement: don't echo it back as an onChange.
        isUpdatingFromProps.current = true;
        dispatch({ type: "setMarkdown", content });
        isUpdatingFromProps.current = false;
      },
      getSelectedText: () => query<string>({ type: "getSelectedText" }) ?? "",
      getHtml: () => query<string>({ type: "getHtml" }) ?? "",
      getDoc: () => query<Node>({ type: "getDoc" }),
      getTextWithPositions: () =>
        query<{ text: string; pos: number }[]>({
          type: "getTextWithPositions",
        }) ?? [],
      getHeadings: () =>
        query<{ text: string; level: number; pos: number; id: string }[]>({
          type: "getHeadings",
        }) ?? [],
      setTTSHighlight: (range) => dispatch({ type: "setTTSHighlight", range }),
      handleFormat: (type, attrs) => dispatch({ type: "format", format: type, attrs }),
      getCursorContext: () => query<string>({ type: "getCursorContext" }) ?? "",
      getSelectedMarkdown: () => query<string>({ type: "getSelectedMarkdown" }) ?? "",
      getSectionMarkdown: (pos) => query<string>({ type: "getSectionMarkdown", pos }) ?? "",
      scrollToText: (text) => dispatch({ type: "scrollToText", text }),
      scrollToPos: (pos) => dispatch({ type: "scrollToPos", pos }),
      streamMarkdown: (content, isNew) => dispatch({ type: "streamMarkdown", content, isNew }),
    }),
    [dispatch, query, isUpdatingFromProps],
  );
}
