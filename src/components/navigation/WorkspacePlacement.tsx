import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Library, 
  Layers, 
  BookOpen, 
  Search, 
  Plus, 
  Copy, 
  Trash2, 
  Edit3, 
  X, 
  BookmarkCheck, 
  CheckCircle2, 
  ArrowRightLeft, 
  GripVertical,
  Target,
  Clock,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { useEditorStore, Page } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

export const WorkspacePlacement: React.FC = () => {
  const { 
    pages, 
    activePageIds, 
    togglePageOpen, 
    removePage, 
    addPage, 
    reorderPages,
    setPageSettings,
    setPageContent
  } = useEditorStore();
  
  const { showPages, setPagesMenu, direction } = useUIStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');

  // Tab state: "placement" (desk & shelves), "sequence" (manuscript reorder)
  const [activeTab, setActiveTab] = useState<'placement' | 'sequence'>('placement');

  // Filtered pages based on search query
  const filteredPages = pages.filter(page => 
    page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activePages = filteredPages.filter(p => activePageIds.includes(p.id));
  const inactivePages = filteredPages.filter(p => !activePageIds.includes(p.id));

  const handleDuplicate = (page: Page) => {
    const title = `${page.title} (Copy)`;
    addPage(title, page.content);
  };

  const handleStartRename = (page: Page) => {
    setEditingTitleId(page.id);
    setTitleInput(page.title);
  };

  const handleSaveRename = (id: string) => {
    if (titleInput.trim()) {
      useEditorStore.setState((state) => ({
        pages: state.pages.map(p => p.id === id ? { ...p, title: titleInput.trim() } : p)
      }));
    }
    setEditingTitleId(null);
  };

  const getWordCount = (content: string) => {
    return content.split(/\s+/).filter(Boolean).length;
  };

  const getStatus = (page: Page) => {
    const wc = getWordCount(page.content);
    if (wc === 0) return { label: 'Empty', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', ar: 'فارغ' };
    if (page.wordGoal > 0) {
      if (wc >= page.wordGoal) return { label: 'Complete', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', ar: 'مكتمل' };
      return { label: 'Drafting', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', ar: 'مسودة' };
    }
    return { label: 'Drafting', color: 'bg-minimal-accent/10 text-minimal-accent border-minimal-accent/20', ar: 'قيد الكتابة' };
  };

  return (
    <>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setPagesMenu(false)}
        className="fixed inset-0 bg-zinc-950/30 backdrop-blur-sm z-[110]"
      />

      {/* Sidebar Drawer */}
      <motion.div
        initial={{ x: direction === 'rtl' ? -420 : 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: direction === 'rtl' ? -420 : 420, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 bottom-0 w-full max-w-[420px] bg-minimal-bg border-minimal-border z-[120] shadow-2xl flex flex-col transition-all duration-300",
          direction === 'rtl' ? "left-0 border-r" : "right-0 border-l"
        )}
      >
        {/* Header section */}
        <div className="p-5 border-b border-minimal-border bg-minimal-sidebar flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-minimal-accent" />
              <h3 className="text-sm font-black text-minimal-text uppercase tracking-widest font-sans">
                {direction === 'rtl' ? 'منظومة وضع الفصول والمستندات' : 'Workspace Placement'}
              </h3>
            </div>
            <p className="text-[10px] text-minimal-muted leading-relaxed font-serif max-w-[280px]">
              {direction === 'rtl' 
                ? 'نظّم فصول مخطوطتك ووزّعها بدقة بين منصة الكتابة النشطة ورفوف الحفظ كمرجع.'
                : 'Place, classify, and arrange your chapters between the active writing desk and storage shelves.'}
            </p>
          </div>
          <button 
            onClick={() => setPagesMenu(false)}
            className="p-2 hover:bg-minimal-border rounded-full hover:text-red-500 transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 border-b border-minimal-border p-2 bg-minimal-sidebar/40 gap-1.5">
          <button
            onClick={() => setActiveTab('placement')}
            className={cn(
              "py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
              activeTab === 'placement'
                ? "bg-minimal-bg text-minimal-accent border border-minimal-border shadow-sm"
                : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{direction === 'rtl' ? 'ترتيب المنصة والرفوف' : 'Desk & Shelves'}</span>
          </button>
          <button
            onClick={() => setActiveTab('sequence')}
            className={cn(
              "py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
              activeTab === 'sequence'
                ? "bg-minimal-bg text-minimal-accent border border-minimal-border shadow-sm"
                : "text-minimal-muted hover:text-minimal-text hover:bg-minimal-sidebar"
            )}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{direction === 'rtl' ? 'تسلسل المخطوطة الكلي' : 'Manuscript Order'}</span>
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-minimal-border/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-minimal-muted/80" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={direction === 'rtl' ? 'ابحث في العناوين والمحتويات...' : 'Search chapters and snippets...'}
              className="w-full bg-minimal-sidebar border border-minimal-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-minimal-text placeholder:text-minimal-muted/70 outline-none focus:border-minimal-accent/40 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-minimal-border rounded"
              >
                <X className="w-3 h-3 text-minimal-muted" />
              </button>
            )}
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'placement' ? (
              <motion.div
                key="placement-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* 1. ACTIVE DESK */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-minimal-accent">
                      <BookOpen className="w-4 h-4" />
                      <span>{direction === 'rtl' ? 'منصة الكتابة النشطة (Desk)' : 'Active Workspace (Desk)'}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-minimal-accent/10 text-minimal-accent px-2 py-0.5 rounded-full border border-minimal-accent/10">
                      {activePages.length} {direction === 'rtl' ? 'فصل' : 'open'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl border-2 border-dashed border-minimal-accent/20 bg-minimal-accent/5 space-y-2 min-h-[120px] flex flex-col justify-center">
                    {activePages.length === 0 ? (
                      <div className="text-center py-6 text-minimal-muted">
                        <Layers className="w-8 h-8 mx-auto opacity-20 mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-wide">
                          {direction === 'rtl' ? 'المنصة فارغة تماماً' : 'Desk is Empty'}
                        </p>
                        <p className="text-[9px] text-minimal-muted mt-1 leading-normal max-w-[240px] mx-auto">
                          {direction === 'rtl' 
                            ? 'انقر على الفصول أدناه في الرفوف لوضعها على طاولة العمل والبدء بالكتابة.'
                            : 'Click "Place on Desk" on the storage shelves below to load chapters for editing.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activePages.map((page) => {
                          const status = getStatus(page);
                          const wc = getWordCount(page.content);
                          
                          return (
                            <motion.div
                              key={page.id}
                              layoutId={`placement-card-${page.id}`}
                              className="bg-minimal-bg border border-minimal-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                            >
                              <div className="min-w-0 flex-1 mr-3">
                                <div className="flex items-center gap-2 mb-1">
                                  {editingTitleId === page.id ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={titleInput}
                                      onChange={(e) => setTitleInput(e.target.value)}
                                      onBlur={() => handleSaveRename(page.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveRename(page.id);
                                        if (e.key === 'Escape') setEditingTitleId(null);
                                      }}
                                      className="border border-minimal-accent rounded px-1.5 py-0.5 text-xs text-minimal-text bg-minimal-sidebar outline-none"
                                    />
                                  ) : (
                                    <h4 
                                      onDoubleClick={() => handleStartRename(page)}
                                      className="text-xs font-bold text-minimal-text truncate hover:text-minimal-accent cursor-pointer flex items-center gap-1.5"
                                      title="Double click to rename"
                                    >
                                      {page.title}
                                      <Edit3 className="w-3 h-3 text-minimal-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </h4>
                                  )}
                                  
                                  <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0", status.color)}>
                                    {direction === 'rtl' ? status.ar : status.label}
                                  </span>
                                </div>
                                
                                <p className="text-[9px] text-minimal-muted truncate italic font-serif">
                                  {page.content.replace(/[#*`>_\n]/g, '').substring(0, 50) || '...'}
                                </p>
                                
                                <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-minimal-muted">
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3 text-minimal-muted/65" />
                                    <span>{wc} {direction === 'rtl' ? 'كلمة' : 'words'}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-minimal-muted/65" />
                                    <span>{Math.ceil(wc / 200)} {direction === 'rtl' ? 'دقائق' : 'min'}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => togglePageOpen(page.id)}
                                  className="px-2 py-1.5 rounded-lg border border-minimal-border hover:border-minimal-accent/30 hover:bg-minimal-sidebar text-[9px] font-bold text-minimal-muted hover:text-minimal-accent transition-all flex items-center gap-1"
                                  title="Retire to Shelf Archive"
                                >
                                  <span>{direction === 'rtl' ? 'أرشف' : 'Retire'}</span>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. LIBRARY SHELVES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-minimal-muted">
                      <Library className="w-4 h-4" />
                      <span>{direction === 'rtl' ? 'رفوف الحفظ والأرشيف' : 'Library Shelves (Archive)'}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-minimal-sidebar border border-minimal-border px-2 py-0.5 rounded-full text-minimal-muted">
                      {inactivePages.length} {direction === 'rtl' ? 'مخزن' : 'shelved'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {inactivePages.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-minimal-border rounded-2xl text-minimal-muted bg-minimal-sidebar/20">
                        <p className="text-[10px] font-bold uppercase tracking-wide">
                          {direction === 'rtl' ? 'الرفوف فارغة تماماً' : 'Shelves are Empty'}
                        </p>
                        <p className="text-[9px] text-minimal-muted mt-1">
                          {direction === 'rtl' ? 'تم وضع جميع الفصول على طاولة العمل حالياً.' : 'All chapters are currently placed on the Desk.'}
                        </p>
                      </div>
                    ) : (
                      inactivePages.map((page) => {
                        const status = getStatus(page);
                        const wc = getWordCount(page.content);

                        return (
                          <motion.div
                            key={page.id}
                            layoutId={`placement-card-${page.id}`}
                            className="bg-minimal-sidebar/40 border border-minimal-border rounded-xl p-3 hover:bg-minimal-bg hover:border-minimal-accent/20 transition-all flex items-center justify-between group relative"
                          >
                            <div className="min-w-0 flex-1 mr-3">
                              <div className="flex items-center gap-2 mb-1">
                                {editingTitleId === page.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onBlur={() => handleSaveRename(page.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRename(page.id);
                                      if (e.key === 'Escape') setEditingTitleId(null);
                                    }}
                                    className="border border-minimal-accent rounded px-1.5 py-0.5 text-xs text-minimal-text bg-minimal-sidebar outline-none"
                                  />
                                ) : (
                                  <h4 
                                    onDoubleClick={() => handleStartRename(page)}
                                    className="text-xs font-bold text-minimal-text truncate cursor-pointer hover:text-minimal-accent flex items-center gap-1.5"
                                    title="Double click to rename"
                                  >
                                    {page.title}
                                    <Edit3 className="w-3 h-3 text-minimal-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </h4>
                                )}
                                
                                <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0", status.color)}>
                                  {direction === 'rtl' ? status.ar : status.label}
                                </span>
                              </div>

                              <p className="text-[9px] text-minimal-muted truncate italic font-serif">
                                {page.content.replace(/[#*`>_\n]/g, '').substring(0, 50) || '...'}
                              </p>

                              <div className="flex items-center gap-3 mt-1.5 text-[9px] font-mono text-minimal-muted">
                                <span>{wc} {direction === 'rtl' ? 'كلمة' : 'w'}</span>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleDuplicate(page)}
                                    className="hover:text-minimal-accent"
                                    title="Duplicate Chapter"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  {pages.length > 1 && (
                                    <button 
                                      onClick={() => {
                                        if (window.confirm(direction === 'rtl' ? 'هل أنت متأكد من حذف هذا الفصل نهائياً؟' : 'Are you sure you want to delete this chapter permanently?')) {
                                          removePage(page.id);
                                        }
                                      }}
                                      className="hover:text-red-500"
                                      title="Delete Chapter"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => togglePageOpen(page.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-minimal-accent hover:bg-minimal-accent/90 text-white text-[9px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center gap-1"
                            >
                              <span>{direction === 'rtl' ? 'ضع على الرف' : 'Desk'}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* SEQUENCE REORDER TAB */
              <motion.div
                key="sequence-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="p-3 bg-minimal-sidebar border border-minimal-border rounded-2xl text-[9px] text-minimal-muted leading-relaxed">
                  {direction === 'rtl' 
                    ? 'اسحب وأسقط لترتيب الفصول الفعلي داخل المخطوطة الكلية. سيؤدي هذا لتغيير تسلسلهما الرقمي ومؤشر الترتيب مباشرة.'
                    : 'Drag and drop any chapter node vertically to define the master sequence of your manuscript. This modifies document order dynamically.'}
                </div>

                <Reorder.Group
                  axis="y"
                  values={pages}
                  onReorder={reorderPages}
                  className="space-y-2"
                >
                  {filteredPages.map((page, index) => (
                    <Reorder.Item
                      key={page.id}
                      value={page}
                      className={cn(
                        "bg-minimal-bg border border-minimal-border rounded-xl p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing flex items-center justify-between group",
                        activePageIds.includes(page.id) ? "border-minimal-accent/30 bg-minimal-accent/[0.01]" : ""
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <GripVertical className="w-3.5 h-3.5 text-minimal-muted shrink-0 group-hover:text-minimal-text transition-colors" />
                        
                        <div className="w-6 h-6 rounded-lg bg-minimal-sidebar border border-minimal-border flex items-center justify-center text-[10px] font-mono font-bold text-minimal-muted shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-minimal-text truncate">{page.title}</h4>
                          <p className="text-[9px] text-minimal-muted font-mono mt-0.5">
                            {getWordCount(page.content)} {direction === 'rtl' ? 'كلمة' : 'words'}
                            {activePageIds.includes(page.id) && (
                              <span className="ml-1.5 text-[8px] font-bold text-minimal-accent bg-minimal-accent/10 px-1 rounded">
                                {direction === 'rtl' ? 'نشط' : 'ACTIVE'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-[9px] font-mono font-bold text-minimal-muted shrink-0 flex items-center gap-1">
                        <span>Ch. {index + 1}</span>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-minimal-border bg-minimal-sidebar flex gap-2">
          <button
            onClick={() => addPage(direction === 'rtl' ? 'فصل جديد' : 'New Chapter', `# ${direction === 'rtl' ? 'فصل جديد' : 'New Chapter'}\n\n`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-minimal-accent hover:bg-minimal-accent/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-minimal-accent/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{direction === 'rtl' ? 'إضافة فصل جديد' : 'Add New Chapter'}</span>
          </button>
        </div>
      </motion.div>
    </>
  );
};
