import { useCallback, type RefObject } from "react";
import { EditorState } from "prosemirror-state";
import { Slice } from "prosemirror-model";
import { toggleMark, setBlockType, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import type { Schema, Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

interface FormattingParams {
  viewRef: RefObject<EditorView | null>;
  editorSchema: Schema;
  parseMarkdownDoc: (md: string) => Node;
}

const wrapInBlock =
  (type: any) => (state: EditorState, dispatch: any) => {
    return wrapIn(type)(state, dispatch);
  };

/**
 * Returns `handleFormat`, the single entry point for toolbar / menu formatting
 * actions (marks, block types, alignment, list conversion and tableify).
 *
 * Operates directly on the live editor view's current selection.
 */
export function useFormatting({
  viewRef,
  editorSchema,
  parseMarkdownDoc,
}: FormattingParams) {
  const handleFormat = useCallback(
    (type: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;

      const setAlign = (alignment: string) => {
        const { from, to } = state.selection;
        let tr = state.tr;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (
            node.type.name === "paragraph" ||
            node.type.name === "heading"
          ) {
            tr.setNodeMarkup(pos, null, { ...node.attrs, align: alignment });
          }
        });
        if (tr.docChanged) dispatch(tr);
      };

      if (type === "bold")
        toggleMark(editorSchema.marks.strong)(state, dispatch);
      if (type === "italic")
        toggleMark(editorSchema.marks.em)(state, dispatch);
      if (type === "underline")
        toggleMark(editorSchema.marks.underline)(state, dispatch);
      if (type === "strike")
        toggleMark(editorSchema.marks.strike)(state, dispatch);
      if (type === "code")
        toggleMark(editorSchema.marks.code)(state, dispatch);
      if (type === "h1")
        setBlockType(editorSchema.nodes.heading, { level: 1 })(state, dispatch);
      if (type === "h2")
        setBlockType(editorSchema.nodes.heading, { level: 2 })(state, dispatch);
      if (type === "h3")
        setBlockType(editorSchema.nodes.heading, { level: 3 })(state, dispatch);
      if (type === "quote")
        wrapInBlock(editorSchema.nodes.blockquote)(state, dispatch);
      if (type === "paragraph")
        setBlockType(editorSchema.nodes.paragraph)(state, dispatch);
      if (type === "numbered")
        wrapInList(editorSchema.nodes.ordered_list)(state, dispatch);
      if (type === "alignLeft") setAlign("left");
      if (type === "alignCenter") setAlign("center");
      if (type === "alignRight") setAlign("right");
      if (type === "alignJustify") setAlign("justify");
      if (type === "bullet")
        wrapInList(editorSchema.nodes.bullet_list)(state, dispatch);
      if (type === "tableify") {
        const { from, to } = state.selection;
        const selectedText = state.doc.textBetween(from, to, "\n");
        if (selectedText.trim()) {
          const lines = selectedText
            .split("\n")
            .filter((l) => l.trim().length > 0);
          if (lines.length > 0) {
            const delimiters = ["|", "\t", ","];
            let bestDelimiter = delimiters[0];
            let maxCols = 0;

            for (const delim of delimiters) {
              const cols = lines[0].split(delim).length;
              if (cols > maxCols) {
                maxCols = cols;
                bestDelimiter = delim;
              }
            }

            const processLine = (line: string) => {
              let cols = line.split(bestDelimiter);
              if (bestDelimiter === "|") {
                cols = cols.filter((c, i) => {
                  if ((i === 0 || i === cols.length - 1) && c.trim() === "")
                    return false;
                  return true;
                });
              }
              return cols.map((c) => c.trim());
            };

            const tableData = lines.map(processLine);
            const colCount = Math.max(...tableData.map((r) => r.length));

            let markdownTable = "";
            const header = [...tableData[0]];
            while (header.length < colCount)
              header.push(`Header ${header.length + 1}`);
            markdownTable += "| " + header.join(" | ") + " |\n";
            markdownTable +=
              "| " + Array(colCount).fill("---").join(" | ") + " |\n";

            for (let i = 1; i < tableData.length; i++) {
              const row = [...tableData[i]];
              while (row.length < colCount) row.push("");
              markdownTable += "| " + row.join(" | ") + " |\n";
            }

            const slice = parseMarkdownDoc(markdownTable);
            dispatch(state.tr.replaceSelection(new Slice(slice.content, 0, 0)));
          }
        }
      }

      viewRef.current.focus();
    },
    [viewRef, editorSchema, parseMarkdownDoc],
  );

  return { handleFormat };
}
