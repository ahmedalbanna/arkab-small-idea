import React from 'react';
import { motion } from 'motion/react';
import { Download, Upload, FileText, Code, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { exportToPDF, exportToHTML, exportToMarkdown, exportToDOCX } from '../../services/exportService';

import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';

interface FileActionsMenuProps {
  showFileActions: boolean;
  setShowFileActions: (val: boolean) => void;
  editorRef: React.RefObject<any>;
  markdown: string;
  pageId: string;
  inline?: boolean;
}

export const FileActionsMenu: React.FC<FileActionsMenuProps> = ({
  showFileActions,
  setShowFileActions,
  editorRef,
  markdown,
  pageId,
  inline = false
}) => {
  const { wipePage } = useEditorStore();
  const { setImportModal } = useUIStore();

  return (
    <div className={inline ? "" : "relative"}>
      {!inline && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 0.5, x: 0 }}
          whileHover={{ opacity: 1, scale: 1.05 }}
          className="p-3.5 bg-minimal-bg/90 backdrop-blur border border-minimal-border rounded-full shadow-2xl text-minimal-muted transition-all duration-300"
          onClick={() => setShowFileActions(!showFileActions)} title="File Actions (Import/Export)"
        >
          <Download className="w-5 h-5" />
        </motion.button>
      )}

      {showFileActions && (
        <div className={cn(
          "flex flex-col gap-1 w-56 bg-minimal-bg border border-minimal-border rounded-2xl shadow-2xl p-2 z-[60]",
          inline ? "absolute top-full right-0 mt-2" : "absolute right-full mr-4 bottom-0"
        )}>
          <div className="px-3 py-1.5 border-b border-minimal-border flex items-center justify-between">
            <span className="text-[9px] font-bold text-minimal-muted uppercase tracking-widest">File Actions</span>
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to wipe this page? This cannot be undone.")) {
                   wipePage(pageId);
                   setShowFileActions(false);
                }
              }}
              className="px-2 py-0.5 rounded bg-red-50 text-[9px] font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
            >
              Wipe
            </button>
          </div>
          <div className="p-1 space-y-1">
            {/* Import Section */}
            <button
              onClick={() => {
                setImportModal(true);
                setShowFileActions(false);
              }}
              className="w-full text-left p-2.5 hover:bg-minimal-accent/5 rounded-xl transition-all flex items-center gap-3 group/item"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover/item:bg-emerald-500 group-hover/item:text-white transition-colors">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-minimal-text">Import File</p>
                <p className="text-[9px] text-minimal-muted font-medium">DOCX, HTML, Markdown</p>
              </div>
            </button>

            <div className="h-px bg-minimal-border/30 my-1 mx-2" />
            <p className="px-3 py-1 text-[8px] font-bold text-minimal-muted uppercase tracking-wider">Export As</p>
            <button
              onClick={async () => {
                const editorElem = document.querySelector('.ProseMirror') as HTMLElement;
                if (editorElem) {
                  await exportToPDF(editorElem, 'Ink-Quill-Doc');
                }
              }}
              className="w-full text-left p-2.5 hover:bg-minimal-accent/5 rounded-xl transition-all flex items-center gap-3 group/item"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 group-hover/item:bg-red-500 group-hover/item:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-minimal-text">PDF Document</span>
            </button>
            <button
              onClick={() => {
                const html = editorRef.current?.getHtml();
                if (html) exportToHTML(html, 'Ink-Quill-Doc');
              }}
              className="w-full text-left p-2.5 hover:bg-minimal-accent/5 rounded-xl transition-all flex items-center gap-3 group/item"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 group-hover/item:bg-blue-500 group-hover/item:text-white transition-colors">
                <Code className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-minimal-text">HTML Page</span>
            </button>
            <button
              onClick={() => exportToMarkdown(markdown, 'Ink-Quill-Doc')}
              className="w-full text-left p-2.5 hover:bg-minimal-accent/5 rounded-xl transition-all flex items-center gap-3 group/item"
            >
              <div className="w-8 h-8 rounded-lg bg-minimal-border flex items-center justify-center text-minimal-muted group-hover/item:bg-minimal-muted group-hover/item:text-minimal-bg transition-colors">
                <Save className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-minimal-text">Markdown</span>
            </button>
            <button
              onClick={async () => {
                const doc = editorRef.current?.getDoc();
                if (doc) await exportToDOCX(doc, 'Ink-Quill-Doc');
              }}
              className="w-full text-left p-2.5 hover:bg-minimal-accent/5 rounded-xl transition-all flex items-center gap-3 group/item"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover/item:bg-blue-600 group-hover/item:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-minimal-text">Word Document (DOCX)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
