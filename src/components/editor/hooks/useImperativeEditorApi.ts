import { useImperativeHandle, type Ref, type MutableRefObject, type RefObject } from "react";
import { TextSelection } from "prosemirror-state";
import { DOMSerializer, type Schema, type Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { slugify } from "../../../lib/utils";
import { useUIStore } from "../../../stores/uiStore";
import type { EditorRef } from "../../ProseMirrorEditor";
import { getCursorContextInternal } from "./useAIStreaming";

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
 * (toolbars, AI sidebar, TTS, import). Operates on the live view via refs so
 * it never triggers a React re-render of the editor.
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
  useImperativeHandle(ref, () => ({
    focus: () => {
      viewRef.current?.focus();
    },
    insertText: (before: string, after: string = "") => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const { from, to } = state.selection;

      let tr = state.tr.insertText(before, from);
      tr = tr.insertText(after, to + before.length);
      dispatch(tr);
    },
    insertImage: (src: string, alt: string = "", title: string = "") => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const { from } = state.selection;

      const node = editorSchema.nodes.image.create({ src, alt, title });
      const tr = state.tr.insert(from, node);
      dispatch(tr);
    },
    insertGallery: (srcs: string[]) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const { from } = state.selection;

      const imageNodes = srcs.map((src) =>
        editorSchema.nodes.image.create({ src }),
      );
      const galleryNode = editorSchema.nodes.gallery.create(
        { layout: "grid" },
        imageNodes,
      );
      const tr = state.tr.insert(from, galleryNode);
      dispatch(tr);
    },
    insertScribble: () => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const { from } = state.selection;
      const node = editorSchema.nodes.scribble.create({ aspectRatio: 0.5 });
      const tr = state.tr.insert(from, node);
      dispatch(tr);
    },
    appendMarkdown: (content: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const parsed = parseMarkdownDoc(content);
      const tr = state.tr.insert(state.doc.content.size, parsed.content);
      dispatch(tr);
      viewRef.current.focus();
    },
    replaceSelectionWithMarkdown: (content: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const { from, to } = state.selection;
      const parsed = parseMarkdownDoc(content);
      const tr = state.tr.replaceWith(from, to, parsed.content);
      dispatch(tr);
      viewRef.current.focus();
    },
    getSelectedText: () => {
      if (!viewRef.current) return "";
      const { state } = viewRef.current;
      const { from, to } = state.selection;
      return state.doc.textBetween(from, to, " ");
    },
    getHtml: () => {
      if (!viewRef.current) return "";
      const fragment = DOMSerializer.fromSchema(
        editorSchema,
      ).serializeFragment(viewRef.current.state.doc.content);
      const container = document.createElement("div");
      container.appendChild(fragment);
      return container.innerHTML;
    },
    getDoc: () => {
      return viewRef.current?.state.doc;
    },
    getHeadings: () => {
      if (!viewRef.current) return [];
      const headings: {
        text: string;
        level: number;
        pos: number;
        id: string;
      }[] = [];
      viewRef.current.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          headings.push({
            text: node.textContent,
            level: node.attrs.level,
            pos: pos,
            id: node.attrs.id || slugify(node.textContent),
          });
        }
      });
      return headings;
    },
    getTextWithPositions: () => {
      if (!viewRef.current) return [];
      const result: { text: string; pos: number }[] = [];
      viewRef.current.state.doc.descendants((node, pos) => {
        if (node.isText) {
          result.push({ text: node.text || "", pos });
        }
      });
      return result;
    },
    setTTSHighlight: (range: { from: number; to: number } | null) => {
      const view = viewRef.current;
      if (!view) return;

      const tr = view.state.tr;
      tr.setMeta("ttsHighlight", range);
      if (range) {
        const from = Math.max(0, Math.min(range.from, view.state.doc.content.size));
        tr.setSelection(TextSelection.create(view.state.doc, from));
        tr.scrollIntoView();
      }
      view.dispatch(tr);

      useUIStore.getState().setTTSHighlightRange(range);
    },
    handleFormat: (type: string) => {
      handleFormat(type);
    },
    getCursorContext: () => {
      return getCursorContextInternal(viewRef);
    },
    scrollToText: (text: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      const docText = state.doc.textContent;
      const index = docText.indexOf(text);
      if (index !== -1) {
        let pos = 1;
        let found = false;
        state.doc.descendants((node, nodePos) => {
          if (found) return false;
          if (node.isText) {
            const nodeText = node.text || "";
            const internalIndex = nodeText.indexOf(text);
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
            TextSelection.create(state.doc, pos, pos + text.length),
          );
          tr.scrollIntoView();
          dispatch(tr);
          viewRef.current.focus();
        }
      }
    },
    scrollToPos: (pos: number) => {
      const view = viewRef.current;
      if (!view) return;

      try {
        const { state, dispatch } = view;
        const resolvedPos = state.doc.resolve(
          Math.min(pos, state.doc.content.size),
        );
        const selection = TextSelection.create(state.doc, resolvedPos.pos);
        const tr = state.tr.setSelection(selection).scrollIntoView();
        dispatch(tr);
        view.focus();
      } catch (e) {
        console.error("Scroll to pos failed", e);
      }
    },
    streamMarkdown: (content: string, isNew: boolean = false) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;

      if (isNew) {
        streamStartRef.current = state.selection.from;
        streamEndRef.current = state.selection.to;
      }

      const from = streamStartRef.current ?? state.selection.from;
      const to = streamEndRef.current ?? state.selection.to;

      const parsed = parseMarkdownDoc(content);
      const tr = state.tr.replaceWith(from, to, parsed.content);

      streamEndRef.current = from + parsed.content.size;

      tr.scrollIntoView();

      dispatch(tr);
    },
    setMarkdown: (content: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;
      isUpdatingFromProps.current = true;
      const tr = state.tr.replaceWith(
        0,
        state.doc.content.size,
        parseMarkdownDoc(content).content,
      );
      dispatch(tr);
      isUpdatingFromProps.current = false;
      viewRef.current.focus();
    },
  }));
}
