import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';
import { importFile } from '../../services/importService';

interface ImportModalProps {
  onImport: (content: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onImport }) => {
  const { showImportModal, setImportModal } = useUIStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setError(null);

    try {
      const content = await importFile(selectedFile);
      onImport(content);
      setSuccess(true);
      setTimeout(() => {
        setImportModal(false);
        // Reset state after closing
        setTimeout(() => {
          setSelectedFile(null);
          setSuccess(false);
        }, 300);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setIsImporting(false);
    }
  };

  if (!showImportModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-minimal-bg border border-minimal-border rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-minimal-border flex items-center justify-between bg-minimal-sidebar/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-minimal-accent/10 rounded-xl text-minimal-accent">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-minimal-text uppercase tracking-widest">Import Document</h2>
            </div>
            <button
              onClick={() => setImportModal(false)}
              className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {!selectedFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-minimal-border rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-minimal-accent transition-all bg-minimal-sidebar/20 hover:bg-minimal-accent/5"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".docx,.html,.htm,.md,.markdown,.txt"
                  onChange={handleFileChange}
                />
                <div className="p-4 bg-minimal-bg rounded-full shadow-lg group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-minimal-muted group-hover:text-minimal-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-minimal-text">Select a file to import</p>
                  <p className="text-xs text-minimal-muted mt-1">Supported: DOCX, HTML, Markdown, TXT</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-minimal-sidebar/50 rounded-2xl border border-minimal-border">
                  <div className="p-3 bg-minimal-bg rounded-xl shadow-sm text-minimal-accent">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-minimal-text truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-minimal-muted font-medium uppercase tracking-wider">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.name.split('.').pop()?.toUpperCase()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-minimal-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-minimal-sidebar/30 rounded-2xl p-4 border border-minimal-border/30">
                  <p className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest mb-2 px-1">Import Options</p>
                  <div className="flex items-start gap-3 p-3 bg-minimal-bg rounded-xl border border-minimal-border/50">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Importing this file will replace the content of your current open document. Make sure you have a snapshot if you want to recover previous work.
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-bold">{error}</p>
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100"
                  >
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-bold">Imported successfully! Redirecting...</p>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setImportModal(false)}
                    disabled={isImporting}
                    className="flex-1 py-4 text-xs font-bold text-minimal-muted hover:bg-minimal-sidebar rounded-2xl transition-all uppercase tracking-widest border border-minimal-border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || success}
                    className="flex-[2] py-4 bg-minimal-accent text-white text-xs font-bold rounded-2xl shadow-xl shadow-minimal-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Done
                      </>
                    ) : (
                      'Confirm Import'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
