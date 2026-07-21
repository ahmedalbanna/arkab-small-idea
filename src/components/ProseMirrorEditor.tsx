import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Selection, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { DOMSerializer } from "prosemirror-model";
import { toggleMark } from "prosemirror-commands";
import { type AIAssistantAction } from "../services/aiService";
import {
  Bold,
  Italic,
  Link,
  Code,
  Quote, Underline,
  Strikethrough,
  Sparkles,
  Wand2,
  CheckCheck,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowRight,
  Image as ImageIcon,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  List,
  Minimize2,
  Maximize2,
  Zap,
  Layout,
  FileText,
  RotateCcw,
  Copy,
  Scissors, Plus,
  GripVertical,
  RefreshCcw,
  Check,
  Square,
  X as XIcon, Table
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, slugify } from "../lib/utils";
import { SlashMenu } from "./SlashMenu";
import { FormatButton } from "./editor/menus/FormatButton";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAIUIStore } from "../stores/aiUIStore";
import { editorSerializer } from "./editor/hooks/useMarkdownSerializer";
import { usePluginLoader } from "./editor/hooks/usePluginLoader";
import { useMarkdownSerializer } from "./editor/hooks/useMarkdownSerializer";
import { useEditorView } from "./editor/hooks/useEditorView";
import { useSearchSync } from "./editor/hooks/useSearchSync";
import { useMarkdownSync } from "./editor/hooks/useMarkdownSync";
import { useFormatting } from "./editor/hooks/useFormatting";
import { useImperativeEditorApi } from "./editor/hooks/useImperativeEditorApi";
import { useAIStreaming } from "./editor/hooks/useAIStreaming";
import { CommandPalette } from "./editor/CommandPalette";
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
    const activeFormats = useAIUIStore((s) => s.activeFormats);
    const setActiveFormats = useAIUIStore((s) => s.setActiveFormats);
    const showAiPopover = useAIUIStore((s) => s.showAiPopover);
    const setShowAiPopover = useAIUIStore((s) => s.setShowAiPopover);
    const slashMenu = useAIUIStore((s) => s.slashMenu);
    const setSlashMenu = useAIUIStore((s) => s.setSlashMenu);
    const contextMenu = useAIUIStore((s) => s.contextMenu);
    const setContextMenu = useAIUIStore((s) => s.setContextMenu);
    const sideMenu = useAIUIStore((s) => s.sideMenu);
    const setSideMenu = useAIUIStore((s) => s.setSideMenu);
    const commandPaletteOpen = useAIUIStore((s) => s.commandPaletteOpen);
    const setCommandPaletteOpen = useAIUIStore((s) => s.setCommandPaletteOpen);

    // Open the command palette with the editor-standard shortcut.
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "p"
        ) {
          e.preventDefault();
          setCommandPaletteOpen(true);
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [setCommandPaletteOpen]);

    // Run a palette command through the live plugin context and close the palette.
    const handleRunCommand = (cmd: EditorCommand) => {
      if (loaded?.context) cmd.run(loaded.context);
      setCommandPaletteOpen(false);
    };

    const [isCopied, setIsCopied] = useState(false);

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
      setShowAiPopover,
      handleFormat,
      onImageUploadRequest,
      streamStartRef,
      streamEndRef,
    });

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
              state.tr
                .setSelection(TextSelection.create(state.doc, from, to))
                .scrollIntoView(),
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

        <AnimatePresence>
          {bubbleMenu.show && bubbleMenu.editorId === myEditorId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              style={{
                position: "absolute",
                left: bubbleMenu.x,
                top: bubbleMenu.y,
                transform: "translateX(-50%)",
              }}
              className="z-[100] flex items-center gap-0.5 bg-minimal-bg border border-minimal-border rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border"
            >
              <FormatButton onClick={() => handleFormat("h1")} title="Heading 1 (#)" icon={<Heading1 className="w-3.5 h-3.5" />} active={activeFormats.h1} />
              <FormatButton onClick={() => handleFormat("h2")} title="Heading 2 (##)" icon={<Heading2 className="w-3.5 h-3.5" />} active={activeFormats.h2} />
              <FormatButton onClick={() => handleFormat("h3")} title="Heading 3 (###)" icon={<Heading3 className="w-3.5 h-3.5" />} active={activeFormats.h3} />
              <div className="w-px h-3 bg-minimal-border mx-0.5" />
              <FormatButton onClick={() => handleFormat("bold")} title="Bold (Mod+B)" icon={<Bold className="w-3.5 h-3.5" />} active={activeFormats.bold} />
              <FormatButton onClick={() => handleFormat("italic")} title="Italic (Mod+I)" icon={<Italic className="w-3.5 h-3.5" />} active={activeFormats.italic} />
              <FormatButton onClick={() => handleFormat("underline")} title="Underline (Mod+U)" icon={<Underline className="w-3.5 h-3.5" />} active={activeFormats.underline} />
              <FormatButton onClick={() => handleFormat("strike")} title="Strikethrough (Mod+Shift+X)" icon={<Strikethrough className="w-3.5 h-3.5" />} active={activeFormats.strike} />
              <FormatButton onClick={() => handleFormat("quote")} title="Quote" icon={<Quote className="w-3.5 h-3.5" />} active={activeFormats.blockquote} />
              <FormatButton onClick={() => handleFormat("bullet")} title="Bullet List" icon={<List className="w-3.5 h-3.5" />} active={activeFormats.bullet} />
              <FormatButton onClick={() => handleFormat("code")} title="Code (Mod+E)" icon={<Code className="w-3.5 h-3.5" />} active={activeFormats.code} />
              <FormatButton onClick={() => handleFormat("tableify")} title="Convert to Table" icon={<Table className="w-3.5 h-3.5" />} />
              <div className="w-px h-3 bg-minimal-border mx-0.5" />
              <FormatButton onClick={() => handleFormat("alignLeft")} title="Align Left" icon={<AlignLeft className="w-3.5 h-3.5" />} active={activeFormats.alignLeft} />
              <FormatButton onClick={() => handleFormat("alignCenter")} title="Align Center" icon={<AlignCenter className="w-3.5 h-3.5" />} active={activeFormats.alignCenter} />
              <FormatButton onClick={() => handleFormat("alignRight")} title="Align Right" icon={<AlignRight className="w-3.5 h-3.5" />} active={activeFormats.alignRight} />
              <FormatButton onClick={() => handleFormat("alignJustify")} title="Justify" icon={<Layout className="w-3.5 h-3.5" />} active={activeFormats.alignJustify} />
              <div className="w-px h-3 bg-minimal-border mx-0.5" />
              <button
                    onClick={() => {
                      const url = window.prompt("Enter URL:");
                      if (url && viewRef.current) {
                        const { state, dispatch } = viewRef.current;
                        toggleMark(editorSchema.marks.link, { href: url })(
                          state,
                          dispatch,
                        );
                      }
                    }}
                    className="p-1.5 hover:bg-minimal-sidebar rounded text-minimal-text transition-colors"
                    title="Link"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (onImageUploadRequest) {
                        onImageUploadRequest();
                      } else {
                        const url = window.prompt("Enter Image URL:");
                        if (url && viewRef.current) {
                          const { state, dispatch } = viewRef.current;
                          const { from } = state.selection;
                          const node = editorSchema.nodes.image.create({
                            src: url,
                            alt: "Image",
                          });
                          dispatch(state.tr.insert(from, node));
                        }
                      }
                    }}
                    className="p-1.5 hover:bg-minimal-sidebar rounded text-minimal-text transition-colors"
                    title="Insert Image"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3 bg-minimal-border mx-0.5" />

              <button
                onClick={() => handleAIAction("improve")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Improve Writing"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("summarize")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Summarize Selection"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("fix-grammar")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Fix Grammar"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("expand")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Expand Selection"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-minimal-border mx-0.5" />

              <div className="relative">
                <button
                  onClick={() => setShowAiPopover(!showAiPopover)}
                  disabled={isProcessingAI}
                  className={cn(
                    "p-1.5 rounded transition-all flex items-center gap-1",
                    isProcessingAI
                      ? "text-minimal-muted cursor-not-allowed"
                      : "hover:bg-minimal-accent/20 text-minimal-accent",
                    showAiPopover && "bg-minimal-accent/20",
                  )}
                  title="AI Writing Assistant"
                >
                  {isProcessingAI ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </motion.div>
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    AI
                  </span>
                </button>

                <AnimatePresence>
                  {showAiPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className={cn(
                        "absolute mb-3 left-1/2 -translate-x-1/2 bg-minimal-bg border border-minimal-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 flex flex-col gap-1 w-64 ring-1 ring-minimal-border",
                        bubbleMenu.y < 400
                          ? "top-full mt-3"
                          : "bottom-full mb-3",
                      )}
                    >
                      <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto pe-1 custom-scrollbar">
                        <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar rounded-t-lg mb-1">
                          Editing
                        </div>
                        {[
                          {
                            id: "improve",
                            label: "Improve Writing",
                            icon: Wand2,
                          },
                          {
                            id: "fix-grammar",
                            label: "Fix Grammar",
                            icon: CheckCheck,
                          },
                          {
                            id: "shorten",
                            label: "Make Shorter",
                            icon: Minimize2,
                          },
                          {
                            id: "expand",
                            label: "Expand Selection",
                            icon: Maximize2,
                          },
                          {
                            id: "rewrite",
                            label: "Rewrite Section",
                            icon: RotateCcw,
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              handleAIAction(item.id as AIAssistantAction)
                            }
                            className="flex items-center gap-2 p-2 hover:bg-minimal-sidebar rounded-lg text-left transition-colors"
                          >
                            <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                            <span className="text-xs text-minimal-text font-medium">
                              {item.label}
                            </span>
                          </button>
                        ))}

                        <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar mt-1 mb-1">
                          Structure
                        </div>
                        {[
                          {
                            id: "generate-outline",
                            label: "Create Outline",
                            icon: Layout,
                          },
                          {
                            id: "expand-outline",
                            label: "Draft from Outline",
                            icon: Zap,
                          },
                          {
                            id: "draft-topic",
                            label: "Draft Topic",
                            icon: ArrowRight,
                          },
                          {
                            id: "summarize",
                            label: "Summarize",
                            icon: FileText,
                          },
                          {
                            id: "suggest-title",
                            label: "Suggest Titles",
                            icon: Heading,
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              handleAIAction(item.id as AIAssistantAction)
                            }
                            className="flex items-center gap-2 p-2 hover:bg-minimal-sidebar rounded-lg text-left transition-colors"
                          >
                            <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                            <span className="text-xs text-minimal-text font-medium">
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {aiDraft && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              style={{
                position: "absolute",
                left: "2rem", // Align to text padding
                top: aiDraft.y,
              }}
              className="z-[150] flex flex-col items-start gap-2 max-w-full"
            >
              {aiDraft.isStreaming ? (
                <div className="flex items-center gap-2 bg-minimal-bg border border-minimal-accent/50 rounded-xl p-1.5 shadow-xl backdrop-blur-xl ring-1 ring-minimal-accent/20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-4 h-4 text-minimal-accent" />
                  </motion.div>
                  <span className="text-xs font-semibold text-minimal-accent pe-2">AI is Writing...</span>
                  <div className="w-px h-3 bg-minimal-border" />
                  <button
                    onClick={() => {
                      if (aiDraft.abortController) {
                        aiDraft.abortController.abort();
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-400 hover:bg-minimal-sidebar hover:text-red-300 rounded"
                    title="Stop AI Generation"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop
                  </button>
                </div>
              ) : aiDraft.showActions ? (
                <div className="flex items-center gap-1 bg-minimal-bg border border-minimal-border rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-minimal-border">
                  <button
                    onClick={() => handleAIActionDecision("replace")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:bg-minimal-sidebar hover:text-emerald-300 rounded"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Replace
                  </button>
                  <div className="w-px h-4 bg-minimal-border" />
                  <button
                    onClick={() => handleAIActionDecision("append")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-minimal-accent hover:bg-minimal-sidebar hover:text-minimal-accent-hover rounded"
                  >
                    <Plus className="w-3.5 h-3.5" /> Append Below
                  </button>
                  <div className="w-px h-4 bg-minimal-border" />
                  <button
                    onClick={() => handleAIActionDecision("retry")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-minimal-text hover:bg-minimal-sidebar hover:text-minimal-text rounded"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <div className="w-px h-4 bg-minimal-border" />
                  <button
                    onClick={() => handleAIActionDecision("cancel")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-minimal-sidebar hover:text-red-300 rounded"
                  >
                    <XIcon className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {slashMenu.show && slashMenu.editorId === myEditorId && (
            <SlashMenu
              x={slashMenu.x}
              y={slashMenu.y}
              query={slashMenu.query}
              isAbsolute={true}
              pluginCommands={loaded?.context.commands ?? []}
              onSelect={handleSlashSelect}
              onPluginCommand={handlePluginSlashSelect}
              onClose={() =>
                setSlashMenu((prev) => ({ ...prev, show: false, query: "" }))
              }
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sideMenu.show && sideMenu.editorId === myEditorId && (bubbleMenu.editorId !== myEditorId || !bubbleMenu.show) && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              style={{
                position: "absolute",
                left: "-2rem",
                top: sideMenu.y,
              }}
              className="z-[50] flex items-center gap-0.5 group"
            >
              <button
                onClick={() => {
                  const coords = viewRef.current?.coordsAtPos(sideMenu.pos);
                  const editorRect =
                    containerRef.current?.getBoundingClientRect();
                  if (coords && editorRect) {
                    setSlashMenu({
                      x: coords.left - editorRect.left,
                      y: coords.bottom - editorRect.top + 5,
                      show: true,
                      pos: sideMenu.pos + 1,
                      query: "",
                      editorId: myEditorId,
                    });
                  }
                }}
                className="p-1.5 hover:bg-minimal-accent/10 text-minimal-muted/40 hover:text-minimal-accent rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur"
                title="Add Block"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="p-1.5 text-minimal-muted/20 cursor-grab hover:text-minimal-muted transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              {sideMenu.nodeName === "heading" && (
                <>
                  <div className="w-px h-4 bg-minimal-border mx-0.5" />
                  <button
                    onClick={() => {
                      if (!viewRef.current) return;
                      const node = viewRef.current.state.doc.nodeAt(sideMenu.pos);
                      if (node && node.type.name === "heading") {
                        const slug = slugify(node.textContent);
                        const url = new URL(window.location.href);
                        url.hash = slug;
                        navigator.clipboard.writeText(url.toString());
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur border border-transparent",
                      isCopied
                        ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20"
                        : "text-minimal-muted/40 hover:text-minimal-accent hover:bg-minimal-accent/10"
                    )}
                    title={isCopied ? "Copied!" : "Copy Anchor Link"}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {contextMenu.show && contextMenu.editorId === myEditorId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: "absolute",
                left: contextMenu.x,
                top: contextMenu.y,
              }}
              className="z-[200] w-56 bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar rounded-t-lg mb-1">
                  Editing
                </div>
                {[
                  {
                    id: "bold",
                    label: "Bold",
                    icon: Bold,
                    action: () => handleFormat("bold"),
                  },
                  {
                    id: "italic",
                    label: "Italic",
                    icon: Italic,
                    action: () => handleFormat("italic"),
                  },
                  {
                    id: "underline",
                    label: "Underline",
                    icon: Underline,
                    action: () => handleFormat("underline"),
                  },
                  {
                    id: "strike",
                    label: "Strikethrough",
                    icon: Strikethrough,
                    action: () => handleFormat("strike"),
                  },
                  {
                    id: "code",
                    label: "Code Block",
                    icon: Code,
                    action: () => handleFormat("code"),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-minimal-sidebar rounded-lg text-left transition-colors text-minimal-text"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}

                <div className="h-px bg-minimal-border my-1 mx-1" />

                <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar mb-1">
                  AI Power
                </div>
                {[
                  {
                    id: "improve",
                    label: "Refine & Improve",
                    icon: Zap,
                    action: () => handleAIAction("improve"),
                  },
                  {
                    id: "fix-grammar",
                    label: "Fix Errors",
                    icon: CheckCheck,
                    action: () => handleAIAction("fix-grammar"),
                  },
                  {
                    id: "summarize",
                    label: "Summarize",
                    icon: FileText,
                    action: () => handleAIAction("summarize"),
                  },
                  {
                    id: "complete-text",
                    label: "Continue Writing",
                    icon: ArrowRight,
                    action: () => handleAIAction("complete-text"),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-minimal-accent/20 rounded-lg text-left transition-colors text-minimal-text"
                  >
                    <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}

                <div className="h-px bg-minimal-border my-1 mx-1" />

                <div className="px-2 py-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-widest bg-minimal-sidebar mb-1">
                  Clipboard
                </div>
                {[
                  {
                    id: "copy",
                    label: "Copy as Markdown",
                    icon: Copy,
                    action: () => {
                      if (viewRef.current) {
                        const { state } = viewRef.current;
                        const { from, to } = state.selection;
                        const slice = state.selection.content();
                        const markdown = editorSerializer.serialize(
                          editorSchema.nodes.doc.create(null, slice.content),
                        );
                        const plainText = state.doc.textBetween(from, to, " ");

                        if (navigator.clipboard && navigator.clipboard.write) {
                          const textBlob = new Blob([plainText], {
                            type: "text/plain",
                          });
                          const markdownBlob = new Blob([markdown], {
                            type: "text/markdown",
                          });
                          const htmlBlob = new Blob(
                            [
                              DOMSerializer.fromSchema(
                                editorSchema,
                              ).serializeFragment(slice.content).textContent ||
                              "",
                            ],
                            { type: "text/html" },
                          );

                          try {
                            navigator.clipboard.write([
                              new ClipboardItem({
                                "text/plain": textBlob,
                                "text/markdown": markdownBlob,
                              }),
                            ]);
                          } catch (e) {
                            // Fallback to just text if writing multi-format fails
                            navigator.clipboard.writeText(
                              markdown || plainText,
                            );
                          }
                        } else {
                          navigator.clipboard.writeText(markdown || plainText);
                        }
                      }
                    },
                  },
                  {
                    id: "cut",
                    label: "Cut text",
                    icon: Scissors,
                    action: () => {
                      if (viewRef.current) {
                        const { state, dispatch } = viewRef.current;
                        const slice = state.selection.content();
                        const markdown = editorSerializer.serialize(
                          editorSchema.nodes.doc.create(null, slice.content),
                        );

                        navigator.clipboard.writeText(markdown);
                        dispatch(state.tr.deleteSelection());
                      }
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-minimal-border rounded-lg text-left transition-colors text-minimal-muted hover:text-minimal-text"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
