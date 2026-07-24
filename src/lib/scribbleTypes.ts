/**
 * Pure types and helpers for the Scribble stroke model.
 * Zero DOM / canvas dependencies — fully unit-testable.
 */

/** A single continuous stroke. */
export interface Stroke {
  /** Unique identifier for this stroke (used for erase hit-testing). */
  id: string;
  /** CSS colour string (e.g. "#000000", "#ff0000"). */
  color: string;
  /** Stroke width in pixels. */
  width: number;
  /** Drawing mode — always "draw"; eraser is a separate operation. */
  mode: "draw";
  /** Ordered list of sample points (x, y in SVG viewBox coords). */
  points: [number, number][];
}

/**
 * Build an SVG path `d` string from a stroke's points.
 * - 0 points → empty string
 * - 1 point → a small dot circle (M x y-1 a 1 1 0 1 0 2 0 a 1 1 0 1 0-2 0)
 * - 2+ points → polyline (M x0 y0 L x1 y1 L x2 y2 …)
 */
export function strokeToPathD(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    // A tiny circle that renders as a visible dot even at width=1.
    return `M ${x} ${y - 1} a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0`;
  }
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

/**
 * Squared distance between two 2D points.
 */
function sqDist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Minimum distance from a point `p` to the line segment defined by `a`–`b`.
 * Returns a positive number (not squared — callers expect pixel distance).
 */
function pointToSegmentDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.sqrt(sqDist(p, a)); // a and b are coincident

  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  t = Math.max(0, Math.min(1, t)); // clamp to segment

  const projX = a[0] + t * abx;
  const projY = a[1] + t * aby;
  return Math.sqrt(sqDist(p, [projX, projY]));
}

/**
 * Minimum distance from a query point to the nearest segment of a stroke.
 */
export function distanceToStroke(point: [number, number], stroke: Stroke): number {
  const { points } = stroke;
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.sqrt(sqDist(point, points[0]));

  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDist(point, points[i], points[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Find the first stroke (by id) whose distance from `point` is ≤ `threshold`.
 * Returns `null` when no stroke is close enough.
 */
export function hitTestStrokes(
  point: [number, number],
  strokes: Stroke[],
  threshold: number,
): string | null {
  for (const s of strokes) {
    if (distanceToStroke(point, s) <= threshold) return s.id;
  }
  return null;
}
