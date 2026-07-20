import type { Transaction } from "prosemirror-state";
import type { EditorCommandAction } from "../commands/commandBus";

/**
 * Result of a pure document operation.
 *
 * - `tr` is the transaction to apply to the core's `EditorState`.
 * - `inverse` is the command that undoes this one. It is omitted for
 *   operations that should be undone through ProseMirror's native history
 *   (e.g. `insertText`, `format`) — matching the existing executor behavior.
 */
export interface OpResult {
  tr: Transaction;
  inverse?: EditorCommandAction;
}
