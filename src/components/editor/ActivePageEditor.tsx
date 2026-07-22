import React, { useState, useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import {
  GripVertical,
  Target,
  FileDown,
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  Code,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layout,
  Link,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import ProseMirrorEditor, { EditorRef } from "../ProseMirrorEditor";
import { FormatButton } from "./menus/FormatButton";
import { SnapshotsMenu } from "../overlays/SnapshotsMenu";
import { FileActionsMenu } from "../overlays/FileActionsMenu";
import { Page, useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { useAIUIStore } from "../../stores/aiUIStore";
import { handleKeyDown } from "../../plugins/ai/handlers";
import type { LoadedPlugins } from "../../plugins";
import { validateUrl } from "../../lib/utils";

interface ActivePageEditorProps {
  page: Page;
  editorRefs: React.MutableRefObject<Record<string, EditorRef | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onLoaded?: (loaded: LoadedPlugins) => void;
}

export const ActivePageEditor: React.FC<ActivePageEditorProps> = ({
  page,
  editorRefs,
  fileInputRef,
  onLoaded,
}) => {
  const { id } = page;
  const dragControls = useDragControls();

  const {
    pages,
    activeFocusedPageId,
    setPageContent,
    togglePageOpen,
    setActiveFocusedPageId,
    setPageSettings,
    setPageCursor,
    addSnapshot,
  } = useEditorStore();

  const {
    fontSize: globalFontSize,
    enableHeadingNumbering,
  } = useSettingsStore();

  const { direction, showSearch, setAutoSaving } = useUIStore();

  const {
    personalInstructions: aiPersonalInstructions,
    serviceConfigs,
    apiKeys,
    providerConfigs,
  } = useAIStore();

  const {
    isSemantic,
    setMatchCount,
    findText,
    isCaseSensitive,
    isWholeWord,
    searchIndex,
    currentMatchIndex,
  } = useAIUIStore();

  const activeFormats = useAIUIStore((s) => s.activeFormats[id]);

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showFileActions, setShowFileActions] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleScrollLocal = () => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    setAutoSaving(true);
    autoSaveTimeout.current = setTimeout(() => {
      setAutoSaving(false);
    }, 1500);
  };

  return (
    <Reorder.Item
      value={page}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.4, ease: "circOut" }}
      onClick={() => setActiveFocusedPageId(id)}
      className={cn(
        "flex-shrink-0 w-[calc(100vw-2rem)] md:w-full max-w-[850px] h-full bg-minimal-bg shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] rounded-xl border flex flex-col snap-start relative group me-1 md:me-4 transition-all duration-300 overflow-hidden",
        activeFocusedPageId === id
          ? "border-minimal-accent ring-2 ring-minimal-accent/10 shadow-[0_40px_80px_-15px_rgba(var(--minimal-accent-rgb),0.15)]"
          : "border-minimal-border",
        enableHeadingNumbering && "headings-numbered",
      )}
    >
      <div
        className={cn(
          "px-4 md:px-6 py-2 md:py-3 border-b flex items-center justify-between rounded-t-xl transition-all duration-300",
          activeFocusedPageId === id
            ? "bg-minimal-accent/5 border-minimal-accent/20"
            : "bg-minimal-sidebar/30 border-minimal-border",
        )}
      >
        <div className="flex items-center gap-2 md:gap-3">
          {/* Drag Handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing p-1 text-minimal-muted hover:text-minimal-text rounded hover:bg-minimal-border/40 transition-colors shrink-0"
            title="Drag to Sort Chapters"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-minimal-accent text-white flex flex-shrink-0 items-center justify-center text-[9px] md:text-[10px] font-bold">
            {pages.indexOf(page) + 1}
          </div>
          <span className="text-[9px] md:text-[10px] font-bold text-minimal-muted uppercase tracking-widest truncate max-w-[100px] md:max-w-none">
            {page.title}
          </span>
          <SnapshotsMenu
            pageId={id}
            showSnapshots={showSnapshots}
            setShowSnapshots={() => setShowSnapshots((prev) => !prev)}
            takeSnapshot={() => addSnapshot(id, page.content)}
            setMarkdown={(content) => {
              setPageContent(id, content);
              editorRefs.current[id]?.setMarkdown(content);
            }}
          />
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Per-page controls */}
          <div className="flex items-center bg-minimal-bg/50 rounded-lg border border-minimal-border/50 p-0.5 me-1 md:me-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 lg:opacity-100">
            {/* Word Goal Control */}
            <div className="hidden sm:flex items-center gap-1 px-1.5 border-e border-minimal-border/50 me-1">
              {isEditingGoal ? (
                <input
                  autoFocus
                  type="number"
                  className="w-12 bg-transparent text-[10px] font-mono font-bold text-minimal-accent outline-none"
                  defaultValue={page.wordGoal || 0}
                  onBlur={(e) => {
                    setPageSettings(id, {
                      wordGoal: parseInt(e.target.value) || 0,
                    });
                    setIsEditingGoal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              ) : (
                <button
                  onClick={() => setIsEditingGoal(true)}
                  className={cn(
                    "flex items-center gap-1.5 hover:text-minimal-accent transition-colors",
                    page.wordGoal > 0
                      ? "text-minimal-accent"
                      : "text-minimal-muted",
                  )}
                  title="Set Word Goal"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-bold">
                    {page.wordGoal || "GOAL"}
                  </span>
                </button>
              )}
            </div>

            <div className="relative">
              <FileActionsMenu
                pageId={id}
                showFileActions={showFileActions}
                setShowFileActions={setShowFileActions}
                editorRef={{ current: editorRefs.current[id] }}
                markdown={page.content}
                inline={true}
              />
              <button
                onClick={() => setShowFileActions((prev) => !prev)}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  showFileActions
                    ? "bg-minimal-accent text-white"
                    : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar",
                )}
                title="File Actions"
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => togglePageOpen(id)}
            className="p-1 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Close page"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Formatting toolbar — visible when page is active */}
      {activeFocusedPageId === id && (
        <div className="px-4 md:px-6 py-1.5 border-b border-minimal-border/50 bg-minimal-sidebar/20 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("h1")} title="Heading 1" icon={<Heading1 className="w-3.5 h-3.5" />} active={activeFormats?.h1} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("h2")} title="Heading 2" icon={<Heading2 className="w-3.5 h-3.5" />} active={activeFormats?.h2} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("h3")} title="Heading 3" icon={<Heading3 className="w-3.5 h-3.5" />} active={activeFormats?.h3} />
          <div className="w-px h-3 bg-minimal-border mx-0.5" />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("bold")} title="Bold (Ctrl+B)" icon={<Bold className="w-3.5 h-3.5" />} active={activeFormats?.bold} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("italic")} title="Italic (Ctrl+I)" icon={<Italic className="w-3.5 h-3.5" />} active={activeFormats?.italic} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("underline")} title="Underline (Ctrl+U)" icon={<Underline className="w-3.5 h-3.5" />} active={activeFormats?.underline} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("strike")} title="Strikethrough" icon={<Strikethrough className="w-3.5 h-3.5" />} active={activeFormats?.strike} />
          <div className="w-px h-3 bg-minimal-border mx-0.5" />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("quote")} title="Quote" icon={<Quote className="w-3.5 h-3.5" />} active={activeFormats?.blockquote} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("bullet")} title="Bullet List" icon={<List className="w-3.5 h-3.5" />} active={activeFormats?.bullet} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("code")} title="Code" icon={<Code className="w-3.5 h-3.5" />} active={activeFormats?.code} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("tableify")} title="Convert to Table" icon={<Table className="w-3.5 h-3.5" />} />
          <div className="w-px h-3 bg-minimal-border mx-0.5" />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("alignLeft")} title="Align Left" icon={<AlignLeft className="w-3.5 h-3.5" />} active={activeFormats?.alignLeft} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("alignCenter")} title="Align Center" icon={<AlignCenter className="w-3.5 h-3.5" />} active={activeFormats?.alignCenter} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("alignRight")} title="Align Right" icon={<AlignRight className="w-3.5 h-3.5" />} active={activeFormats?.alignRight} />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("alignJustify")} title="Justify" icon={<Layout className="w-3.5 h-3.5" />} active={activeFormats?.alignJustify} />
          <div className="w-px h-3 bg-minimal-border mx-0.5" />
          <FormatButton onClick={() => editorRefs.current[id]?.handleFormat("link")} title="Link" icon={<Link className="w-3.5 h-3.5" />} />
          <FormatButton onClick={() => {
            const url = window.prompt("Enter Image URL:");
            if (url && validateUrl(url)) {
              editorRefs.current[id]?.insertImage(url, "Image");
            } else if (url) {
              window.alert("Invalid URL. Only http and https URLs are allowed.");
            }
          }} title="Insert Image" icon={<ImageIcon className="w-3.5 h-3.5" />} />
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ProseMirrorEditor
          ref={(el) => {
            editorRefs.current[id] = el;
          }}
          editorId={id}
          value={page.content}
          onChange={(c) => setPageContent(id, c)}
          onKeyDown={handleKeyDown}
          fontSize={globalFontSize}
          initialCursor={page.cursor}
          onSelectionChange={(sel) => setPageCursor(id, sel)}
          direction={direction}
          onScroll={handleScrollLocal}
          personalInstructions={aiPersonalInstructions}
          selectedModel={serviceConfigs.actions.model}
          provider={serviceConfigs.actions.provider}
          apiKeys={apiKeys}
          providerConfigs={providerConfigs}
          onAiResult={(result) => {
            editorRefs.current[id]?.streamMarkdown(result, false);
          }}
          onAiStream={(chunk, isNew) => {
            editorRefs.current[id]?.streamMarkdown(chunk, isNew);
          }}
          onSearchMetadata={(count) => {
            if (isSemantic) {
              setMatchCount(count);
            }
          }}
          onImageUploadRequest={() => {
            const choice = window.confirm(
              "Click OK to Upload an image, or Cancel to provide a URL.",
            );
            if (choice) {
              fileInputRef.current?.click();
            } else {
              const url = window.prompt("Enter Image URL:");
              if (url && validateUrl(url)) {
                editorRefs.current[id]?.insertImage(
                  url,
                  "Image Alternative Text",
                );
              } else if (url) {
                window.alert("Invalid URL. Only http and https URLs are allowed.");
              }
            }
          }}
          searchQuery={showSearch ? findText : ""}
          searchOptions={{
            isCaseSensitive,
            isWholeWord,
            isSemantic,
            searchIndex,
            currentMatchIndex,
            embeddingOptions: {
              provider: serviceConfigs.embeddings.provider,
              apiKey:
                apiKeys?.[
                serviceConfigs.embeddings.provider as keyof typeof apiKeys
                ],
              model: serviceConfigs.embeddings.model,
            },
          }}
          collab={{
            enabled: false,
            docId: `local-document-${id}`,
          }}
          onLoaded={onLoaded}
        />
      </div>
    </Reorder.Item>
  );
};
