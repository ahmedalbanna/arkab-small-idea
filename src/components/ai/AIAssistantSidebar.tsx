import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, FolderOpen, Save, X, History, Check, ArrowRightLeft, Trash2, Bold, Italic, List, ImagePlus, Download, ImageIcon, Send, Wand2, FileText, RefreshCw, Maximize2, ListOrdered, PenTool, CheckCheck, FastForward, Heading, Minimize2, Plus } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { useAIStore } from '../../stores/aiStore';
import { useUIStore } from '../../stores/uiStore';
import { ChatMessage } from '../../services/aiService';

import { AI_ACTIONS } from '../../constants';

interface AIAssistantSidebarProps {
  chatScrollRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  chatImageInputRef: React.RefObject<HTMLInputElement>;
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  chatAttachedImages: string[];
  setChatAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  handleAiGenerate: () => Promise<void>;
  handleChatImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatChatInput: (type: 'bold' | 'italic' | 'list') => void;
  applyContent: (content: string, method: 'append' | 'insert' | 'replace' | 'suggest') => void;
  onAction?: (actionId: string) => void;
  stopAiGenerate: () => void;
}

export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
  chatScrollRef,
  chatInputRef,
  chatImageInputRef,
  aiPrompt,
  setAiPrompt,
  chatAttachedImages,
  setChatAttachedImages,
  handleAiGenerate,
  handleChatImageUpload,
  formatChatInput,
  applyContent,
  onAction,
  stopAiGenerate
}) => {
  const { showAIAssistant, setAIAssistant } = useUIStore();
  const { chatHistory, setChatHistory, isGenerating: isGeneratingAi, ollamaStatus } = useAIStore();
  const [isMinimized, setIsMinimized] = React.useState(false);

  return (
    <AnimatePresence>
      {showAIAssistant && (
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1,
            height: isMinimized ? '80px' : '650px',
            width: isMinimized ? '240px' : '420px'
          }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          drag
          dragConstraints={{ left: -1000, right: 0, top: -1000, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          className="fixed bottom-6 right-6 w-full md:w-[420px] h-[650px] max-h-[90vh] bg-minimal-bg/95 backdrop-blur-xl border border-minimal-border z-[70] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col rounded-[2.5rem] overflow-hidden cursor-auto transition-shadow"
          style={{ touchAction: 'none' }}
        >
          <div className="p-5 border-b border-minimal-border flex justify-between items-center bg-minimal-sidebar/50 cursor-grab active:cursor-grabbing group">
            <div className="flex items-center gap-3 pointer-events-none select-none">
              <div className="w-10 h-10 rounded-2xl bg-minimal-accent flex items-center justify-center text-white shadow-lg shadow-minimal-accent/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-black text-minimal-text uppercase tracking-[0.2em] leading-none mb-1">Intelligence</h2>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    ollamaStatus.loading ? "bg-minimal-muted animate-pulse" :
                      ollamaStatus.connected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" : "bg-red-500"
                  )} />
                  <p className="text-[10px] text-minimal-muted font-bold uppercase tracking-tight">
                    {ollamaStatus.loading ? "Waking up..." : ollamaStatus.connected ? `Live: ${ollamaStatus.model}` : "Offline"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-minimal-border rounded-full text-minimal-muted transition-colors"
                  title={isMinimized ? "Expand" : "Minimize"}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setAIAssistant(false)}
                  className="p-2 hover:bg-minimal-border rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-minimal-muted" />
                </button>
              </div>
            </div>

            <div className={cn(
              "flex-1 flex flex-col min-h-0 overflow-hidden transition-opacity duration-300",
              isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth custom-scrollbar" ref={chatScrollRef}>
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-12">
                    <div className="w-12 h-12 rounded-2xl bg-minimal-border flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-minimal-text" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-1">Deep Intelligence</h3>
                      <p className="text-[10px] font-medium max-w-[200px] mx-auto">Ask Gemini to write, rewrite, or brainstorm with you.</p>
                    </div>
                  </div>
                )}

                {chatHistory.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between sticky top-0 bg-minimal-bg/80 backdrop-blur pb-2 z-10 border-b border-minimal-border/30 mb-4 px-1">
                      <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Deep context Thread</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (window.confirm("Clear this conversation history?")) {
                              setChatHistory([]);
                            }
                          }}
                          className="text-[10px] font-bold text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-colors uppercase"
                        >
                          Clear Thread
                        </button>
                      </div>
                    </div>
                    <div className="space-y-6 pb-4">
                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={cn(
                          "flex flex-col gap-1.5 max-w-[92%] group/msg",
                          msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                          <div className={cn(
                            "px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed relative transition-all duration-300",
                            msg.role === 'user'
                              ? "bg-minimal-accent text-white rounded-tr-none shadow-lg shadow-minimal-accent/20"
                              : "bg-minimal-sidebar border border-minimal-border text-minimal-text rounded-tl-none shadow-sm"
                          )}>
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {msg.images.filter(img => img).map((img, i) => (
                                  <img
                                    key={i}
                                    src={img}
                                    alt="uploaded"
                                    className="max-w-full md:max-w-[200px] max-h-[200px] rounded-lg border border-white/20 shadow-sm object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ))}
                              </div>
                            )}
                            <div className={cn(
                              "prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 prose-headings:my-2 prose-pre:my-2 break-words",
                              msg.role === 'user' 
                                ? "prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-white prose-code:text-white/80 prose-li:text-white prose-ul:text-white prose-ol:text-white" 
                                : ""
                            )}>
                              <Markdown>{msg.parts[0].text}</Markdown>
                            </div>

                            {msg.role === 'model' && (
                              <div className="absolute top-0 right-0 -mr-2 -mt-2 flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-all scale-90 group-hover/msg:scale-100 origin-bottom-left">
                                <div className="flex gap-1 bg-minimal-bg border border-minimal-border p-1 rounded-xl shadow-xl">
                                  <button
                                    onClick={() => applyContent(msg.parts[0].text, 'replace')}
                                    className="p-1.5 bg-minimal-accent text-white rounded-lg hover:scale-110 transition-transform flex items-center gap-1 px-2"
                                    title="Replace selection"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span className="text-[8px] font-bold uppercase tracking-tighter">Replace</span>
                                  </button>
                                  <button
                                    onClick={() => applyContent(msg.parts[0].text, 'append')}
                                    className="p-1.5 bg-minimal-sidebar border border-minimal-border text-minimal-text rounded-lg hover:bg-minimal-border transition-all flex items-center gap-1 px-2"
                                    title="Append to end"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span className="text-[8px] font-bold uppercase tracking-tighter">Append</span>
                                  </button>
                                  <button
                                    onClick={() => applyContent(msg.parts[0].text, 'suggest')}
                                    className="p-1.5 bg-minimal-sidebar border border-minimal-border text-minimal-text rounded-lg hover:bg-minimal-border transition-all flex items-center gap-1 px-2"
                                    title="Add as suggestion block"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span className="text-[8px] font-bold uppercase tracking-tighter">Suggest</span>
                                  </button>
                                </div>
                                <div className="flex gap-1 self-end">
                                  <button
                                    onClick={() => {
                                      setAiPrompt(`Revise this: "${msg.parts[0].text.substring(0, 50)}..." \n\nFeedback: `);
                                      chatInputRef.current?.focus();
                                    }}
                                    className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                    title="Revise"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setChatHistory(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="p-1.5 bg-red-500/10 text-red-600 rounded-lg border border-red-200 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    title="Dismiss"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="text-[8px] font-bold text-minimal-muted uppercase tracking-widest opacity-60 px-1">
                            {msg.role === 'user' ? 'Direct Input' : 'Ink & Quill Intelligence'}
                          </span>
                        </div>
                      ))}
                      {isGeneratingAi && (
                        <div className="flex flex-col gap-2 items-start mr-auto max-w-[90%]">
                          <div className="px-5 py-3 bg-minimal-sidebar border border-minimal-border rounded-2xl rounded-tl-none flex flex-col gap-3">
                            <div className="flex items-center gap-1.5">
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
                                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                  className="w-1.5 h-1.5 bg-minimal-accent rounded-full"
                                />
                              ))}
                            </div>
                            <span className="text-[8px] font-bold text-minimal-accent uppercase tracking-widest animate-pulse">
                              Gemini is crafting a response...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>

              <div className="p-4 md:p-6 bg-minimal-sidebar border-t border-minimal-border">
                <section>
                  {chatAttachedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 px-1">
                      {chatAttachedImages.filter(img => img).map((img, idx) => (
                        <div key={idx} className="relative group/img">
                          <img
                            src={img}
                            alt="attached"
                            className="w-12 h-12 rounded-lg object-cover border border-minimal-border shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => setChatAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mb-2 px-1">
                    <button onClick={() => formatChatInput('bold')} className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted transition-colors" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                    <button onClick={() => formatChatInput('italic')} className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted transition-colors" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                    <button onClick={() => formatChatInput('list')} className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted transition-colors" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                    <div className="w-px h-3 bg-minimal-border mx-1" />
                    <button onClick={() => chatImageInputRef.current?.click()} className="p-1.5 hover:bg-minimal-border rounded text-minimal-muted transition-colors" title="Attach Image"><ImagePlus className="w-3.5 h-3.5" /></button>
                    <input
                      type="file"
                      ref={chatImageInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleChatImageUpload}
                    />
                  </div>

                  <div className="relative group">
                    <textarea
                      ref={chatInputRef}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleAiGenerate();
                        }
                      }}
                      placeholder={chatHistory.length > 0 ? "Ask a follow up..." : "How can I help you write today?"}
                      className="w-full h-28 bg-minimal-bg border border-minimal-border rounded-2xl p-4 text-xs focus:ring-4 focus:ring-minimal-accent/5 focus:border-minimal-accent outline-none transition-all resize-none font-medium leading-relaxed pr-12 group-hover:border-minimal-accent/50"
                    />
                    {isGeneratingAi ? (
                       <button
                         onClick={stopAiGenerate}
                         className="absolute bottom-3 right-3 p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                         title="Stop Generation"
                       >
                         <div className="w-4 h-4 bg-current shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                       </button>
                    ) : (
                       <button
                         onClick={handleAiGenerate}
                         disabled={(chatAttachedImages.length === 0 && !aiPrompt.trim())}
                         className="absolute bottom-3 right-3 p-3 bg-minimal-accent text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                       >
                         <Send className="w-4 h-4" />
                       </button>
                    )}
                    <div className="absolute top-2 right-3">
                      <span className="text-[9px] font-bold text-minimal-muted/40 uppercase tracking-tighter">CMD+Enter</span>
                    </div>
                  </div>

                  {chatHistory.length === 0 && (
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <Wand2 className="w-3 h-3 text-minimal-muted" />
                        <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Editor Integration</h3>
                      </div>
                      <div className="p-4 bg-minimal-sidebar border border-minimal-border rounded-[1.5rem] text-center">
                        <p className="text-[11px] font-bold text-minimal-text mb-1">Quick Actions Moved</p>
                        <p className="text-[9px] text-minimal-muted leading-relaxed">AI Power Tools are now directly available in your editor header for faster access.</p>
                      </div>

                      <div className="flex items-center gap-2 px-1 mt-6">
                        <PenTool className="w-3 h-3 text-minimal-muted" />
                        <h3 className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Quick Brainstorming</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAiPrompt("Brainstorm 5 topics for ")} className="p-2 border border-minimal-border rounded-xl text-[10px] font-bold uppercase tracking-wider text-minimal-muted hover:bg-minimal-bg hover:text-minimal-accent transition-all">Quick Brainstorm</button>
                        <button onClick={() => setAiPrompt("Draft a professional ")} className="p-2 border border-minimal-border rounded-xl text-[10px] font-bold uppercase tracking-wider text-minimal-muted hover:bg-minimal-bg hover:text-minimal-accent transition-all">Quick Draft</button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
