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
export * from "./serialization/markdown";
export * from "./operations";
export { slugify } from "./util/slugify";

// NOTE: `CoreEditor` (the controller that wires these operations into a live,
// state-owning instance with undo/redo, shortcuts and draft persistence) is
// introduced in Phase 2 and re-exported here when ready.
