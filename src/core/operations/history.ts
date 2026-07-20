import type { EditorState, Transaction } from "prosemirror-state";
import { undo, redo } from "prosemirror-history";

/**
 * Native ProseMirror history operations. Undo/redo of text edits, marks and
 * block formatting flow through ProseMirror's `history` plugin (present in the
 * core's base plugin set), so every low-level mutation is reversible here.
 *
 * Programmatic, high-level commands (markdown replacements) additionally record
 * an `inverse` on the command bus; `CoreEditor.undo` (Phase 2) decides which
 * queue to consult. These helpers expose the raw native history so the core can
 * compose the final undo/redo behavior.
 */

/** Return the undo transaction for the current state, or `null` if none. */
export function applyUndo(state: EditorState): Transaction | null {
  let tr: Transaction | null = null;
  const handled = undo(state, (t) => {
    tr = t;
  });
  return handled ? tr : null;
}

/** Return the redo transaction for the current state, or `null` if none. */
export function applyRedo(state: EditorState): Transaction | null {
  let tr: Transaction | null = null;
  const handled = redo(state, (t) => {
    tr = t;
  });
  return handled ? tr : null;
}
