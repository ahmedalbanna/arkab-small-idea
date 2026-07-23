/**
 * Position-validation helpers for editor commands.
 *
 * These functions clamp ProseMirror document positions to the valid range
 * ([0, doc.content.size]) so that every command that manipulates the
 * document by position can share a single, tested bounds checker instead
 * of sprinkling `Math.min` / `Math.max` calls throughout the executor.
 *
 * An empty document (size === 0) returns `null`, signalling to the caller
 * that the document has no content to operate on.
 */
import type { EditorState } from "prosemirror-state";

/**
 * Clamp a single document position to the valid range `[0, max]`.
 *
 * @returns The clamped position, or `null` if the document is empty.
 */
export function clampPosition(state: EditorState, pos: number): number | null {
  const max = state.doc.content.size;
  if (max === 0) return null;
  return Math.max(0, Math.min(pos, max));
}

/**
 * Clamp a `{from, to}` position pair to the valid document range.
 *
 * - Negative positions are raised to 0.
 * - Positions beyond `doc.content.size` are lowered to that limit.
 * - `to` is never smaller than `from` (if `from > to`, both are clamped
 *   to the same value).
 *
 * @returns A clamped `{from, to}` tuple, or `null` if the document is
 *          empty (so positions have no meaning).
 */
export function clampPositions(
  state: EditorState,
  from: number,
  to?: number,
): { from: number; to: number } | null {
  const max = state.doc.content.size;
  if (max === 0) return null;

  const clampedFrom = Math.max(0, Math.min(from, max));
  const clampedTo = to !== undefined ? Math.max(clampedFrom, Math.min(to, max)) : clampedFrom;

  return { from: clampedFrom, to: clampedTo };
}
