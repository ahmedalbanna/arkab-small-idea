import React, { useState, useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import {
  GripVertical,
  Target,
  Type,
  Maximize2 as FocusOn,
  Sparkles,
  FileDown,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import ProseMirrorEditor, { EditorRef } from "../ProseMirrorEditor";
import { SnapshotsMenu } from "../overlays/SnapshotsMenu";
import { FileActionsMenu } from "../overlays/FileActionsMenu";
import { AI_ACTIONS } from "../../constants";
import { Page, useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { useAIUIStore } from "../../stores/aiUIStore";
import { handleKeyDown, handleAiAction } from "../../plugins/ai/handlers";
import type { LoadedPlugins } from "../../plugins";

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
    lineHeight: globalLineHeight,
    enableHeadingNumbering,
  } = useSettingsStore();

  const { direction, showSearch, setAutoSaving, setAIAssistant } = useUIStore();

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

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showFileActions, setShowFileActions] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
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
          <div className="flex items-center bg-minimal-bg/50 rounded-lg border border-minimal-border/50 p-0.5 mr-1 md:mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 lg:opacity-100">
            {/* Word Goal Control */}
            <div className="hidden sm:flex items-center gap-1 px-1.5 border-r border-minimal-border/50 mr-1">
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

            <button
              onClick={() =>
                setPageSettings(id, {
                  isTypewriter: !page.isTypewriter,
                })
              }
              className={cn(
                "p-1.5 rounded-md transition-all",
                page.isTypewriter
                  ? "bg-minimal-accent text-white"
                  : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar",
              )}
              title="Typewriter Mode"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                setPageSettings(id, {
                  isFocusMode: !page.isFocusMode,
                })
              }
              className={cn(
                "p-1.5 rounded-md transition-all",
                page.isFocusMode
                  ? "bg-minimal-accent text-white"
                  : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar",
              )}
              title="Paragraph Focus Mode"
            >
              <FocusOn className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-3.5 bg-minimal-border mx-1" />

            {/* Quick AI Actions */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth max-w-[120px] md:max-w-[200px]">
              {AI_ACTIONS.slice(0, 4).map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAiAction(action.id)}
                  className={cn(
                    "flex-shrink-0 p-1.5 rounded-lg border border-transparent hover:border-minimal-accent/20 hover:bg-minimal-accent/5 transition-all group/ai",
                    action.color,
                  )}
                  title={action.label}
                >
                  <action.icon className="w-3.5 h-3.5 group-hover/ai:scale-110 transition-transform" />
                </button>
              ))}
              <div className="relative group/menu">
                <button className="p-1.5 rounded-lg text-minimal-muted hover:text-minimal-accent hover:bg-minimal-sidebar transition-all">
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-minimal-bg border border-minimal-border shadow-2xl rounded-2xl p-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-[100] scale-95 group-hover/menu:scale-100 origin-top-right">
                  <p className="text-[9px] font-bold text-minimal-muted uppercase tracking-widest p-2 mb-1 border-b border-minimal-border/30">
                    AI Power Tools
                  </p>
                  <div className="grid grid-cols-1 gap-1">
                    {AI_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          handleAiAction(action.id, customInstruction);
                          setCustomInstruction("");
                        }}
                        className="flex items-center gap-3 p-2 hover:bg-minimal-sidebar rounded-xl transition-all text-left group/item"
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform",
                            action.bg,
                            action.color,
                          )}
                        >
                          <action.icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-minimal-text leading-none mb-0.5">
                            {action.label}
                          </p>
                          <p className="text-[8px] text-minimal-muted truncate max-w-[100px]">
                            {action.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 px-2">
                    <p className="text-[9px] font-bold text-minimal-muted uppercase tracking-widest mb-2 border-b border-minimal-border/30 pb-1">
                      Custom Instruction
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder="e.g. In 3 bullets, poetic tone..."
                        className="w-full bg-minimal-sidebar border border-minimal-border rounded-lg px-2 py-1.5 text-[10px] text-minimal-text placeholder:text-minimal-muted outline-none focus:border-minimal-accent/50 transition-all"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customInstruction.trim()) {
                            handleAiAction("complete-text", customInstruction);
                            setCustomInstruction("");
                          }
                        }}
                      />
                      {customInstruction && (
                        <button
                          onClick={() => {
                            handleAiAction("complete-text", customInstruction);
                            setCustomInstruction("");
                          }}
                          className="w-full py-1.5 bg-minimal-accent text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-minimal-accent/90 transition-all shadow-lg shadow-minimal-accent/20"
                        >
                          Run Custom Task
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[9px] font-bold text-minimal-muted uppercase tracking-widest p-2 mt-2 mb-1 border-b border-minimal-border/30">
                    Brainstorming
                  </p>
                  <div className="grid grid-cols-2 gap-2 p-1">
                    <button
                      onClick={() => {
                        handleAiAction(
                          "custom:Brainstorm 5 topics for ",
                        );
                        setAIAssistant(true);
                      }}
                      className="p-2 border border-minimal-border rounded-xl text-[9px] font-bold uppercase tracking-wider text-minimal-muted hover:bg-minimal-sidebar hover:text-minimal-accent transition-all text-center"
                    >
                      Brainstorm
                    </button>
                    <button
                      onClick={() => {
                        handleAiAction(
                          "custom:Draft a professional ",
                        );
                        setAIAssistant(true);
                      }}
                      className="p-2 border border-minimal-border rounded-xl text-[9px] font-bold uppercase tracking-wider text-minimal-muted hover:bg-minimal-sidebar hover:text-minimal-accent transition-all text-center"
                    >
                      Draft
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-px h-3.5 bg-minimal-border mx-1" />

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
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ProseMirrorEditor
          ref={(el) => {
            editorRefs.current[id] = el;
          }}
          editorId={id}
          value={page.content}
          onChange={(c) => setPageContent(id, c)}
          onKeyDown={handleKeyDown}
          isTypewriter={page.isTypewriter}
          isFocusMode={page.isFocusMode}
          onToggleFocusMode={() =>
            setPageSettings(id, { isFocusMode: !page.isFocusMode })
          }
          fontSize={globalFontSize}
          lineHeight={globalLineHeight}
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
              if (url) {
                editorRefs.current[id]?.insertImage(
                  url,
                  "Image Alternative Text",
                );
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
