import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Cpu, Upload, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { embeddingService, EmbeddingStatus } from '../../services/embeddingService';

interface StatusBarProps {
  wordCount: number;
  charCount: number;
  readingTime: number;
  wordGoal: number;
  goalProgress: number;
  embeddingStatus: EmbeddingStatus;
  embeddingProgress: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  wordCount,
  charCount,
  readingTime,
  wordGoal,
  goalProgress,
  embeddingStatus,
  embeddingProgress
}) => {
  const { ollamaStatus, provider } = useAIStore();
  const { isIndexing, indexedChunks, indexedEpisodes } = useUIStore();

  return (
    <AnimatePresence mode="wait">
      <motion.footer
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className={cn(
          "fixed bottom-0 inset-x-0 h-9 md:h-11 border-t border-minimal-border z-[100] px-4 md:px-6 flex items-center justify-between transition-all duration-500",
          "bg-minimal-bg/95 backdrop-blur-xl text-minimal-muted select-none shadow-[0_-4px_12px_rgba(0,0,0,0.03)]"
        )}
      >
        {/* Left Side: Stats */}
        <div className="flex gap-4 md:gap-8 items-center h-full">
          <div className="flex gap-4 md:gap-6">
            <div className="flex flex-col justify-center">
              <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">WORDS</span>
              <span className="text-[11px] font-mono font-bold text-minimal-text tabular-nums">{wordCount}</span>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">CHARS</span>
              <span className="text-[11px] font-mono font-bold text-minimal-text tabular-nums">{charCount}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-minimal-border hidden sm:block" />

          {isIndexing && (
            <div className="flex items-center gap-2 px-2 py-0.5 bg-minimal-accent/5 rounded border border-minimal-accent/20 animate-pulse">
              <Loader2 className="w-3 h-3 text-minimal-accent animate-spin" />
              <span className="text-[9px] font-bold text-minimal-accent uppercase tracking-widest">Optimizing Intelligence Index...</span>
            </div>
          )}

          {!isIndexing && (
            <div className="hidden sm:flex flex-col justify-center">
              <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5 tracking-tighter">MEMORY DEPTH</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-minimal-muted">{indexedChunks + indexedEpisodes} NODES</span>
              </div>
            </div>
          )}

          {wordGoal > 0 && (
            <>
              <div className="h-6 w-px bg-minimal-border hidden md:block" />
              <div className="flex flex-col justify-center">
                <span className="text-[8px] font-bold opacity-40 leading-none mb-0.5">PROGRESS</span>
                <div className="flex items-center gap-3">
                  <div className="w-16 md:w-32 h-1 bg-minimal-border rounded-full overflow-hidden hidden sm:block">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${goalProgress}%` }}
                      className={cn("h-full", goalProgress >= 100 ? "bg-emerald-500" : "bg-minimal-accent")}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono font-bold",
                    goalProgress >= 100 ? "text-emerald-500 underline underline-offset-2" : "text-minimal-accent"
                  )}>
                    {Math.round(goalProgress)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Status Indicators */}
        <div className="flex gap-4 md:gap-6 items-center">
          {/* AI Status Group */}
          <div className="flex gap-2 items-center">
            {/* Main Model Connection */}
            {ollamaStatus.connected && (
              <div 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-all",
                  "bg-green-500/5 text-green-600 border-green-500/10"
                )}
                title={`AI Provider: ${provider.toUpperCase()} | Model: ${ollamaStatus.model}`}
              >
                <Cpu className="w-3 h-3" />
                <span className="text-[9px] font-bold tracking-widest">{ollamaStatus.model.toUpperCase()}</span>
              </div>
            )}

            {/* Embedding Model Status */}
            <div className="flex items-center">
              {embeddingStatus === 'idle' && (
                <button 
                  onClick={() => embeddingService.loadModel()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-minimal-accent/10 text-minimal-accent border border-minimal-accent/20 hover:bg-minimal-accent text-[9px] hover:text-white font-bold tracking-widest transition-all group scale-100 hover:scale-105 active:scale-95"
                  title="Start Downloading Vector Embedding Model (@xenova/transformers)"
                >
                  <Upload className="w-3 h-3 rotate-180" />
                  <span>LOAD VECTOR AI</span>
                </button>
              )}
              {embeddingStatus === 'loading' && (
                <div className="flex items-center gap-3 px-3 py-1 rounded-sm bg-minimal-sidebar border border-minimal-border">
                  <div className="w-16 h-1 bg-minimal-border rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-minimal-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${embeddingProgress}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-minimal-accent">{Math.round(embeddingProgress)}%</span>
                </div>
              )}
              {embeddingStatus === 'ready' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-emerald-500/20 bg-emerald-500/5 text-emerald-600" title="Vector Engine Ready">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="text-[9px] font-bold tracking-widest uppercase">Semantic AI Ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.footer>
    </AnimatePresence>
  );
};

const Sparkles = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);
