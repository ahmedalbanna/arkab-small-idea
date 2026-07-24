import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import type { EditorRef } from "../ProseMirrorEditor";
import { useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { LoadedPlugins } from "../../plugins";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { ActivePageEditor } from "./ActivePageEditor";
import type { Page } from "../../stores/editorStore";
import { POETIC_QUOTES, EDITOR_THEME_PRESETS } from "./editorPresets";

interface EditorContainerProps {
  editorRefs: React.MutableRefObject<Record<string, EditorRef | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onLoaded?: (loaded: LoadedPlugins) => void;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  editorRefs,
  fileInputRef,
  onLoaded,
}) => {
  const { pages, activePageIds, addPage, reorderPages } = useEditorStore();
  const { setTheme, setFontFamily, theme: globalTheme } = useSettingsStore();

  const [quoteIndex, setQuoteIndex] = useState(0);

  const sortedActivePageIds = [...activePageIds].sort((a, b) => {
    const indexA = pages.findIndex((p) => p.id === a);
    const indexB = pages.findIndex((p) => p.id === b);
    return indexA - indexB;
  });

  const activePages = sortedActivePageIds
    .map((id) => pages.find((p) => p.id === id))
    .filter(Boolean) as Page[];

  const handleReorderActivePages = (newActivePages: Page[]) => {
    // Extract just the ids in the new order, preserving inactive pages'
    // positions. This avoids clobbering concurrent edits on Page objects
    // that may have changed between render and drop (fixes P3).
    const newActiveIds = newActivePages.map((p) => p.id);
    const inactivePages = pages.filter((p) => !activePageIds.includes(p.id));
    // Reconstruct: insert inactive pages at their original positions
    // relative to the active pages they were sandwiched between.
    let inactiveIdx = 0;
    const reorderedIds: string[] = [];
    for (const id of newActiveIds) {
      // Insert any inactive pages that originally came before this active page
      while (
        inactiveIdx < inactivePages.length &&
        pages.indexOf(inactivePages[inactiveIdx]) < pages.findIndex((p) => p.id === id)
      ) {
        reorderedIds.push(inactivePages[inactiveIdx].id);
        inactiveIdx++;
      }
      reorderedIds.push(id);
    }
    // Append remaining inactive pages
    while (inactiveIdx < inactivePages.length) {
      reorderedIds.push(inactivePages[inactiveIdx].id);
      inactiveIdx++;
    }
    reorderPages(reorderedIds);
  };

  return (
    <main
      className={cn(
        "flex-1 flex relative overflow-hidden bg-minimal-sidebar transition-all duration-1000 h-full",
        "pt-0",
      )}
    >
      {sortedActivePageIds.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-6 md:p-16 flex flex-col items-center justify-center min-h-full custom-scrollbar scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-minimal-accent/5 via-transparent to-transparent select-none">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full max-w-4xl text-center space-y-8 md:space-y-12"
          >
            {/* Calligraphic Floating Seal */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-minimal-border bg-minimal-sidebar/40 backdrop-blur-md shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-minimal-accent" />
                <span className="font-mono text-[9px] font-black uppercase tracking-widest text-minimal-muted">
                  Space Active • {globalTheme.toUpperCase()}
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-minimal-text font-serif bg-gradient-to-r from-minimal-text via-minimal-accent to-minimal-text bg-clip-text text-transparent">
                حبرٌ وريشة{" "}
                <span className="font-sans font-light text-2xl md:text-3xl text-minimal-muted align-middle mx-2">
                  |
                </span>{" "}
                Ink & Quill
              </h1>
              <p className="text-xs md:text-sm text-minimal-muted max-w-lg mx-auto leading-relaxed">
                صمّم فضاء كتابتك الفاخر، ودع سحر الكلمات يتدفق بلا حدود في واجهتك المخصصة للأدب
                والتفكير العالي.
              </p>
            </div>

            {/* Quote of the Day Section */}
            <motion.div
              key={quoteIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative max-w-xl mx-auto p-6 md:p-8 rounded-3xl border border-minimal-border/80 bg-minimal-bg/60 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all group/quote"
            >
              {/* Corner Accents represent luxury paper borders */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-minimal-accent/20 rounded-tl" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-minimal-accent/20 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-minimal-accent/20 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-minimal-accent/20 rounded-br" />

              <div className="space-y-4">
                <p
                  className="text-lg md:text-2xl font-serif text-minimal-text leading-relaxed font-semibold italic text-center px-4"
                  style={{ fontFamily: '"Amiri", serif' }}
                >
                  « {POETIC_QUOTES[quoteIndex].ar} »
                </p>
                <div className="w-12 h-px bg-minimal-accent/30 mx-auto" />
                <p className="text-[11px] font-sans text-minimal-muted tracking-tight leading-relaxed max-w-md mx-auto">
                  "{POETIC_QUOTES[quoteIndex].en}"
                </p>
                <p className="text-[9px] font-mono font-bold text-minimal-accent tracking-widest uppercase">
                  — {POETIC_QUOTES[quoteIndex].author}
                </p>
              </div>

              {/* Cycle Quote Trigger */}
              <button
                onClick={() => setQuoteIndex((prev) => (prev + 1) % POETIC_QUOTES.length)}
                className="absolute -bottom-3 end-6 px-3 py-1 bg-minimal-bg border border-minimal-border rounded-full text-[8px] font-bold text-minimal-muted hover:text-minimal-accent hover:border-minimal-accent/30 transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>مقولة أخرى (Next Quote)</span>
                <span className="text-[10px]">✨</span>
              </button>
            </motion.div>

            {/* Theme & Page Templates */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xs font-bold text-minimal-muted uppercase tracking-widest">
                  شغّل فضاءً إبداعياً متكاملاً / Select Visual Workspace
                </h3>
                <p className="text-[9px] text-minimal-muted mt-1">
                  سيقوم النظام بإنشاء فصل جديد تلقائياً وتفعيل المظهر والخط المناسبين للنوع المحدد
                  فوراً.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto px-4">
                {EDITOR_THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.theme}
                    onClick={() => {
                      setTheme(preset.theme as any);
                      setFontFamily(preset.font);
                      addPage(preset.docTitle, preset.content);
                    }}
                    className={cn(
                      "flex flex-col p-5 rounded-3xl border text-right justify-between transition-all hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-xl cursor-pointer h-52 group relative overflow-hidden bg-minimal-sidebar/60 border-minimal-border",
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-minimal-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="w-full">
                      <div className="flex justify-between items-start w-full mb-3">
                        <span className="text-[8px] bg-minimal-accent/10 text-minimal-accent px-2 py-0.5 rounded-full font-black uppercase tracking-tight">
                          {preset.theme.toUpperCase()}
                        </span>
                        <span className="text-2xl group-hover:scale-125 transition-transform duration-300">
                          {preset.icon}
                        </span>
                      </div>
                      <h4 className="text-[13px] font-black text-minimal-text leading-tight mb-1">
                        {preset.title}
                      </h4>
                      <p className="text-[10px] text-minimal-muted leading-snug">{preset.desc}</p>
                    </div>

                    <div className="w-full mt-4 pt-3 border-t border-minimal-border/40 flex items-center justify-between text-[8px] font-bold text-minimal-muted">
                      <span className="text-[8px] font-extrabold text-minimal-accent/80">
                        {preset.badge}
                      </span>
                      <span className="text-[11px] group-hover:translate-x-1 transition-transform">
                        ←
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Standard Quick Action buttons */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <button
                onClick={() => addPage("New Chapter", "# New Chapter\n\n")}
                className="flex items-center gap-2 py-3 px-6 bg-minimal-accent hover:bg-minimal-accent/90 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-minimal-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء مستند فارغ (ADD BLANK CHAPTER)</span>
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        <Reorder.Group
          axis="x"
          values={activePages}
          onReorder={handleReorderActivePages}
          className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory gap-4 md:gap-6 ps-2 md:ps-4 pe-4 md:pe-12 py-2 md:py-8 justify-start custom-scrollbar bg-minimal-sidebar/50 scroll-smooth h-full"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {activePages.map((page) => (
              <ActivePageEditor
                key={page.id}
                page={page}
                editorRefs={editorRefs}
                fileInputRef={fileInputRef}
                onLoaded={onLoaded}
              />
            ))}
          </AnimatePresence>

          <button
            onClick={() => addPage("New Chapter")}
            className="flex-shrink-0 w-[calc(100vw-2rem)] md:w-full max-w-[850px] h-full border-2 border-dashed border-minimal-border rounded-xl flex flex-col items-center justify-center gap-3 text-minimal-muted hover:border-minimal-accent/40 hover:text-minimal-accent hover:bg-minimal-sidebar transition-all group"
          >
            <div className="p-4 bg-minimal-sidebar rounded-full group-hover:rotate-180 transition-transform duration-500">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">New Chapter</span>
          </button>
        </Reorder.Group>
      )}
    </main>
  );
};
