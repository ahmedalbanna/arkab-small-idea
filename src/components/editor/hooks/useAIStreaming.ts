import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type { Node } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { draftHighlightKey } from "../../../lib/draftPlugin";
import { executeAIAction, type AIAssistantAction } from "../../../services/aiService";
import { setHandler } from "../../../plugins/ai/aiHandlerRegistry";
import { editorSerializer } from "./useMarkdownSerializer";
import type { PluginContext, EditorCommand } from "../../../plugins/types";
import type { SlashMenuState } from "../../../stores/aiUIStore";
import { useEditorCommandBus } from "../../../plugins/editorCommandContext";
import type { CoreEditor } from "@core/CoreEditor";
import { getSectionMarkdown, getSelectedMarkdown } from "@core/operations/query";

/** Which part of the document the AI action will operate on. */
export type AIScope = "sel" | "section" | "doc";

/** Snapshot of the AI draft currently being generated / reviewed. */
export interface AIDraftState {
  isStreaming: boolean;
  content: string;
  originalText: string;
  action: AIAssistantAction | null;
  from: number;
  to: number;
  showActions: boolean;
  y: number;
  abortController: AbortController | null;
  originalSelection: { from: number; to: number };
  streamEnd: number;
  customInstruction?: string;
  scope: AIScope;
}

type AIDecision = "replace" | "append" | "retry" | "cancel";

/** Builds the surrounding heading path + current block text for AI context. */
export function getCursorContextInternal(viewRef: RefObject<EditorView | null>): string {
  if (!viewRef.current) return "";
  const { state } = viewRef.current;
  const { $from } = state.selection;
  const depth = $from.depth;

  const start = depth > 0 ? $from.start(depth) : 0;
  const end = depth > 0 ? $from.end(depth) : state.doc.content.size;
  const currentPara = state.doc.textBetween(start, end, " ");

  const headingPath: string[] = [];
  let pos = $from.pos;
  while (pos > 0) {
    const $pos = state.doc.resolve(pos);
    const node = $pos.parent;
    if (node && node.type.name === "heading") {
      headingPath.unshift(node.textContent);
    }

    if ($pos.depth > 0) {
      pos = $pos.before();
    } else {
      break;
    }

    if (pos === 0) break;
  }

  const pathStr = headingPath.length > 0 ? `Path: ${headingPath.join(" > ")}` : "";
  return `${pathStr}\n\n${currentPara}`.trim();
}

interface AIStreamingParams {
  viewRef: RefObject<EditorView | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  parseMarkdownDoc: (md: string) => Node;
  /** Latest props snapshot, kept in a ref to avoid stale closures. */
  latestProps: MutableRefObject<any>;
  loaded: { context: PluginContext } | null;
  slashMenu: SlashMenuState;
  setSlashMenu: (v: (prev: SlashMenuState) => SlashMenuState) => void;
  setBubbleMenu: (v: (prev: any) => any) => void;
  handleFormat: (type: string) => void;
  onImageUploadRequest?: () => void;
  /** Shared with the imperative API (`streamMarkdown`). */
  streamStartRef: MutableRefObject<number | null>;
  streamEndRef: MutableRefObject<number | null>;
  /** Unique editor id, used to scope the AI action handler (fixes multi-editor). */
  editorId: string;
}

/**
 * Owns all AI-draft state and the handlers that drive inline generation:
 * `handleAIAction` (stream + replace selection), `handleAIActionDecision`
 * (approve / append / retry / cancel), the slash-menu selection handlers, and
 * the bridge that lets the `ai` plugin's keymap invoke `handleAIAction`.
 */
