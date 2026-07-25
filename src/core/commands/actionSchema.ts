/**
 * Zod schema for runtime validation of `EditorCommandAction`.
 *
 * Every action dispatched through `EditorCommandBus.dispatch()` or `query()`
 * is validated against this schema in dev/test mode, catching type mismatches
 * before they reach the executor. In production the check is skipped for
 * performance; the TypeScript compiler already guarantees type safety for
 * well-typed call sites.
 *
 * The schema mirrors the `EditorCommandAction` discriminated union exactly.
 * When adding a new action type you must extend both the TypeScript type (in
 * `commandBus.ts`) and this schema.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Action schemas – each maps to one member of the `EditorCommandAction` union
// ---------------------------------------------------------------------------

/**
 * Recognised format identifiers — the only values that `type: "format"` actions
 * may carry. Any other string is rejected at the schema level (in dev/test) so
 * that unknown format names never reach the executor.
 */
export const VALID_FORMATS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "h1",
  "h2",
  "h3",
  "paragraph",
  "bullet",
  "numbered",
  "quote",
  "alignLeft",
  "alignCenter",
  "alignRight",
  "alignJustify",
  "link",
  "tableify",
] as const;

const focusSchema = z.object({ type: z.literal("focus") });

const formatSchema = z.object({
  type: z.literal("format"),
  format: z.enum(VALID_FORMATS, `format must be one of: ${VALID_FORMATS.join(", ")}`),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const insertTextSchema = z.object({
  type: z.literal("insertText"),
  before: z.string(),
  after: z.string().optional(),
});

const insertImageSchema = z.object({
  type: z.literal("insertImage"),
  src: z.string().min(1, "src must be a non-empty URL or path"),
  alt: z.string().optional(),
  title: z.string().optional(),
});

const insertGallerySchema = z.object({
  type: z.literal("insertGallery"),
  srcs: z.array(z.string().min(1)).min(1, "srcs must contain at least one image source"),
});

const appendMarkdownSchema = z.object({
  type: z.literal("appendMarkdown"),
  markdown: z.string(),
});

const replaceSelectionWithMarkdownSchema = z.object({
  type: z.literal("replaceSelectionWithMarkdown"),
  markdown: z.string(),
});

const setMarkdownSchema = z.object({
  type: z.literal("setMarkdown"),
  content: z.string(),
});

const setTTSHighlightSchema = z.object({
  type: z.literal("setTTSHighlight"),
  range: z.object({ from: z.number().min(0), to: z.number().min(0) }).nullable(),
});

const scrollToTextSchema = z.object({
  type: z.literal("scrollToText"),
  text: z.string().min(1, "text must be non-empty"),
});

const scrollToPosSchema = z.object({
  type: z.literal("scrollToPos"),
  pos: z.number().min(0, "pos must be >= 0"),
});

const replaceRangeWithMarkdownSchema = z.object({
  type: z.literal("replaceRangeWithMarkdown"),
  from: z.number().min(0),
  to: z.number().min(0),
  markdown: z.string(),
});

const streamMarkdownSchema = z.object({
  type: z.literal("streamMarkdown"),
  content: z.string(),
  isNew: z.boolean().optional(),
  from: z.number().min(0).optional(),
});

// Undo / Redo
const undoSchema = z.object({ type: z.literal("undo") });
const redoSchema = z.object({ type: z.literal("redo") });

// Selection & Range
const setSelectionSchema = z.object({
  type: z.literal("setSelection"),
  from: z.number().min(0),
  to: z.number().min(0),
});

const deleteRangeSchema = z.object({
  type: z.literal("deleteRange"),
  from: z.number().min(0),
  to: z.number().min(0),
});

const insertNodeAtSchema = z.object({
  type: z.literal("insertNodeAt"),
  nodeName: z.string().min(1, "nodeName must be non-empty"),
  attrs: z.record(z.string(), z.unknown()).optional(),
  pos: z.number().min(0).optional(),
});

// Queries
const getSelectedTextSchema = z.object({ type: z.literal("getSelectedText") });
const getHtmlSchema = z.object({ type: z.literal("getHtml") });
const getDocSchema = z.object({ type: z.literal("getDoc") });
const getTextWithPositionsSchema = z.object({
  type: z.literal("getTextWithPositions"),
});
const getHeadingsSchema = z.object({ type: z.literal("getHeadings") });
const getCursorContextSchema = z.object({ type: z.literal("getCursorContext") });
const getCursorPosSchema = z.object({ type: z.literal("getCursorPos") });
const getSelectedMarkdownSchema = z.object({ type: z.literal("getSelectedMarkdown") });
const getSectionMarkdownSchema = z.object({
  type: z.literal("getSectionMarkdown"),
  pos: z.number().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Composed discriminated union – order does not matter because the
// discriminator (`type`) routes each object to the correct branch.
// ---------------------------------------------------------------------------

export const EditorCommandActionSchema = z.discriminatedUnion("type", [
  focusSchema,
  formatSchema,
  insertTextSchema,
  insertImageSchema,
  insertGallerySchema,
  appendMarkdownSchema,
  replaceSelectionWithMarkdownSchema,
  replaceRangeWithMarkdownSchema,
  setMarkdownSchema,
  setTTSHighlightSchema,
  scrollToTextSchema,
  scrollToPosSchema,
  streamMarkdownSchema,
  undoSchema,
  redoSchema,
  setSelectionSchema,
  deleteRangeSchema,
  insertNodeAtSchema,
  getSelectedTextSchema,
  getHtmlSchema,
  getDocSchema,
  getTextWithPositionsSchema,
  getHeadingsSchema,
  getCursorContextSchema,
  getCursorPosSchema,
  getSelectedMarkdownSchema,
  getSectionMarkdownSchema,
]);

// ---------------------------------------------------------------------------
// Issue formatter – mirrors `formatIssues` in `contributionSchemas.ts` but
// lives in core so the command bus need not depend on plugin code.
// ---------------------------------------------------------------------------

/**
 * Format Zod validation issues into a serializable shape for log messages.
 * Each entry has `path` (the dotted property path) and `message`.
 */
export function formatZodIssues(
  issues: { path: ReadonlyArray<string | number | symbol>; message: string }[],
): { path: string; message: string }[] {
  return issues.map((i) => ({
    path: i.path.map((seg) => String(seg)).join("."),
    message: i.message,
  }));
}
