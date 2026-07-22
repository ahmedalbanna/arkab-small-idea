import { forwardRef, useCallback, useEffect, useId, useRef } from "react";
import { Selection, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type AIAssistantAction } from "../services/aiService";
import { cn } from "../lib/utils";
import { SlashMenu } from "./SlashMenu";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAIUIStore } from "../stores/aiUIStore";
import { usePluginLoader } from "./editor/hooks/usePluginLoader";
import { useMarkdownSerializer } from "./editor/hooks/useMarkdownSerializer";
import { useEditorView } from "./editor/hooks/useEditorView";
import { useSearchSync } from "./editor/hooks/useSearchSync";
import { useMarkdownSync } from "./editor/hooks/useMarkdownSync";
import { useFormatting } from "./editor/hooks/useFormatting";
import { useImperativeEditorApi } from "./editor/hooks/useImperativeEditorApi";
import { useAIStreaming } from "./editor/hooks/useAIStreaming";
import { CommandPalette } from "./editor/CommandPalette";
import { BubbleMenuOverlay } from "./editor/menus/BubbleMenuOverlay";
import { AIStreamOverlay } from "./editor/menus/AIStreamOverlay";
import { SideMenuOverlay } from "./editor/menus/SideMenuOverlay";
import { ContextMenu } from "./editor/menus/ContextMenu";
import type { LoadedPlugins } from "../plugins";
import type { EditorCommand } from "../plugins/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  className?: string;
  placeholder?: string;
  fontSize?: number;
  direction?: "ltr" | "rtl";
  personalInstructions?: string;
  selectedModel?: string;
  provider?: string;
  apiKeys?: any;
  providerConfigs?: any;
  onAiResult?: (result: string) => void;
  onAiStream?: (chunk: string, isNew?: boolean) => void;
  onImageUploadRequest?: () => void;
  onSearchMetadata?: (count: number, current: number) => void;
  onSelectionChange?: (selection: { from: number; to: number }) => void;
  onScroll?: () => void;
  initialCursor?: { from: number; to: number };
  searchQuery?: string;
  searchOptions?: {
    isCaseSensitive: boolean;
    isWholeWord: boolean;
    isSemantic: boolean;
    searchIndex: number;
    currentMatchIndex: number;
    embeddingOptions?: { provider?: string; apiKey?: string; model?: string };
  };
  collab?: {
    enabled: boolean;
    docId: string;
    username?: string;
  };
  /**
   * Stable id scoping this editor's menu UI (side menu, bubble menu, context
   * menu, slash menu) so multiple editors on screen don't share one global
   * menu. When omitted a stable id is generated for this instance.
   */
  editorId?: string;
  /** Called once, after this editor's plugins have finished loading. */
  onLoaded?: (loaded: LoadedPlugins) => void;
}

export interface EditorRef {
  focus: () => void;
  insertText: (before: string, after?: string) => void;
  insertImage: (src: string, alt?: string, title?: string) => void;
  insertGallery: (srcs: string[]) => void;
  appendMarkdown: (markdown: string) => void;
  replaceSelectionWithMarkdown: (markdown: string) => void;
  getSelectedText: () => string;
  getHtml: () => string;
  getDoc: () => any;
  getTextWithPositions: () => { text: string; pos: number }[];
  getHeadings: () => { text: string; level: number; pos: number; id: string }[];
  setTTSHighlight: (range: { from: number; to: number } | null) => void;
  handleFormat: (type: string) => void;
  getCursorContext: () => string;
  scrollToText: (text: string) => void;
  scrollToPos: (pos: number) => void;
  streamMarkdown: (content: string, isNew?: boolean) => void;
  setMarkdown: (content: string) => void;
}

/**
 * Editor-wide keyboard shortcuts.
 * Centralised here so they are discoverable and maintainable instead of
 * being inlined in the keydown handler.
 */
const EDITOR_SHORTCUTS = {
  /** Ctrl/⌘ + Shift + P → open command palette */
  COMMAND_PALETTE: { ctrlShift: true, key: "p" },
  /** Ctrl/⌘ + Shift + K → focus the AI custom instruction input */
  FOCUS_AI_INSTRUCTION: { ctrlShift: true, key: "k" },
} as const;

