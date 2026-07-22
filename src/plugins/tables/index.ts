import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { InkPlugin } from "../types";

/**
 * Table sorting + per-row actions (delete handle, sort-on-header-click).
 * These are pure ProseMirror plugins with no editor-host coupling, so they
 * live here as a regular plugin contribution.
 */
const tableSortKey = new PluginKey("tableSort");

const tableSortPlugin = new Plugin({
  key: tableSortKey,
  props: {
    handleDOMEvents: {
      click(view, event) {
        const target = event.target as HTMLElement;
        const th = target.closest("th");
        if (!th) return false;

        const pos = view.posAtDOM(th, 0);
        if (pos === null) return false;

        const $pos = view.state.doc.resolve(pos);
        // Find the parent table node
        let tableDepth = -1;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "table") {
            tableDepth = d;
            break;
          }
        }
        if (tableDepth === -1) return false;

        const tableNode = $pos.node(tableDepth);
        const tablePos = $pos.before(tableDepth);

        // Find cell position info
        const cellNode = $pos.node($pos.depth);
        if (cellNode.type.name !== "table_header") return false;

        // Determine column index
        let columnIndex = -1;
        const headerRow = tableNode.firstChild;
        if (!headerRow) return false;
        headerRow.forEach((cell, _, i) => {
          if (cell === cellNode) columnIndex = i;
        });

        if (columnIndex === -1) return false;

        // Toggle sort based on current data-sort attribute (if any)
        const currentSort = th.getAttribute("data-sort");
        const ascending = currentSort !== "asc";

        // Collect rows
        const rows: any[] = [];
        tableNode.forEach((row: any) => rows.push(row));

        if (rows.length < 2) return true;

        const bodyRows = rows.slice(1);

        bodyRows.sort((a, b) => {
          const cellA = a.child(columnIndex).textContent.trim();
          const cellB = b.child(columnIndex).textContent.trim();

          const isNumA = !isNaN(Number(cellA)) && cellA !== "";
          const isNumB = !isNaN(Number(cellB)) && cellB !== "";

          if (isNumA && isNumB) {
            return ascending ? Number(cellA) - Number(cellB) : Number(cellB) - Number(cellA);
          }

          return ascending
            ? cellA.localeCompare(cellB, undefined, {
                numeric: true,
                sensitivity: "base",
              })
            : cellB.localeCompare(cellA, undefined, {
                numeric: true,
                sensitivity: "base",
              });
        });

        const newTable = tableNode.type.create(tableNode.attrs, [headerRow, ...bodyRows]);
        const tr = view.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        // Update data-sort attribute on the new table's header cell if possible
        const finalTable = tr.doc.nodeAt(tablePos);
        if (finalTable) {
          // Re-create the header row with the sort attribute on the target cell
          const cells: any[] = [];
          headerRow.forEach((cell: any, _: any, i: number) => {
            if (i === columnIndex) {
              cells.push(
                cell.type.create({ ...cell.attrs, sort: ascending ? "asc" : "desc" }, cell.content),
              );
            } else {
              cells.push(cell.type.create({ ...cell.attrs, sort: null }, cell.content));
            }
          });
          const newHeader = headerRow.type.create(headerRow.attrs, cells);
          tr.replaceWith(tablePos + 1, tablePos + 1 + headerRow.nodeSize, newHeader);
        }

        view.dispatch(tr);
        return true;
      },
    },
  },
});

const tableRowActionsKey = new PluginKey("tableRowActions");

const tableRowActionsPlugin = new Plugin({
  key: tableRowActionsKey,
  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, set) {
      set = set.map(tr.mapping, tr.doc);
      if (tr.docChanged) {
        const decorations: Decoration[] = [];
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "table_row") {
            const widget = document.createElement("div");
            widget.className = "table-row-delete-handle";
            widget.title = "Delete row";
            widget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

            // We use a closure or a data attribute to store the position since it might change
            // Actually DecorationSet.map handles position mapping
            widget.setAttribute("data-pos", pos.toString());
            widget.setAttribute("data-size", node.nodeSize.toString());

            decorations.push(Decoration.widget(pos + 1, widget, { key: `delete-${pos}` }));
          }
        });
        return DecorationSet.create(tr.doc, decorations);
      }
      return set;
    },
  },
  props: {
    decorations(state) {
      return tableRowActionsKey.getState(state);
    },
    handleDOMEvents: {
      mousedown(view, event) {
        const target = event.target as HTMLElement;
        const handle = target.closest(".table-row-delete-handle");
        if (handle) {
          event.preventDefault();
          event.stopPropagation();

          // Re-find the handle pos using ProseMirror state because it might have shifted
          const posAtDom = view.posAtDOM(handle, 0);
          if (posAtDom === null) return false;

          // Find the row node
          const $pos = view.state.doc.resolve(posAtDom);
          const rowNode = $pos.node($pos.depth);
          if (rowNode.type.name !== "table_row") return false;

          const rowPos = $pos.before($pos.depth);

          // Check if it's the only row in the table (maybe we want to delete the whole table then?)
          const tableNode = $pos.node($pos.depth - 1);
          if (tableNode.childCount <= 1) {
            const tablePos = $pos.before($pos.depth - 1);
            view.dispatch(view.state.tr.delete(tablePos, tablePos + tableNode.nodeSize));
          } else {
            view.dispatch(view.state.tr.delete(rowPos, rowPos + rowNode.nodeSize));
          }
          return true;
        }
        return false;
      },
    },
  },
});

export const tablesPlugin: InkPlugin = {
  id: "tables",
  name: "Tables",
  version: "1.0.0",
  init(ctx) {
    // Shared instances: identical to the previous module-scope singletons,
    // so every editor continues to reuse the same plugin objects.
    ctx.registerProsePlugin(tableSortPlugin);
    ctx.registerProsePlugin(tableRowActionsPlugin);
  },
};