export function useAIStreaming({
  viewRef,
  containerRef,
  parseMarkdownDoc,
  latestProps,
  loaded,
  slashMenu,
  setSlashMenu,
  setBubbleMenu,
  handleFormat,
  onImageUploadRequest,
  editorId,
}: AIStreamingParams) {
  const bus = useEditorCommandBus();
  // AI Draft State
  const [aiDraft, setAiDraft] = useState<AIDraftState | null>(null);
  const aiDraftRef = useRef(aiDraft);
  useEffect(() => {
    aiDraftRef.current = aiDraft;
  }, [aiDraft]);

  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const handleAIAction = async (
    action: AIAssistantAction,
    retryText?: string,
    retryAction?: AIAssistantAction,
    retryFrom?: number,
    retryTo?: number,
    customInstruction?: string,
    scope?: AIScope,
  ) => {
    if (!viewRef.current) return;

    const { state } = viewRef.current;
    const effectiveScope = scope ?? "sel";
    let from = retryFrom ?? state.selection.from;
    let to = retryTo ?? state.selection.to;

    // Determine the text range and serialized content based on scope.
    let selectedText: string;

    switch (effectiveScope) {
      case "doc": {
        // Whole document: use full markdown.
        from = 0;
        to = state.doc.content.size;
        selectedText = editorSerializer.serialize(state.doc);
        break;
      }
      case "section": {
        // Heading-bounded section: use getSectionMarkdown via the query.
        selectedText = getSectionMarkdown(state, from);
        break;
      }
      default:
      case "sel": {
        // Selection: use markdown-serialized selection (preserving formatting).
        if (retryText) {
          selectedText = retryText;
        } else if (from !== to) {
          selectedText = getSelectedMarkdown(state);
        } else {
          // Collapsed selection: use the current block content.
          const { $from } = state.selection;
          const depth = $from.depth;
          const blockStart = depth > 0 ? $from.start(depth) : 0;
          const blockEnd = depth > 0 ? $from.end(depth) : state.doc.content.size;
          from = blockStart;
          to = blockEnd;
          const sliced = state.doc.slice(blockStart, blockEnd);
          const tempDoc = state.doc.type.create({}, sliced.content);
          selectedText = editorSerializer.serialize(tempDoc);
        }
        break;
      }
    }

    if (!selectedText.trim()) return;

    const abortController = new AbortController();

    // Clamp coordsAtPos to prevent RangeError crashes when the position is
    // temporarily out of bounds (e.g. during streaming when the doc hasn't
    // caught up with the parsed content size yet).
    const safeCoordsAtPos = (pos: number) => {
      if (!viewRef.current) return null;
      const clampedPos = Math.max(0, Math.min(pos, viewRef.current.state.doc.content.size));
      try {
        return viewRef.current.coordsAtPos(clampedPos);
      } catch {
        return null;
      }
    };

    const coords = safeCoordsAtPos(to);
    const editorRect = containerRef.current?.getBoundingClientRect();
    const y = coords?.bottom ?? (editorRect?.top ?? 0) + 40;

    const initialDraftState: AIDraftState = {
      isStreaming: true,
      content: "",
      originalText: selectedText,
      action: retryAction ?? action,
      from,
      to,
      showActions: false,
      y: y + 20,
      abortController,
      originalSelection: { from, to },
      streamEnd: to,
      customInstruction,
      scope: effectiveScope,
    };

    setAiDraft(initialDraftState);
    setIsProcessingAI(true);
    setBubbleMenu((prev) => ({ ...prev, show: false }));

    try {
      const fullDoc = editorSerializer.serialize(state.doc);
      const cursorContext = getCursorContextInternal(viewRef);

      let fullResponse = "";
      const streamStart = from;
      let streamEnd = to;

      await executeAIAction({
        text: selectedText,
        action: retryAction ?? action,
        scope: effectiveScope,
        customInstruction,
        personalInstructions: latestProps.current.personalInstructions,
        model: latestProps.current.selectedModel,
        provider: latestProps.current.provider as any,
        apiKeys: latestProps.current.apiKeys,
        providerConfigs: latestProps.current.providerConfigs,
        signal: abortController.signal,
        documentContext: fullDoc,
        cursorContext,
        onChunk: (chunk) => {
          fullResponse += chunk;

          if (viewRef.current) {
            // Content mutation through the bus (Bus-Centric Architecture).
            // The executor's streamMarkdown handler manages core.streamRange
            // to accumulate chunks correctly. Pass `streamStart` explicitly as
            // `from` so the executor uses the same origin as the hook (P0.3 fix).
            // CRITICAL: Pass `editorId` so the command routes to THIS editor's
            // executor, not the first available one (fixes cross-editor AI bleed).
            const isNew = fullResponse.length === chunk.length;
            bus.dispatch(
              {
                type: "streamMarkdown",
                content: fullResponse,
                isNew,
                from: streamStart,
              },
              { source: "ai", editorId },
            );

            // Read the end position from the executor's streamRange, which is
            // the single source of truth. This replaces the dual-parser approach
            // that previously caused drift between the blue highlight and the
            // actual replaced range (P0.2 fix).
            const core = (viewRef.current as any)._core as CoreEditor | undefined;
            const executorEnd = core?.streamRange?.to;
            if (executorEnd !== undefined && executorEnd >= streamStart) {
              streamEnd = executorEnd;
            } else {
              // Fallback: compute from the parser (shouldn't happen in practice).
              const parsed = parseMarkdownDoc(fullResponse);
              streamEnd = streamStart + parsed.content.size;
            }

            // UI-only decoration (draft highlight) — not a document mutation,
            // so it stays at the view level as a ProseMirror decoration.
            const decoTr = viewRef.current.state.tr
              .setMeta(draftHighlightKey, {
                from: streamStart,
                to: streamEnd,
                isGenerating: true,
              })
              .scrollIntoView();
            viewRef.current.dispatch(decoTr);

            setAiDraft((prev) =>
              prev
                ? {
                    ...prev,
                    content: fullResponse,
                    to: streamEnd,
                    streamEnd,
                  }
                : null,
            );
          }
        },
      });

      if (viewRef.current) {
        // Decoration-only update: clear the "generating" state on the
        // highlight. The content was already streamed through the bus.
        const decoTr = viewRef.current.state.tr.setMeta(draftHighlightKey, {
          from: streamStart,
          to: streamEnd,
          isGenerating: false,
        });
        viewRef.current.dispatch(decoTr);

        const finalCoords = safeCoordsAtPos(streamEnd);
        const finalY = finalCoords?.bottom ?? (editorRect?.top ?? 0) + 40;

        setAiDraft((prev) =>
          prev
            ? {
                ...prev,
                isStreaming: false,
                showActions: true,
                to: streamEnd,
                streamEnd,
                y: finalY + 10,
              }
            : null,
        );
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("AI Action failed:", error);
        alert("Failed to process AI request. Check console for details.");
      }
      // Restore original content via bus: use the atomic replaceRangeWithMarkdown
      // (P0.1) instead of setSelection + replaceSelectionWithMarkdown, so the
      // range is self-contained and not subject to stale-selection drift.
      // CRITICAL: Pass `editorId` to route to THIS editor's executor.
      const restoreTo = aiDraftRef.current?.streamEnd ?? initialDraftState.to;
      bus.dispatch(
        {
          type: "replaceRangeWithMarkdown",
          from: initialDraftState.from,
          to: restoreTo,
          markdown: initialDraftState.originalText,
        },
        { source: "ai", editorId },
      );
      // Clear the highlight decoration via view (UI-only).
      if (viewRef.current) {
        const decoTr = viewRef.current.state.tr.setMeta(draftHighlightKey, null);
        viewRef.current.dispatch(decoTr);
      }
      setAiDraft(null);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleAIActionDecision = (decision: AIDecision) => {
    if (!aiDraftRef.current || !viewRef.current) return;
    const draft = aiDraftRef.current;

    // Clear the highlight decoration (UI-only).
    const clearDeco = true;

    if (decision === "cancel") {
      bus.dispatch(
        {
          type: "replaceRangeWithMarkdown",
          from: draft.from,
          to: draft.streamEnd,
          markdown: draft.originalText,
        },
        { source: "ai", editorId },
      );
    } else if (decision === "append") {
      // Restore original, then append the draft below it.
      bus.dispatch(
        {
          type: "replaceRangeWithMarkdown",
          from: draft.from,
          to: draft.streamEnd,
          markdown: draft.originalText,
        },
        { source: "ai", editorId },
      );
      bus.dispatch(
        { type: "insertText", before: "\n\n" + draft.content },
        { source: "ai", editorId },
      );
    } else if (decision === "retry") {
      // Replace the AI range with the original text, then restart.
      bus.dispatch(
        {
          type: "replaceRangeWithMarkdown",
          from: draft.from,
          to: draft.streamEnd,
          markdown: draft.originalText,
        },
        { source: "ai", editorId },
      );
      // clearDeco intentionally NOT set here — decoration stays visible while
      // the retry generates new content.

      // Restart the AI action on the restored range.
      const parsedOrg = parseMarkdownDoc(draft.originalText);
      handleAIAction(
        draft.action!,
        draft.originalText,
        draft.action!,
        draft.from,
        draft.from + parsedOrg.content.size,
        draft.customInstruction,
        draft.scope,
      );
      return;
    }
    // "replace" — keep the AI content as-is; no bus dispatch needed
    // (the AI content is already in the document via streaming).

    if (clearDeco && viewRef.current) {
      const decoTr = viewRef.current.state.tr.setMeta(draftHighlightKey, null);
      viewRef.current.dispatch(decoTr);
    }
    setAiDraft(null);
    viewRef.current.focus();
  };

  // Deletes the "/query" text the user typed to open the slash menu and
  // returns the start position of the deleted range (for AI block actions).
  const deleteSlashText = (): number => {
    if (!viewRef.current) return 0;
    const { state } = viewRef.current;
    const endPos = state.selection.from;
    const startPos = slashMenu.pos - 1;
    const finalStart = Math.max(0, Math.min(startPos, state.doc.content.size));
    const finalEnd = Math.max(finalStart, Math.min(endPos, state.doc.content.size));
    bus.dispatch({ type: "deleteRange", from: finalStart, to: finalEnd }, { source: "user:slash" });
    return finalStart;
  };

  const handleSlashSelect = async (action: string) => {
    if (!viewRef.current) return;
    const finalStart = deleteSlashText();

    const afterDeleteState = viewRef.current.state;
    setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));

    if (action === "h1") handleFormat("h1");
    else if (action === "h2") handleFormat("h2");
    else if (action === "align-left") handleFormat("alignLeft");
    else if (action === "align-center") handleFormat("alignCenter");
    else if (action === "align-right") handleFormat("alignRight");
    else if (action === "align-justify") handleFormat("alignJustify");
    else if (action === "bullet") handleFormat("bullet");
    else if (action.startsWith("todo-")) {
      const priority = action.replace("todo-", "");
      let priorityTag = "";
      switch (priority) {
        case "high":
          priorityTag = "(H)";
          break;
        case "medium":
          priorityTag = "(M)";
          break;
        case "low":
          priorityTag = "(L)";
          break;
      }
      bus.dispatch(
        { type: "insertText", before: `- [ ] ${priorityTag} ` },
        { source: "user:slash" },
      );
    } else if (action === "code")
      bus.dispatch({ type: "format", format: "code" }, { source: "user:slash" });
    else if (action === "scribble")
      bus.dispatch(
        { type: "insertNodeAt", nodeName: "scribble", attrs: { aspectRatio: 0.5 } },
        { source: "user:slash" },
      );
    else if (action === "tableify") {
      handleFormat("tableify");
    } else if (action === "image") onImageUploadRequest?.();
    else if (action === "gallery") {
      onImageUploadRequest?.();
    } else if (action === "quote") {
      handleFormat("quote");
    } else if (
      ["improve", "outline", "summarize", "rewrite", "complete-text"].includes(action) ||
      action.startsWith("ai-")
    ) {
      const type = action.replace("ai-", "") as AIAssistantAction;

      const resolvedPos = afterDeleteState.doc.resolve(
        Math.min(finalStart, afterDeleteState.doc.content.size),
      );
      const depth = resolvedPos.depth;

      const start = depth > 0 ? resolvedPos.start(depth) : 0;
      const end = depth > 0 ? resolvedPos.end(depth) : afterDeleteState.doc.content.size;

      try {
        bus.dispatch({ type: "setSelection", from: start, to: end }, { source: "user:slash" });
        await handleAIAction(type);
      } catch (err) {
        console.error("Failed to set selection for AI action:", err);
        await handleAIAction(type);
      }
    }

    viewRef.current.focus();
  };

  // Runs a plugin-contributed slash command after removing the "/query" text.
  const handlePluginSlashSelect = (cmd: EditorCommand) => {
    if (!viewRef.current) return;
    deleteSlashText();
    setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));
    cmd.run(loaded?.context as PluginContext);
  };

  // Abort any in-flight AI stream on unmount (fixes A2).
  useEffect(() => {
    return () => {
      aiDraft?.abortController?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bridge the inline AI draft handler to the `ai` plugin's keymap (which is
  // registered at the plugin level so it is removed when the plugin is
  // disabled). The handler is coupled to this component's local `aiDraft`
  // state, so it is registered here on mount.
  const handleAIActionRef = useRef(handleAIAction);
  // eslint-disable-next-line react-hooks/refs
  handleAIActionRef.current = handleAIAction;
  useEffect(() => {
    setHandler(editorId, (a, ci, s) => {
      handleAIActionRef.current(
        a as AIAssistantAction,
        undefined,
        undefined,
        undefined,
        undefined,
        ci,
        s,
      );
    });
    return () => setHandler(editorId, null);
  }, [editorId]);

  return {
    aiDraft,
    isProcessingAI,
    handleAIAction,
    handleAIActionDecision,
    handleSlashSelect,
    handlePluginSlashSelect,
  };
}