const ProseMirrorEditor = forwardRef<EditorRef, Props>(
  (
    {
      value,
      onChange,
      onKeyDown,
      className,
      placeholder,
      fontSize,
      direction = "ltr",
      personalInstructions,
      selectedModel = "mistral",
      provider = "ollama",
      apiKeys,
      providerConfigs,
      onAiResult,
      onAiStream,
      onImageUploadRequest,
      onSearchMetadata,
      onSelectionChange,
      onScroll,
      initialCursor,
      searchQuery = "",
      searchOptions = {
        isCaseSensitive: false,
        isWholeWord: false,
        isSemantic: false,
        searchIndex: -1,
        currentMatchIndex: 0,
      },
      collab,
      editorId,
      onLoaded,
    },
    ref,
  ) => {
    // Stable id that scopes this editor's menu state. A generated id keeps
    // single-editor / test usage working without an explicit prop.
    const generatedEditorId = useId();
    const myEditorId = editorId ?? generatedEditorId;

    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView>(null);
    const isUpdatingFromProps = useRef(false);
    const streamStartRef = useRef<number | null>(null);
    const streamEndRef = useRef<number | null>(null);

    // Use a ref to store the latest props to avoid stale closures in ProseMirror callbacks/plugins
    const latestProps = useRef({
      onChange,
      onKeyDown,
      onSearchMetadata,
      onSelectionChange,
      onScroll,
      onAiResult,
      onAiStream,
      searchOptions,
      searchQuery,
      personalInstructions,
      selectedModel,
      provider,
      apiKeys,
      providerConfigs,
    });

    useEffect(() => {
      latestProps.current = {
        onChange,
        onKeyDown,
        onSearchMetadata,
        onSelectionChange,
        onScroll,
        onAiResult,
        onAiStream,
        searchOptions,
        searchQuery,
        personalInstructions,
        selectedModel,
        provider,
        apiKeys,
        providerConfigs,
      };
    });

    // Editor menu UI state lives in `aiUIStore` (lifted from here) so the
    // `editorUI` plugin's ProseMirror plugins can drive it and the menu
    // components can render it. These replace the previous local `useState`
    // values; the store setters keep the same functional-update API.
    const bubbleMenu = useAIUIStore((s) => s.bubbleMenu);
    const setBubbleMenu = useAIUIStore((s) => s.setBubbleMenu);
    const slashMenu = useAIUIStore((s) => s.slashMenu);
    const setSlashMenu = useAIUIStore((s) => s.setSlashMenu);
    const contextMenu = useAIUIStore((s) => s.contextMenu);
    const setContextMenu = useAIUIStore((s) => s.setContextMenu);
    const sideMenu = useAIUIStore((s) => s.sideMenu);
    const commandPaletteOpen = useAIUIStore((s) => s.commandPaletteOpen);
    const setCommandPaletteOpen = useAIUIStore((s) => s.setCommandPaletteOpen);

    // Open the command palette with the editor-standard shortcut.
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        if (meta && shift && key === EDITOR_SHORTCUTS.COMMAND_PALETTE.key) {
          e.preventDefault();
          setCommandPaletteOpen(true);
          return;
        }

        // Mod-Shift-K: focus the AI toolbar's custom instruction input.
        if (meta && shift && key === EDITOR_SHORTCUTS.FOCUS_AI_INSTRUCTION.key) {
          e.preventDefault();
          const bm = useAIUIStore.getState().bubbleMenu;
          if (bm.editorId === myEditorId && bm.show) {
            // Bubble menu (with embedded AI toolbar) is visible — focus the
            // custom instruction input directly.
            const input = containerRef.current?.querySelector<HTMLInputElement>(
              '[data-testid="ai-custom-instruction"]',
            );
            input?.focus();
          }
          return;
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [setCommandPaletteOpen, myEditorId]);

    // Run a palette command through the live plugin context and close the palette.
    const handleRunCommand = (cmd: EditorCommand) => {
      if (loaded?.context) cmd.run(loaded.context);
      setCommandPaletteOpen(false);
    };

    // --- Composed hooks (single-responsibility slices) -------------------
    const loaded = usePluginLoader(viewRef, onLoaded, collab, myEditorId);
    const { editorSchema, parseMarkdownDoc } = useMarkdownSerializer(loaded);
    useEditorView({
      editorRef,
      viewRef,
      containerRef,
      loaded,
      editorSchema,
      parseMarkdownDoc,
      placeholder,
      direction,
      value,
      latestProps,
      slashMenu,
      editorId: myEditorId,
      setSlashMenu,
      setContextMenu,
      isUpdatingFromProps,
    });
    useSearchSync({
      viewRef,
      editorRef,
      searchQuery,
      searchOptions,
      placeholder,
      direction,
      loaded,
    });
    useMarkdownSync({ value, isUpdatingFromProps, core: loaded?.core });
    const { handleFormat } = useFormatting({
      viewRef,
      editorSchema,
      parseMarkdownDoc,
    });
    useImperativeEditorApi({
      ref,
      viewRef,
      core: loaded?.core,
      isUpdatingFromProps,
    });
    const {
      aiDraft,
      isProcessingAI,
      handleAIAction,
      handleAIActionDecision,
      handleSlashSelect,
      handlePluginSlashSelect,
    } = useAIStreaming({
      viewRef,
      containerRef,
      editorSchema,
      parseMarkdownDoc,
      latestProps,
      loaded,
      slashMenu,
      setSlashMenu,
      setBubbleMenu,
      handleFormat,
      onImageUploadRequest,
      streamStartRef,
      streamEndRef,
    });

    // Stable callback for the embedded AI toolbar — prevents React.memo from
    // re-rendering on every parent render due to a new inline function.
    const handleAIActionWithCustom = useCallback(
      (action: AIAssistantAction, customInstruction?: string) =>
        handleAIAction(action, undefined, undefined, undefined, undefined, customInstruction),
      [handleAIAction],
    );

    // Restore the initial cursor position once the editor has mounted.
    useEffect(() => {
      if (viewRef.current) {
        viewRef.current.focus();
        const { state, dispatch } = viewRef.current;

        if (initialCursor) {
          try {
            const max = state.doc.content.size;
            const from = Math.min(initialCursor.from, max);
            const to = Math.min(initialCursor.to, max);
            dispatch(
              state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView(),
            );
          } catch (e) {
            console.warn("Failed to restore cursor position:", e);
            dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
          }
        } else {
          dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
        }
      }
    }, []);

    return (
      <div
        ref={containerRef}
        className={cn("relative h-full flex flex-col", className)}
        style={
          {
            "--editor-font-size": fontSize ? `${fontSize}px` : undefined,
          } as React.CSSProperties
        }
      >
        <ErrorBoundary>
          <div
            ref={editorRef}
            className="flex-1 overflow-y-auto outline-none prose-first-child-no-margin custom-scrollbar"
          />
        </ErrorBoundary>

        <BubbleMenuOverlay
          bubbleMenu={bubbleMenu}
          editorId={myEditorId}
          isProcessingAI={isProcessingAI}
          aiStreaming={aiDraft?.isStreaming ?? false}
          onAction={handleAIActionWithCustom}
          onStop={() => aiDraft?.abortController?.abort()}
          onClose={() => setBubbleMenu((prev) => ({ ...prev, show: false }))}
          viewRef={viewRef}
        />

        <AIStreamOverlay
          aiDraft={aiDraft}
          onDecision={handleAIActionDecision}
          onStop={() => aiDraft?.abortController?.abort()}
        />

        {slashMenu.show && slashMenu.editorId === myEditorId && (
          <SlashMenu
            x={slashMenu.x}
            y={slashMenu.y}
            query={slashMenu.query}
            isAbsolute={true}
            pluginCommands={loaded?.context.commands ?? []}
            onSelect={handleSlashSelect}
            onPluginCommand={handlePluginSlashSelect}
            onClose={() => setSlashMenu((prev) => ({ ...prev, show: false, query: "" }))}
          />
        )}

        <SideMenuOverlay
          sideMenu={sideMenu}
          bubbleMenu={bubbleMenu}
          editorId={myEditorId}
          viewRef={viewRef}
          onOpenSlash={(pos) => {
            const coords = viewRef.current?.coordsAtPos(pos);
            const editorRect = containerRef.current?.getBoundingClientRect();
            if (coords && editorRect) {
              setSlashMenu({
                x: coords.left - editorRect.left,
                y: coords.bottom - editorRect.top + 5,
                show: true,
                pos: pos + 1,
                query: "",
                editorId: myEditorId,
              });
            }
          }}
        />

        <ContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu((prev) => ({ ...prev, show: false }))}
          handleFormat={handleFormat}
          handleAIAction={handleAIAction}
          viewRef={viewRef}
          editorSchema={editorSchema}
        />

        {commandPaletteOpen && (
          <CommandPalette
            commands={loaded?.context.commands ?? []}
            onRun={handleRunCommand}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}
      </div>
    );
  },
);

export default ProseMirrorEditor;
