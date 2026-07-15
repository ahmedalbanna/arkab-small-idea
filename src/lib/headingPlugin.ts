import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const collapsibleKey = new PluginKey("collapsible");

function chevronSvg(isCollapsed: boolean): string {
  return isCollapsed
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
}

function buildChevron(view: any, pos: number, isCollapsed: boolean): HTMLElement {
  const span = document.createElement("span");
  span.className = "heading-chevron";
  span.innerHTML = chevronSvg(isCollapsed);
  span.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dispatch(view.state.tr.setMeta(collapsibleKey, { type: "toggle", pos }));
  });
  return span;
}

/**
 * Turns headings into collapsible sections. The collapse marker state lives in the
 * plugin, while the visible chevron and the `collapsed-content`/`is-collapsed` styles
 * are added as decorations — no node view required.
 */
export function createHeadingPlugin(): Plugin {
  return new Plugin({
    key: collapsibleKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(collapsibleKey);
        if (meta && meta.type === "toggle") {
          const { pos } = meta;
          const existing = set.find(pos, pos + 1, (spec) => spec.type === "collapsed-marker");
          if (existing.length) {
            return set.remove(existing);
          }
          const node = tr.doc.nodeAt(pos);
          if (!node) return set;
          return set.add(tr.doc, [
            Decoration.node(pos, pos + node.nodeSize, {}, { type: "collapsed-marker" }),
          ]);
        }
        return set;
      },
    },
    props: {
      decorations(state) {
        const collapsedSet = collapsibleKey.getState(state) as DecorationSet;
        if (!collapsedSet || collapsedSet.find().length === 0) {
          // Still render chevrons for every heading.
          return buildHeadingDecorations(state.doc, DecorationSet.empty);
        }
        return buildHeadingDecorations(state.doc, collapsedSet);
      },
    },
  });
}

function buildHeadingDecorations(doc: any, collapsedSet: DecorationSet): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== "heading") return;

    const isCollapsed =
      collapsedSet.find(pos, pos + 1, (spec) => spec.type === "collapsed-marker").length > 0;

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: isCollapsed ? "collapsible-heading is-collapsed" : "collapsible-heading",
      }),
    );

    decorations.push(
      Decoration.widget(
        pos + 1,
        (view) => buildChevron(view, pos, isCollapsed),
        { side: -1, key: `heading-chevron-${pos}-${isCollapsed}`, stopEvent: () => true },
      ),
    );
  });

  if (collapsedSet.find().length > 0) {
    collapsedSet.find().forEach((collapsedDeco) => {
      const startPos = collapsedDeco.from;
      const headingNode = doc.nodeAt(startPos);
      if (!headingNode || headingNode.type.name !== "heading") return;

      const level = headingNode.attrs.level;
      let endPos = doc.content.size;

      doc.nodesBetween(startPos + headingNode.nodeSize, doc.content.size, (node, pos) => {
        if (endPos !== doc.content.size) return false;
        if (node.type.name === "heading" && node.attrs.level <= level) {
          endPos = pos;
          return false;
        }
      });

      if (endPos > startPos + headingNode.nodeSize) {
        decorations.push(
          Decoration.node(startPos + headingNode.nodeSize, endPos, {
            class: "collapsed-content",
          }),
        );
      }
    });
  }

  return DecorationSet.create(doc, decorations);
}
