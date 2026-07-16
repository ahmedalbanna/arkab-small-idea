import { useEffect, useImperativeHandle, useMemo, type Ref, type MutableRefObject, type RefObject } from "react";
import { TextSelection } from "prosemirror-state";
import { DOMSerializer, type Schema, type Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { slugify } from "../../../lib/utils";
import { useUIStore } from "../../../stores/uiStore";
import type { EditorRef } from "../../ProseMirrorEditor";
import { getCursorContextInternal } from "./useAIStreaming";
import { editorSerializer } from "./useMarkdownSerializer";
import { useEditorCommandBus } from "../../../plugins/editorCommandContext";
import type { EditorCommandAction, EditorCommandExecutor } from "../../../plugins/editorCommandBus";

interface ImperativeEditorApiParams {
  ref: Ref<EditorRef>;
  viewRef: RefObject<EditorView | null>;
  editorSchema: Schema;
  parseMarkdownDoc: (md: string) => Node;
  isUpdatingFromProps: MutableRefObject<boolean>;
  streamStartRef: MutableRefObject<number | null>;
  streamEndRef: MutableRefObject<number | null>;
  handleFormat: (type: string) => void;
}

/**
 * Wires the imperative `EditorRef` handle consumed by the rest of the app
 * (toolbars, AI sidebar, TTS, import). Every method now delegates to the
 * `EditorCommandBus`; the bus's executor (built below from the live view) is
 * the single source of truth for the actual ProseMirror operations. This keeps
 * `EditorRef` as a thin, backward-compatible adapter while consumers can opt to
 * dispatch commands directly to the bus via `useEditorCommandBus`.
 */
export function useImperativeEditorApi({
  ref,
  viewRef,
  editorSchema,
  parseMarkdownDoc,
  isUpdatingFromProps,
  streamStartRef,
  streamEndRef,
  handleFormat,
}: ImperativeEditorApiParams): void {
  const bus = useEditorCommandBus();

  // The executor maps each command to the actual editor operation and returns
  // an `inverse` for undoable commands (content mutations). It captures the
  // live view + schema through refs, so it stays correct across rebuilds.
  const executor = useMemo<EditorCommandExecutor>(
    () => ({
      run(action: EditorCommandAction): { value?: unknown; inverse?: EditorCommandAction | null } {
        const view = viewRef.current;
        switch (action.type) {
          case "focus":
            view?.focus();
            return {};

          case "format":
            handleFormat(action.format);
            return {};

          case "insertText": {
            if (!view) return {};
            const { state, dispatch } = view;
            const { from, to } = state.selection;
            let tr = state.tr.insertText(action.before, from);
            tr = tr.insertText(action.after ?? "", to + action.before.length);
            dispatch(tr);
            return {};
          }

          case "insertImage": {
            if (!view) return {};
            const { state, dispatch } = view;
            const { from } = state.selection;
            const node = editorSchema.nodes.image.create({
              src: action.src,
              alt: action.alt ?? "",
              title: action.title ?? "",
            });
            dispatch(state.tr.insert(from, node));
            return {};
          }

          case "insertGallery": {
            if (!view) return {};
            const { state, dispatch } = view;
            const { from } = state.selection;
            const imageNodes = action.srcs.map((src) =>
              editorSchema.nodes.image.create({ src }),
            );
            const galleryNode = editorSchema.nodes.gallery.create(
              { layout: "grid" },
              imageNodes,
            );
            dispatch(state.tr.insert(from, galleryNode));
            return {};
          }

          case "appendMarkdown": {
            if (!view) return {};
            const before = editorSerializer.serialize(view.state.doc);
            const parsed = parseMarkdownDoc(action.markdown);
            view.dispatch(
              view.state.tr.insert(view.state.doc.content.size, parsed.content),
            );
            view.focus();
            return { inverse: { type: "setMarkdown", content: before } };
          }

          case "replaceSelectionWithMarkdown": {
            if (!view) return {};
            const before = editorSerializer.serialize(view.state.doc);
            const { from, to } = view.state.selection;
            const parsed = parseMarkdownDoc(action.markdown);
            view.dispatch(view.state.tr.replaceWith(from, to, parsed.content));
            view.focus();
            return { inverse: { type: "setMarkdown", content: before } };
          }

          case "setMarkdown": {
            if (!view) return {};
            const before = editorSerializer.serialize(view.state.doc);
            isUpdatingFromProps.current = true;
            const tr = view.state.tr.replaceWith(
              0,
              view.state.doc.content.size,
              parseMarkdownDoc(action.content).content,
            );
            view.dispatch(tr);
            isUpdatingFromProps.current = false;
            view.focus();
            return { inverse: { type: "setMarkdown", content: before } };
          }

          case "setTTSHighlight": {
            const v = view;
            if (!v) return {};
            const tr = v.state.tr;
            tr.setMeta("ttsHighlight", action.range);
            if (action.range) {
              const from = Math.max(
                0,
                Math.min(action.range.from, v.state.doc.content.size),
              );
              tr.setSelection(TextSelection.create(v.state.doc, from));
              tr.scrollIntoView();
            }
            v.dispatch(tr);
            useUIStore.getState().setTTSHighlightRange(action.range);
            return {};
          }

          case "scrollToText": {
            if (!view) return {};
            const { state, dispatch } = view;
            const docText = state.doc.textContent;
            if (docText.indexOf(action.text) !== -1) {
              let pos = 1;
              let found = false;
              state.doc.descendants((node, nodePos) => {
                if (found) return false;
                if (node.isText) {
                  const nodeText = node.text || "";
                  const internalIndex = nodeText.indexOf(action.text);
                  if (internalIndex !== -1) {
                    pos = nodePos + internalIndex;
                    found = true;
                    return false;
                  }
                }
                return true;
              });
              if (found) {
                const tr = state.tr.setSelection(
                  TextSelection.create(state.doc, pos, pos + action.text.length),
                );
                tr.scrollIntoView();
                dispatch(tr);
                view.focus();
              }
            }
            return {};
          }

          case "scrollToPos": {
            const v = view;
            if (!v) return {};
            try {
              const { state, dispatch } = v;
              const resolvedPos = state.doc.resolve(
                Math.min(action.pos, state.doc.content.size),
              );
              const selection = TextSelection.create(state.doc, resolvedPos.pos);
              const tr = state.tr.setSelection(selection).scrollIntoView();
              dispatch(tr);
              v.focus();
            } catch (e) {
              console.error("Scroll to pos failed", e);
            }
            return {};
          }

          case "streamMarkdown": {
            if (!view) return {};
            const before = editorSerializer.serialize(view.state.doc);
            const { state, dispatch } = view;
            if (action.isNew) {
              streamStartRef.current = state.selection.from;
              streamEndRef.current = state.selection.to;
            }
            const from = streamStartRef.current ?? state.selection.from;
            const to = streamEndRef.current ?? state.selection.to;
            const parsed = parseMarkdownDoc(action.content);
            const tr = state.tr.replaceWith(from, to, parsed.content);
            streamEndRef.current = from + parsed.content.size;
            tr.scrollIntoView();
            dispatch(tr);
            return { inverse: { type: "setMarkdown", content: before } };
          }

          case "getSelectedText":
            return {
              value: view
                ? view.state.doc.textBetween(
                    view.state.selection.from,
                    view.state.selection.to,
                    " ",
                  )
                : "",
            };

          case "getHtml": {
            if (!view) return { value: "" };
            const fragment = DOMSerializer.fromSchema(
              editorSchema,
            ).serializeFragment(view.state.doc.content);
            const container = document.createElement("div");
            container.appendChild(fragment);
            return { value: container.innerHTML };
          }

          case "getDoc":
            return { value: view?.state.doc };

          case "getTextWithPositions": {
            if (!view) return { value: [] };
            const result: { text: string; pos: number }[] = [];
            view.state.doc.descendants((node, pos) => {
              if (node.isText) {
                result.push({ text: node.text || "", pos });
              }
            });
            return { value: result };
          }

          case "getHeadings": {
            if (!view) return { value: [] };
            const headings: {
              text: string;
              level: number;
              pos: number;
              id: string;
            }[] = [];
            view.state.doc.descendants((node, pos) => {
              if (node.type.name === "heading") {
                headings.push({
                  text: node.textContent,
                  level: node.attrs.level,
                  pos,
                  id: node.attrs.id || slugify(node.textContent),
                });
              }
            });
            return { value: headings };
          }

          case "getCursorContext":
            return { value: getCursorContextInternal(viewRef) };

          default:
            return {};
        }
      },
    }),
    [
      viewRef,
      editorSchema,
      parseMarkdownDoc,
      handleFormat,
      isUpdatingFromProps,
      streamStartRef,
      streamEndRef,
    ],
  );

  // Register the executor with the bus so dispatch/query reach the live editor.
  useEffect(() => {
    bus.setExecutor(executor);
    return () => bus.setExecutor(null);
  }, [bus, executor]);

  useImperativeHandle(
    ref,
    (): EditorRef => ({
      focus: () => bus.dispatch({ type: "focus" }),
      insertText: (before, after) =>
        bus.dispatch({ type: "insertText", before, after }),
      insertImage: (src, alt, title) =>
        bus.dispatch({ type: "insertImage", src, alt, title }),
      insertGallery: (srcs) => bus.dispatch({ type: "insertGallery", srcs }),
      appendMarkdown: (markdown) =>
        bus.dispatch({ type: "appendMarkdown", markdown }),
      replaceSelectionWithMarkdown: (markdown) =>
        bus.dispatch({ type: "replaceSelectionWithMarkdown", markdown }),
      setMarkdown: (content) => bus.dispatch({ type: "setMarkdown", content }),
      getSelectedText: () =>
        bus.query<string>({ type: "getSelectedText" }) ?? "",
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
      setTTSHighlight: (range) =>
        bus.dispatch({ type: "setTTSHighlight", range }),
      handleFormat: (type) => bus.dispatch({ type: "format", format: type }),
      getCursorContext: () =>
        bus.query<string>({ type: "getCursorContext" }) ?? "",
      scrollToText: (text) => bus.dispatch({ type: "scrollToText", text }),
      scrollToPos: (pos) => bus.dispatch({ type: "scrollToPos", pos }),
      streamMarkdown: (content, isNew) =>
        bus.dispatch({ type: "streamMarkdown", content, isNew }),
    }),
    [bus],
  );
}
