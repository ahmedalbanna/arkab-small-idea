import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownParser,
} from "prosemirror-markdown";
import type { Node, Schema } from "prosemirror-model";

/**
 * Markdown serialization / parsing for the headless core.
 *
 * `editorSerializer` is schema-independent — it maps node/mark *names* to
 * serialize functions and never captures a concrete `Schema` instance — so it
 * is constructed once at module load and reused for any schema. The parser,
 * by contrast, is bound to a schema, so `buildMarkdownParser(schema)` is called
 * whenever the (possibly plugin-extended) schema changes.
 *
 * Diagram code blocks are converted to real `diagram` nodes by the UI-supplied
 * `postProcess` hook (see `createMarkdownIO`); the core itself stays free of
 * the diagram-rendering adapters, which are browser/DOM-coupled.
 */

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

/** Build a markdown parser bound to the given schema. */
export function buildMarkdownParser(schema: Schema): MarkdownParser {
  // Start from the default parser tokens (safe for any schema that includes the
  // base node/marks). Custom tokens are only added when the concrete schema
  // actually defines the referenced node/mark types — `MarkdownParser` throws
  // on unknown types, so we must never reference a type the schema lacks (e.g.
  // `scribble`/`table`/`strike`/`underline` are absent from the base schema).
  const tokens: any = { ...((defaultMarkdownParser as any).tokens || {}) };

  if (schema.marks.strike) {
    tokens.s = { mark: "strike" };
    tokens.strike = { mark: "strike" };
  }
  if (schema.marks.underline) {
    tokens.u = { mark: "underline" };
  }
  if (schema.nodes.scribble) {
    tokens.scribble = {
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
    };
  }
  if (
    schema.nodes.table &&
    schema.nodes.table_row &&
    schema.nodes.table_header &&
    schema.nodes.table_cell
  ) {
    Object.assign(tokens, tableTokens);
  }

  return new MarkdownParser(schema, tokenizer, tokens);
}

/** Serialize a document node to markdown. */
export function serializeDoc(doc: Node): string {
  return editorSerializer.serialize(doc);
}

/** A markdown <-> document IO pair bound to one schema. */
export interface MarkdownIO {
  /** Parse markdown into a document node (post-processed, e.g. diagrams). */
  parse(markdown: string): Node;
  /** Serialize a document node to markdown. */
  serialize(doc: Node): string;
}

/**
 * Create a markdown IO bound to `schema`.
 *
 * @param schema       Resolved ProseMirror schema.
 * @param postProcess  Optional transform applied to every parsed doc (e.g.
 *                     converting diagram code blocks to `diagram` nodes). Kept
 *                     optional so the core stays free of the browser-coupled
 *                     diagram adapters; the UI injects `diagramTransform`.
 */
export function createMarkdownIO(
  schema: Schema,
  postProcess: (doc: Node) => Node = (d) => d,
): MarkdownIO {
  const parser = buildMarkdownParser(schema);
  return {
    parse(markdown: string): Node {
      const parsed = parser.parse(markdown);
      const doc = parsed ?? schema.nodes.doc.createAndFill()!;
      return postProcess(doc);
    },
    serialize(doc: Node): string {
      return editorSerializer.serialize(doc);
    },
  };
}
