import { useEffect, useRef } from "react";
import { usePluginServices } from "../appContext";
import {
  documentIndexCache,
  countLines,
  MIN_CHANGE_CHARS,
  TYPING_PAUSE_MS,
} from "../../services/documentIndexCache";

// ── Size thresholds for user notifications ──────────────────────────────
const LARGE_DOC_THRESHOLD = 500; // lines
const HUGE_DOC_THRESHOLD = 2000; // lines

// ── Debounce timing ─────────────────────────────────────────────────────
const IDLE_DEBOUNCE_MS = 15000; // 15s during active typing
const PAGE_SWITCH_DEBOUNCE_MS = 1000; // 1s on page switch (content already indexed)
const TYPING_PAUSE_DEBOUNCE_MS = 5000; // 5s after last keystroke, same as TYPING_PAUSE_MS

/**
 * App-level lifecycle effects:
 *  - auto-snapshot the active document every 5 minutes,
 *  - debounced RAG indexing with performance safeguards,
 *  - snapshot on page unload.
 *
 * ## Performance Design (Large Document Fixes)
 *
 * ### Problem: RAG indexing on every keystroke
 * Before this fix, every `markdown` change (including every keystroke) would
 * trigger a 5-second debounce, followed by full document chunking + embedding.
 *
 * ### Solutions applied:
 * 1. **Longer debounce (15s)** — Only index after 15 seconds of inactivity.
 *    During active typing, the debounce keeps getting reset.
 * 2. **Typing pause detection** — Uses `documentIndexCache.hasTypingPaused()`
 *    to ensure indexing only fires after the user has stopped typing for 5s.
 * 3. **Small-change filter** — Changes < 50 characters are ignored entirely.
 *    Single keystrokes don't trigger indexing.
 * 4. **`requestIdleCallback()`** — The actual indexing is deferred to browser
 *    idle periods so it never blocks typing or UI updates.
 * 5. **Session cache** — Content hash comparison skips re-indexing when the
 *    page content hasn't changed (e.g. page switch with same content).
 */
export function DocumentLifecycleHost(): null {
  const { pluginContext } = usePluginServices();

  // ── Access stores through context ──────────────────────────────────
  const editorStore = pluginContext.stores?.editor;
  const aiStore = pluginContext.stores?.ai;
  const uiStore = pluginContext.stores?.ui;

  const { pages, activeFocusedPageId } = editorStore?.getState() ?? {
    pages: [],
    activeFocusedPageId: null,
  };

  const activePage = pages.find((p) => p.id === activeFocusedPageId) || pages[0];
  const markdown = activePage?.content || "";

  // ── RAG service (may be null if rag plugin is disabled) ─────────────
  const ragService = pluginContext.ragService;

  // Track the previous active page ID to detect page switches
  const prevPageIdRef = useRef<string | null>(null);

  // ── Auto-snapshot every 5 minutes ──────────────────────────────────
  useEffect(() => {
    if (!activePage || !editorStore) return;
    const addSnapshot = editorStore.getState().addSnapshot;

    const interval = setInterval(
      () => {
        addSnapshot(activePage.id, activePage.content || "");
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [activePage, editorStore]);

  // ── Debounced RAG indexing with performance safeguards ─────────────
  useEffect(() => {
    if (!ragService || !aiStore) return;

    const pageId = activePage?.id || "__no_page__";
    const wasPageSwitch = prevPageIdRef.current !== null && prevPageIdRef.current !== pageId;

    // ═══════════════════════════════════════════════════════════════════
    // PERFORMANCE CHECK 1: Session cache — skip if content unchanged
    // ═══════════════════════════════════════════════════════════════════
    if (wasPageSwitch && !documentIndexCache.shouldIndex(pageId, markdown)) {
      console.info(
        `RAG: Skipping re-index for page "${pageId}" (content unchanged since last index).`,
      );
      prevPageIdRef.current = pageId;
      return;
    }
    prevPageIdRef.current = pageId;

    // ═══════════════════════════════════════════════════════════════════
    // PERFORMANCE CHECK 2: Small-change filter
    // ═══════════════════════════════════════════════════════════════════
    // If the document changed by fewer than MIN_CHANGE_CHARS, skip indexing.
    // This prevents single-character keystrokes from triggering indexing.
    if (!wasPageSwitch && !documentIndexCache.shouldIndexByChangeSize(pageId, markdown)) {
      return;
    }

    // Track the change so hasTypingPaused works correctly
    documentIndexCache.recordChange(pageId);

    // ── Show warning for large documents ─────────────────────────────
    const lineCount = countLines(markdown);
    if (uiStore && lineCount > LARGE_DOC_THRESHOLD) {
      const warningMsg =
        lineCount > HUGE_DOC_THRESHOLD
          ? `This document is very large (${lineCount} lines). Indexing may take a moment.`
          : `This document is large (${lineCount} lines). Only the current section will be used for AI context.`;
      console.info(`RAG: ${warningMsg}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PERFORMANCE CHECK 3: Typing pause detection
    // ═══════════════════════════════════════════════════════════════════
    // Only schedule indexing if the user has stopped typing for TYPING_PAUSE_MS.
    // This prevents indexing during back-to-back keystrokes.
    const debounceMs = wasPageSwitch
      ? PAGE_SWITCH_DEBOUNCE_MS
      : documentIndexCache.hasTypingPaused(pageId, TYPING_PAUSE_MS)
        ? TYPING_PAUSE_DEBOUNCE_MS
        : IDLE_DEBOUNCE_MS;

    const timeout = setTimeout(() => {
      // ═══════════════════════════════════════════════════════════════════
      // PERFORMANCE CHECK 4: Double-check typing pause before indexing
      // ═══════════════════════════════════════════════════════════════════
      if (!documentIndexCache.hasTypingPaused(pageId, TYPING_PAUSE_MS)) {
        // User is still typing — skip this round
        return;
      }

      // Read embedding options from the AI store at call time
      const state = aiStore.getState();
      const embeddingOptions = {
        provider: state.serviceConfigs?.embeddings?.provider,
        apiKey: state.apiKeys?.[state.serviceConfigs?.embeddings?.provider as string],
        model: state.serviceConfigs?.embeddings?.model,
      };

      // ═══════════════════════════════════════════════════════════════════
      // PERFORMANCE CHECK 5: Use requestIdleCallback to defer indexing
      // ═══════════════════════════════════════════════════════════════════
      // This moves the actual embedding work off the critical path so it
      // never blocks typing, rendering, or other UI updates.
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(
          () => {
            ragService.indexDocument(markdown, embeddingOptions);
          },
          { timeout: 3000 },
        );
      } else {
        // Fallback for environments without requestIdleCallback (SSR, test)
        ragService.indexDocument(markdown, embeddingOptions);
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [markdown, ragService, aiStore, activePage, uiStore]);

  // ── Snapshot on page unload ────────────────────────────────────────
  useEffect(() => {
    if (!activePage || !editorStore) return;

    const handleBeforeUnload = () => {
      const addSnapshot = editorStore.getState().addSnapshot;
      addSnapshot(activePage.id, activePage.content || "");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activePage, editorStore]);

  return null;
}
