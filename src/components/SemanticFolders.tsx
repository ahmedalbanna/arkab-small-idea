import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderRoot, FolderSearch, ChevronRight, FileText, Zap, Loader2, X } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { semanticService } from '../services/semanticService';
import { cn } from '../lib/utils';

import { useAIStore } from '../stores/aiStore';

export interface SemanticFoldersProps {
  onJump?: (text: string) => void;
}

export const SemanticFolders: React.FC<SemanticFoldersProps> = ({ onJump }) => {
  const { pages, activePageIds, semanticClusters, setSemanticClusters } = useEditorStore();
  const activePage = pages.find(p => p.id === activePageIds[activePageIds.length - 1]) || pages[0];
  const content = activePage?.content || '';
  
  const { serviceConfigs, apiKeys, providerConfigs } = useAIStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDiscover = async () => {
    setIsAnalyzing(true);
    try {
      const clusters = await semanticService.clusterDocument(content, {
        provider: serviceConfigs.semantic.provider,
        model: serviceConfigs.semantic.model,
        apiKeys,
        providerConfigs
      });
      setSemanticClusters(clusters);
    } catch (error) {
      console.error("Semantic discovery failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);

  return (
    <div className="flex flex-col h-full bg-minimal-sidebar border-l border-minimal-border @container">
      <div className="p-4 border-b border-minimal-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderRoot className="w-4 h-4 text-minimal-accent" />
          <h3 className="text-[10px] font-bold text-minimal-text uppercase tracking-widest">Semantic Folders</h3>
        </div>
        <button 
          onClick={handleDiscover}
          disabled={isAnalyzing}
          className="p-1.5 hover:bg-minimal-accent/10 rounded-lg text-minimal-accent transition-all disabled:opacity-50"
          title="Re-analyze Document"
        >
          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {semanticClusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderSearch className="w-8 h-8 text-minimal-muted/30 mb-3" />
            <p className="text-[10px] font-medium text-minimal-muted uppercase tracking-tight mb-4">No folders discovered yet</p>
            <button 
              onClick={handleDiscover}
              className="px-4 py-2 bg-minimal-accent text-white rounded-xl text-[10px] font-bold shadow-lg shadow-minimal-accent/20 hover:scale-105 active:scale-95 transition-all"
            >
              Discover Structure
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {semanticClusters.map((cluster) => (
              <div key={cluster.id} className="group">
                <button
                  onClick={() => setExpandedId(expandedId === cluster.id ? null : cluster.id)}
                  className="w-full flex items-start gap-3 p-3 bg-minimal-bg border border-minimal-border rounded-2xl hover:border-minimal-accent/30 transition-all text-left group-hover:shadow-md"
                >
                  <div className="p-2 bg-minimal-sidebar rounded-xl group-hover:bg-minimal-accent/5 transition-colors">
                    <ChevronRight className={cn("w-4 h-4 text-minimal-accent transition-transform", expandedId === cluster.id && "rotate-90")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-minimal-text line-clamp-1 mb-1">{cluster.name}</h4>
                    <p className="text-[9px] text-minimal-muted leading-relaxed line-clamp-2">{cluster.summary}</p>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === cluster.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-minimal-sidebar/30 rounded-b-2xl border-x border-b border-minimal-border px-3 pb-3 -mt-3 pt-6 space-y-2"
                    >
                      {cluster.paragraphIndices.map((idx) => (
                        <div 
                          key={idx}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-minimal-accent/5 transition-colors cursor-pointer group/item"
                          onClick={() => {
                            const text = paragraphs[idx];
                            if (text && onJump) onJump(text);
                          }}
                        >
                          <FileText className="w-3 h-3 text-minimal-muted mt-0.5 group-hover/item:text-minimal-accent transition-colors" />
                          <p className="text-[9px] text-minimal-text line-clamp-2 opacity-80 group-hover/item:opacity-100 italic transition-all">
                            "{paragraphs[idx]?.substring(0, 80)}..."
                          </p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-minimal-sidebar/80 backdrop-blur-sm border-t border-minimal-border">
        <p className="text-[8px] font-bold text-minimal-muted uppercase tracking-widest text-center opacity-70">
          AI-Powered Semantic Grouping
        </p>
      </div>
    </div>
  );
};
