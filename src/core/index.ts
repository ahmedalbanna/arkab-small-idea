/**
 * Public surface of the Ink & Quill headless core (`@core`).
 *
 * This module imports only headless packages (`prosemirror-state`,
 * `prosemirror-model`, `prosemirror-commands`, `prosemirror-history`, …) and
 * never React, `prosemirror-view`, the Zustand stores, or any DOM-rendering
 * code. It is safe to use in Node, tests, and any future non-DOM host.
 */

export * from "./types";
export * from "./commands/commandBus";
export * from "./commands/executor";
export * from "./shortcuts/shortcuts";
export * from "./serialization/markdown";
export * from "./operations";
export { CoreEditor } from "./CoreEditor";
export type { StateListener } from "./CoreEditor";
export { slugify } from "./util/slugify";
export { countWords } from "./util/words";

// NOTE: `CoreEditor` (the controller that wires these operations into a live,
// state-owning instance with undo/redo, shortcuts and draft persistence) is
// introduced in Phase 2 and re-exported here when ready.
