import type { InkPlugin } from "../types";
import { DocumentLifecycleHost } from "./DocumentLifecycleHost";

/**
 * Owns document-level lifecycle effects (snapshots, RAG indexing, vector-store
 * initialization) that used to live in `App.tsx`. The host component is
 * registered so the app shell renders it once.
 */
export const documentPlugin: InkPlugin = {
  id: "document",
  name: "Document Lifecycle",
  version: "1.0.0",
  essential: true,
  init(ctx) {
    ctx.registerHost(DocumentLifecycleHost);
  },
};
