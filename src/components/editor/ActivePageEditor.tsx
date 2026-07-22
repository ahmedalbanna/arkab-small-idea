import React, { useState, useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical, Target, FileDown, X } from "lucide-react";
import { cn, validateUrl } from "../../lib/utils";
import type { EditorRef } from "../ProseMirrorEditor";
import ProseMirrorEditor from "../ProseMirrorEditor";
import { FormatButton } from "./menus/FormatButton";
import { SnapshotsMenu } from "../overlays/SnapshotsMenu";
import { FileActionsMenu } from "../overlays/FileActionsMenu";
import type { Page } from "../../stores/editorStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore, getEmbeddingOptions } from "../../stores/aiStore";
import { useAIUIStore } from "../../stores/aiUIStore";
import { handleKeyDown } from "../../plugins/ai/handlers";
import type { LoadedPlugins } from "../../plugins";
import { FORMAT_TOOLBAR_ITEMS } from "./editorPresets";

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

  const { fontSize: globalFontSize, enableHeadingNumbering } = useSettingsStore();

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
                    page.wordGoal > 0 ? "text-minimal-accent" : "text-minimal-muted",
                  )}
                  title="Set Word Goal"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-bold">{page.wordGoal || "GOAL"}</span>
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
          {FORMAT_TOOLBAR_ITEMS.map((item, index) => {
            if (item.type === "sep") {
              return <div key={`sep-${index}`} className="w-px h-3 bg-minimal-border mx-0.5" />;
            }

            // Image button opens a URL prompt instead of calling handleFormat
            if (item.type === "image") {
              return (
                <FormatButton
                  key={item.type}
                  onClick={() => {
                    const url = window.prompt("Enter Image URL:");
                    if (url && validateUrl(url)) {
                      editorRefs.current[id]?.insertImage(url, "Image");
                    } else if (url) {
                      window.alert("Invalid URL. Only http and https URLs are allowed.");
                    }
                  }}
                  title={item.title!}
                  icon={item.icon ? <item.icon className="w-3.5 h-3.5" /> : undefined}
                />
              );
            }

            return (
              <FormatButton
                key={item.type}
                onClick={() => editorRefs.current[id]?.handleFormat(item.formatKey ?? item.type)}
                title={item.title!}
                icon={item.icon ? <item.icon className="w-3.5 h-3.5" /> : undefined}
                active={activeFormats?.[item.activeKey ?? item.formatKey ?? item.type]}
              />
            );
          })}
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ProseMirrorEditor
          ref={(el) => {
            editorRefs.current[id] = el; // eslint-disable-line react-hooks/immutability
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
                editorRefs.current[id]?.insertImage(url, "Image Alternative Text");
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
            embeddingOptions: getEmbeddingOptions(),
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
