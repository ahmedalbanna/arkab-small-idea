import { useCallback, useMemo } from "react";
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownParser,
} from "prosemirror-markdown";
import type { Node, Schema } from "prosemirror-model";
import { diagramTransform } from "../../../lib/markdown/diagramTransform";
import { buildEditorSchema } from "../../../plugins/editor/schema";
import type { LoadedPlugins } from "../../../plugins";

// Custom serializer to handle our new marks and tables.
// Schema-independent, so it is constructed once at module load.
export const editorSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    paragraph: (state, node) => {
      if (node.attrs.align && node.attrs.align !== "left") {
        state.write(`<p style="text-align: ${node.attrs.align}">`);
        state.renderInline(node);
        state.write("</p>\n\n");
      } else {
        state.renderInline(node);
        state.closeBlock(node);
      }
    },
    heading: (state, node) => {
      if (node.attrs.align && node.attrs.align !== "left") {
        state.write(`<h${node.attrs.level} style="text-align: ${node.attrs.align}">`);
        state.renderInline(node);
        state.write(`</h${node.attrs.level}>\n\n`);
      } else {
        state.write(state.repeat("#", node.attrs.level) + " ");
        state.renderInline(node);
        state.closeBlock(node);
      }
    },
    table: (state, node) => {
      state.write("\n");
      state.renderContent(node);
      state.write("\n");
    },
    table_row: (state, node) => {
      state.write("| ");
      node.forEach((cell, _, i) => {
        if (i > 0) state.write(" | ");
        state.renderContent(cell);
      });
      state.write(" |\n");

      // Write separator if this is the first row
      if (node.childCount > 0 && node.child(0).type.name === "table_header") {
        state.write("|");
        node.forEach((cell) => {
          const align = cell.attrs.align || "left";
          if (align === "center") state.write(" :---: |");
          else if (align === "right") state.write(" ---: |");
          else state.write(" --- |");
        });
        state.write("\n");
      }
    },
    table_cell: (state, node) => {
      state.renderContent(node);
    },
    table_header: (state, node) => {
      state.renderContent(node);
    },
    gallery: (state, node) => {
      state.write("\n");
      state.renderContent(node);
      state.write("\n");
    },
    scribble: (state, node) => {
      state.write("\n```scribble\n");
      state.write(`aspect: ${node.attrs.aspectRatio}\n`);
      if (node.attrs.data) {
        state.write(`${node.attrs.data}\n`);
      }
      state.write("```\n");
    },
    diagram: (state, node) => {
      state.write("```" + (node.attrs.lang || "") + "\n");
      state.text(node.attrs.source || "", false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strike: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    underline: { open: "<u>", close: "</u>", mixable: true },
  },
);

const tableTokens = {
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: { block: "table_header" },
  td: { block: "table_cell" },
};

const tokenizer = (defaultMarkdownParser as any).tokenizer;
if (tokenizer && tokenizer.enable) {
  tokenizer.enable("table");
}

/**
 * Derives the editor schema, a markdown parser bound to it, and a
 * `parseMarkdownDoc` helper. The schema is built once by the plugin system
 * (`loadPlugins`) and surfaced through `PluginContext`; every editor helper
 * and the live editor state read it, so any schema contribution a plugin makes
 * is reflected everywhere. The `buildEditorSchema()` fallback keeps the parser
 * usable before the first load resolves.
 */
export function useMarkdownSerializer(loaded: LoadedPlugins | null) {
  const editorSchema: Schema = loaded?.context.schema ?? buildEditorSchema();

  // Markdown parser — rebuilt only when the schema changes.
  const editorParser = useMemo(
    () =>
      new MarkdownParser(editorSchema, tokenizer, {
        ...((defaultMarkdownParser as any).tokens || {}),
        s: { mark: "strike" },
        strike: { mark: "strike" },
        u: { mark: "underline" },
        scribble: {
          block: "scribble",
          getAttrs: (tok: any) => {
            const lines = tok.content.split("\n");
            const aspectLine = lines.find((l: string) => l.startsWith("aspect:"));
            const data = lines.find((l: string) => l.startsWith("data:image"));
            return {
              data: data || null,
              aspectRatio: aspectLine ? parseFloat(aspectLine.split(":")[1]) : 0.5,
            };
          },
        },
        ...tableTokens,
      }),
    [editorSchema],
  );

  const parseMarkdownDoc = useCallback(
    (md: string): Node => {
      const parsed = editorParser.parse(md);
      const doc = parsed ?? editorSchema.nodes.doc.createAndFill()!;
      return diagramTransform(doc);
    },
    [editorParser, editorSchema],
  );

  return { editorSchema, editorParser, parseMarkdownDoc };
}
