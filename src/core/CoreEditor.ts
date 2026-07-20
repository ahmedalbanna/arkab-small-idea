import { EditorState, Transaction } from "prosemirror-state";
import type { Schema, Node } from "prosemirror-model";
import { EditorCommandBus } from "./commands/commandBus";
import type { EditorCommandAction } from "./commands/commandBus";
import { createHeadlessExecutor } from "./commands/executor";
import { createMarkdownIO, serializeDoc, type MarkdownIO } from "./serialization/markdown";
import { getHtml as getHtmlOp } from "./operations/html";
import {
  getSelectedText,
  getDoc,
  getHeadings,
  getTextWithPositions,
  getCursorContext,
} from "./operations/query";
import { applyUndo, applyRedo } from "./operations/history";
import { setMarkdown } from "./operations/markdown";
import { noopStorage, type CoreConfig, type Draft, type StorageAdapter } from "./types";
import { countWords } from "./util/words";

/** Listener notified after every state change. `tr` is the transaction that
 * produced the new state (or `null` when the listener is invoked manually). */
export type StateListener = (state: EditorState, tr: Transaction | null) => void;

/**
 * The headless editor controller — the "brain" of Ink & Quill.
 *
 * `CoreEditor` owns the document `EditorState` and is the single source of
 * truth for the document. It applies every mutation through `apply`, which
 * advances the state and notifies subscribers (the React view subscribes and
 * adopts the new state). It exposes the stable internal API requested for the
 * headless core: `insertText`, `executeCommand`, `undo`, `redo`, plus draft
 * persistence and queries.
 *
 * Crucially, this class imports only headless packages and never a live view,
 * so it runs identically in the browser, in tests, or in any non-DOM host.
 */
export class CoreEditor {
  /** Resolved schema (provided by the UI's plugin loader). */
  readonly schema: Schema;
  /** Markdown IO bound to the schema. */
  readonly io: MarkdownIO;
  /** The command bus this core drives. */
  readonly bus: EditorCommandBus;

  /** Streaming cursor for `streamMarkdown`, maintained by the executor. */
  streamRange?: { from: number; to: number };

  private _state: EditorState;
  private storage: StorageAdapter;
  private listeners = new Set<StateListener>();

  constructor(config: CoreConfig = {}) {
    if (!config.schema) {
      throw new Error("CoreEditor requires a `schema` in its config.");
    }
    this.schema = config.schema;
    this.storage = config.storage ?? noopStorage;
    this.io = createMarkdownIO(this.schema, config.postProcess);

    const doc = config.initialMarkdown
      ? this.io.parse(config.initialMarkdown)
      : this.schema.nodes.doc.createAndFill()!;

    this._state = EditorState.create({
      schema: this.schema,
      doc,
      plugins: config.prosePlugins ?? [],
    });

    this.bus = new EditorCommandBus();
    this.bus.setExecutor(createHeadlessExecutor(this));
  }

  // --- State access & mutation -------------------------------------------

  /** The current document state. Treat as read-only; mutate via `apply`. */
  getState(): EditorState {
    return this._state;
  }

  /**
   * Apply a transaction, advancing the document state and notifying listeners.
   * This is the single mutation entry point — commands, the UI, and external
   * callers all flow through here so history and subscriptions stay coherent.
   */
  apply(tr: Transaction): EditorState {
    this._state = this._state.apply(tr);
    this.emit(tr);
    return this._state;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(tr: Transaction | null): void {
    for (const fn of this.listeners) fn(this._state, tr);
  }

  // --- Command API --------------------------------------------------------

  /** Insert text at the selection (`insertText` from the requested API). */
  insertText(before: string, after = ""): void {
    this.bus.dispatch({ type: "insertText", before, after });
  }

  /** Execute a typed editor command (`executeCommand` from the requested API). */
  executeCommand(action: EditorCommandAction): void {
    this.bus.dispatch(action);
  }

  /** Run a query command and return its value. */
  query<T = unknown>(action: EditorCommandAction): T | undefined {
    return this.bus.query<T>(action);
  }

  /**
   * Undo the most recent change. Uses ProseMirror's native history, which
   * tracks every transaction applied via `apply` (text, marks, markdown
   * replacements, …) so a single `undo` reverts correctly regardless of the
   * command type. `bus.undo()` remains available for callers that specifically
   * want the recorded command-history semantics.
   */
  undo(): void {
    const tr = applyUndo(this._state);
    if (tr) this.apply(tr);
  }

  /** Redo the most recently undone change (native history). */
  redo(): void {
    const tr = applyRedo(this._state);
    if (tr) this.apply(tr);
  }

  // --- Convenience queries -------------------------------------------------

  getMarkdown(): string {
    return serializeDoc(this._state.doc);
  }

  /** Serialize the document to HTML. Requires a DOM environment. */
  getHtml(): string {
    return getHtmlOp(this._state, this.schema);
  }

  getDoc(): Node {
    return getDoc(this._state);
  }

  getHeadings() {
    return getHeadings(this._state);
  }

  getCursorContext(): string {
    return getCursorContext(this._state);
  }

  getSelectedText(): string {
    return getSelectedText(this._state);
  }

  getTextWithPositions() {
    return getTextWithPositions(this._state);
  }

  /** Replace the whole document with markdown (convenience wrapper). */
  setMarkdown(content: string): void {
    this.executeCommand({ type: "setMarkdown", content });
  }

  /**
   * Seed the document from markdown without recording an undo entry. Used to
   * initialize the editor from external content (the `value` prop) before the
   * controlled `EditorView` is built.
   */
  initDoc(markdown: string): void {
    const doc = this.io.parse(markdown);
    const tr = this._state.tr
      .replaceWith(0, this._state.doc.content.size, doc.content)
      .setMeta("addToHistory", false);
    this.apply(tr);
  }

  /**
   * Replace the whole document from markdown. By default records an undo entry;
   * pass `{ recordHistory: false }` for controlled prop updates that shouldn't
   * pollute the user's undo stack.
   */
  replaceDoc(markdown: string, opts?: { recordHistory?: boolean }): void {
    const doc = this.io.parse(markdown);
    const tr = this._state.tr.replaceWith(
      0,
      this._state.doc.content.size,
      doc.content,
    );
    if (opts?.recordHistory === false) tr.setMeta("addToHistory", false);
    this.apply(tr);
  }

  // --- Draft persistence ---------------------------------------------------

  /** Persist the current document as a draft snapshot. */
  async saveDraft(pageId: string, userNote?: string): Promise<Draft> {
    const content = this.getMarkdown();
    const draft: Draft = {
      pageId,
      content,
      timestamp: Date.now(),
      wordCount: countWords(content),
      userNote,
    };
    return this.storage.saveDraft(draft);
  }

  /** List all drafts for a page, newest first. */
  listDrafts(pageId: string): Promise<Draft[]> {
    return this.storage.loadDrafts(pageId);
  }

  /** Load the most recent draft for a page, or `null` if none. */
  async loadDraft(pageId: string): Promise<Draft | null> {
    const drafts = await this.storage.loadDrafts(pageId);
    return drafts.length > 0 ? drafts[0] : null;
  }

  // --- Lifecycle -----------------------------------------------------------

  /** Tear down: detach the executor and clear subscribers. */
  destroy(): void {
    this.bus.setExecutor(null);
    this.listeners.clear();
  }
}
