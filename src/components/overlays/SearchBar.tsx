import React, { useId } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, X, Zap, ArrowRightLeft } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import { Z_CLASS } from "../../lib/zIndex";

interface SearchBarProps {
  findText: string;
  setFindText: (val: string) => void;
  replaceText: string;
  setReplaceText: (val: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  isCaseSensitive: boolean;
  setIsCaseSensitive: (val: boolean) => void;
  isWholeWord: boolean;
  setIsWholeWord: (val: boolean) => void;
  isSemantic: boolean;
  setIsSemantic: (val: boolean) => void;
  semanticResults?: { text: string; score: number; source?: string }[];
  handleFindNext: () => void;
  handleReplace: () => void;
  handleReplaceAll: () => void;
  setSearchIndex: (val: number) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  findText,
  setFindText,
  replaceText,
  setReplaceText,
  matchCount,
  currentMatchIndex,
  isCaseSensitive,
  setIsCaseSensitive,
  isWholeWord,
  setIsWholeWord,
  isSemantic,
  setIsSemantic,
  semanticResults = [],
  handleFindNext,
  handleReplace,
  handleReplaceAll,
  setSearchIndex,
}) => {
  const { showSearch, setSearch } = useUIStore();
  const findInputId = useId();
  const replaceInputId = useId();

  const hasMatches = matchCount > 0 || semanticResults.length > 0;

  return (
    <AnimatePresence>
      {showSearch && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          role="search"
          aria-label="Find and replace"
          className={cn(
            "fixed top-8 start-1/2 -translate-x-1/2 bg-minimal-bg border border-minimal-border rounded-xl shadow-2xl p-3 flex flex-col gap-2 w-[420px] max-w-[95vw]",
            Z_CLASS.panel,
          )}
        >
          {/* ── Find row ── */}
          <div className="flex items-start gap-2">
            <div className="flex-1 bg-minimal-sidebar rounded-lg flex items-center px-3 border border-minimal-border focus-within:border-minimal-accent transition-colors">
              <Search className="w-3.5 h-3.5 text-minimal-muted me-2" aria-hidden="true" />
              <label htmlFor={findInputId} className="sr-only">Find</label>
              <input
                id={findInputId}
                type="text"
                placeholder="Find"
                value={findText}
                onChange={(e) => {
                  setFindText(e.target.value);
                  setSearchIndex(-1);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleFindNext()}
                className="bg-transparent border-none outline-none text-[13px] py-1.5 w-full font-medium"
                autoFocus
              />
              {findText && (
                <span className="text-[10px] font-bold text-minimal-accent px-1.5 py-0.5 bg-minimal-accent/10 rounded me-1" aria-live="polite">
                  {hasMatches
                    ? `${currentMatchIndex || "-"} / ${matchCount}`
                    : "0 / 0"}
                </span>
              )}
              <div className="flex items-center gap-1 ms-2">
                <button
                  onClick={() => {
                    setIsCaseSensitive(!isCaseSensitive);
                    setSearchIndex(-1);
                  }}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors",
                    isCaseSensitive
                      ? "bg-minimal-accent text-white"
                      : "text-minimal-muted hover:bg-minimal-border",
                  )}
                  aria-label="Toggle case sensitivity"
                  aria-pressed={isCaseSensitive}
                >
                  Aa
                </button>
                <button
                  onClick={() => {
                    setIsWholeWord(!isWholeWord);
                    setSearchIndex(-1);
                  }}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors border",
                    isWholeWord
                      ? "bg-minimal-accent text-white border-minimal-accent"
                      : "text-minimal-muted hover:bg-minimal-border border-minimal-border",
                  )}
                  aria-label="Toggle whole word match"
                  aria-pressed={isWholeWord}
                >
                  W
                </button>
                <button
                  onClick={() => {
                    setIsSemantic(!isSemantic);
                    setSearchIndex(-1);
                  }}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded transition-all flex items-center gap-1",
                    isSemantic
                      ? "bg-minimal-accent text-white"
                      : "text-minimal-muted hover:bg-minimal-border border border-minimal-border",
                  )}
                  aria-label="Toggle semantic search"
                  aria-pressed={isSemantic}
                >
                  <Zap
                    className={cn("w-2.5 h-2.5", isSemantic ? "fill-current" : "")}
                    aria-hidden="true"
                  />
                  Brain
                </button>
              </div>
            </div>

            {/* Semantic relevance indicator */}
            {isSemantic && findText && (
              <div className="flex flex-col gap-1 px-1 min-w-[80px] shrink-0">
                <div className="flex justify-between items-center text-[9px] font-bold text-minimal-muted uppercase tracking-wider">
                  <span>Relevance</span>
                  <span>
                    {semanticResults.filter((r) => r.source === "external").length} Ref
                  </span>
                </div>
                <div className="h-1 bg-minimal-sidebar rounded-full overflow-hidden">
                  <div
                    className="h-full bg-minimal-accent transition-all duration-500"
                    style={{ width: hasMatches ? "100%" : "0%" }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-1 shrink-0">
              <button
                onClick={handleFindNext}
                className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted"
                aria-label="Find next match"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => setSearch(false)}
                className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted"
                aria-label="Close search"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ── Semantic results ── */}
          {isSemantic && semanticResults.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-minimal-border pt-2 max-h-[200px] overflow-y-auto custom-scrollbar" role="listbox" aria-label="Semantic search results">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-minimal-muted uppercase tracking-wider mb-1">
                <Zap className="w-2.5 h-2.5 fill-minimal-muted animate-pulse" aria-hidden="true" />
                Semantic Matches (Score Gradients)
              </div>
              {semanticResults.map((result, idx) => {
                const score = result.score;
                let gradientClass = "bg-gradient-to-r from-minimal-muted/10 via-minimal-muted/5 to-transparent border-minimal-border/40";
                let textClass = "text-minimal-text";
                let badgeClass = "text-minimal-muted";
                let leftBorderBg = "bg-minimal-muted";

                if (score >= 0.85) {
                  gradientClass = "bg-gradient-to-r from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30";
                  textClass = "text-emerald-950 dark:text-emerald-100 font-medium";
                  badgeClass = "text-emerald-600 dark:text-emerald-400";
                  leftBorderBg = "bg-gradient-to-b from-emerald-400 to-emerald-600";
                } else if (score >= 0.7) {
                  gradientClass = "bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-500/30";
                  textClass = "text-indigo-950 dark:text-indigo-100";
                  badgeClass = "text-indigo-600 dark:text-indigo-400";
                  leftBorderBg = "bg-gradient-to-b from-indigo-400 to-indigo-600";
                } else if (score >= 0.5) {
                  gradientClass = "bg-gradient-to-r from-blue-500/10 via-blue-500/3 to-transparent border-blue-500/20";
                  textClass = "text-blue-900 dark:text-blue-200";
                  badgeClass = "text-blue-500 dark:text-blue-400";
                  leftBorderBg = "bg-blue-400";
                }

                return (
                  <div
                    key={idx}
                    role="option"
                    className={cn(
                      "rounded p-2 border transition-all duration-300 group relative overflow-hidden shadow-xs hover:shadow-md",
                      gradientClass,
                    )}
                  >
                    <div
                      className={cn(
                        "absolute start-0 top-0 bottom-0 w-1 transition-all duration-300",
                        leftBorderBg,
                      )}
                    />
                    <p className={cn("text-[11px] leading-relaxed line-clamp-2 ps-2", textClass)}>
                      {result.text}
                    </p>
                    <div className="flex justify-between items-center mt-1.5 ps-2">
                      <span className={cn("text-[9px] font-mono font-bold flex items-center gap-1", badgeClass)}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" aria-hidden="true" />
                        {(score * 100).toFixed(0)}% Match
                      </span>
                      <span className="text-[9px] text-minimal-muted font-medium">
                        {result.source === "document" ? "Current Document" : "Knowledge Base"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Replace row ── */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-minimal-sidebar rounded-lg flex items-center px-3 border border-minimal-border focus-within:border-minimal-accent transition-colors">
              <ArrowRightLeft className="w-3.5 h-3.5 text-minimal-muted me-2" aria-hidden="true" />
              <label htmlFor={replaceInputId} className="sr-only">Replace</label>
              <input
                id={replaceInputId}
                type="text"
                placeholder="Replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] py-1.5 w-full font-medium"
              />
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={handleReplace}
                className="px-2 py-1 bg-minimal-border hover:bg-minimal-muted/20 rounded text-[10px] font-bold text-minimal-text uppercase transition-colors"
              >
                Replace
              </button>
              <button
                onClick={handleReplaceAll}
                className="px-2 py-1 bg-minimal-accent/10 hover:bg-minimal-accent/20 rounded text-[10px] font-bold text-minimal-accent uppercase transition-colors"
              >
                All
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
