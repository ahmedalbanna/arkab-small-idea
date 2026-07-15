import { Node, Slice, Fragment } from "prosemirror-model";
import { isDiagramLang } from "../diagrams/engine";

/**
 * Converts `code_block` nodes whose language is a diagram language into the
 * dedicated `diagram` leaf node. Used after every markdown parse so that
 * fenced diagram blocks (typed by the user, pasted, or produced by AI) become
 * real diagram nodes.
 *
 * Must run on a document whose schema actually contains the `diagram` node.
 */
export function diagramTransform(doc: Node): Node {
  if (!doc) return doc;
  const diagramType = doc.type.schema.nodes.diagram;
  if (!diagramType) return doc;

  const matches: { pos: number; size: number; lang: string; source: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "code_block") {
      const lang = (node.attrs.params || "").trim().toLowerCase();
      if (isDiagramLang(lang)) {
        matches.push({
          pos,
          size: node.nodeSize,
          lang,
          source: node.textContent,
        });
      }
    }
  });

  if (matches.length === 0) return doc;

  // Process from the end so earlier positions stay valid after replacements.
  matches.sort((a, b) => b.pos - a.pos);

  let result = doc;
  for (const m of matches) {
    const diagramNode = diagramType.create({ lang: m.lang, source: m.source });
    result = result.replace(
      m.pos,
      m.pos + m.size,
      new Slice(Fragment.from(diagramNode), 0, 0),
    );
  }
  return result;
}
