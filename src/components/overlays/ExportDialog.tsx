import React, { useState, useCallback, useRef } from "react";
import { FileText, Code, Save, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { useUIStore } from "../../stores/uiStore";
import { useEditorStore } from "../../stores/editorStore";
import { useAppApi } from "../../plugins/appContext";
import {
  exportToPDF,
  exportToDOCX,
  exportToHTML,
  exportToMarkdown,
  exportToRTF,
} from "../../services/exportService";
import type { ExportProgressEvent } from "../../services/exportUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = "pdf" | "docx" | "html" | "markdown" | "rtf";

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const FORMATS: FormatOption[] = [
  {
    id: "pdf",
    label: "PDF Document",
    description: "Print-optimized, best for sharing and printing",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "docx",
    label: "Word Document",
    description: "Editable in Microsoft Word, Google Docs, LibreOffice",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "html",
    label: "HTML Page",
    description: "Standalone web page with styling",
    icon: <Code className="w-5 h-5" />,
  },
  {
    id: "markdown",
    label: "Markdown",
    description: "Plain text with simple formatting",
    icon: <Save className="w-5 h-5" />,
  },
  {
    id: "rtf",
    label: "Rich Text (RTF)",
    description: "Compatible with most word processors",
    icon: <FileText className="w-5 h-5" />,
  },
];

// ---------------------------------------------------------------------------
// ExportDialog — no props required, reads editor from AppApi context
// ---------------------------------------------------------------------------

export const ExportDialog: React.FC = () => {
  const { showExportModal, setExportModal } = useUIStore();
  const appApi = useAppApi();
  const activePageId = appApi.getActivePageId();
  const pages = useEditorStore((s) => s.pages);
  const activePage = pages.find((p) => p.id === activePageId);
  const pageContent = activePage?.content || "";

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [progress, setProgress] = useState<ExportProgressEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setExportModal(false);
        setTimeout(() => {
          setStatus("idle");
          setProgress(null);
          setErrorMessage(null);
          abortRef.current = false;
        }, 200);
      }
    },
    [setExportModal],
  );

  const onProgress = useCallback((evt: ExportProgressEvent) => {
    setProgress(evt);
  }, []);

  /** Resolve the editor ref for the active page. */
  const getEditor = useCallback(() => {
    const pageId = appApi.getActivePageId();
    return pageId ? appApi.getEditorRef(pageId) : null;
  }, [appApi]);

  const handleExport = useCallback(async () => {
    setStatus("exporting");
    setErrorMessage(null);
    setProgress({ stage: "preparing", percent: 0, message: "Starting…" });
    abortRef.current = false;

    try {
      switch (selectedFormat) {
        case "pdf": {
          // Use scoped editor ref instead of global querySelector (fixes P4)
          const pageId = appApi.getActivePageId();
          const pageEl = pageId ? document.querySelector(`[data-page-id="${pageId}"]`) : null;
          const editorElem = pageEl?.querySelector(".ProseMirror") as HTMLElement;
          if (!editorElem) throw new Error("Editor not found");
          await exportToPDF(editorElem, "Ink-Quill-Doc", onProgress);
          break;
        }
        case "docx": {
          const editor = getEditor();
          const doc = editor?.getDoc();
          if (!doc) throw new Error("No document content available");
          await exportToDOCX(doc, "Ink-Quill-Doc", onProgress);
          break;
        }
        case "html": {
          const editor = getEditor();
          const html = editor?.getHtml();
          if (!html) throw new Error("No HTML content available");
          exportToHTML(html, "Ink-Quill-Doc", onProgress);
          break;
        }
        case "markdown": {
          const md = pageContent;
          if (!md) throw new Error("No markdown content available");
          exportToMarkdown(md, "Ink-Quill-Doc");
          break;
        }
        case "rtf": {
          const editor = getEditor();
          const rtfDoc = editor?.getDoc();
          if (!rtfDoc) throw new Error("No document content available");
          exportToRTF(rtfDoc, "Ink-Quill-Doc");
          break;
        }
      }
      if (!abortRef.current) {
        setStatus("done");
        setProgress({ stage: "downloading", percent: 100, message: "Done" });
        setTimeout(() => setExportModal(false), 1500);
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setStatus("error");
        setErrorMessage(err?.message || "Export failed");
        setProgress({
          stage: "error",
          percent: 0,
          message: err?.message || "Export failed",
        });
      }
    }
  }, [selectedFormat, getEditor, onProgress, setExportModal, pageContent]);

  return (
    <Dialog
      isOpen={showExportModal}
      onClose={() => handleOpenChange(false)}
      title="Export Document"
    >
      <div className="space-y-4">
        {/* Format selection */}
        <p className="text-[10px] font-bold text-minimal-muted uppercase tracking-widest">Format</p>
        <div className="grid grid-cols-1 gap-2">
          {FORMATS.map((fmt) => {
            const isSelected = selectedFormat === fmt.id;
            const colorClass = getFormatColor(fmt.id, isSelected);
            return (
              <button
                key={fmt.id}
                onClick={() => {
                  setSelectedFormat(fmt.id);
                  setStatus("idle");
                  setErrorMessage(null);
                }}
                disabled={status === "exporting"}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 border ${
                  isSelected
                    ? "bg-minimal-accent/10 border-minimal-accent/30"
                    : "bg-transparent border-minimal-border/50 hover:bg-minimal-sidebar"
                } ${status === "exporting" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className={colorClass.icon}>{fmt.icon}</div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-minimal-text">{fmt.label}</p>
                  <p className="text-[9px] text-minimal-muted font-medium">{fmt.description}</p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-minimal-accent/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-minimal-accent" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Status / Progress */}
        {(status === "exporting" || status === "done" || status === "error") && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-3 ${
              status === "exporting"
                ? "border-minimal-border/50 bg-minimal-sidebar"
                : status === "done"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            {status === "exporting" ? (
              <Loader2 className="w-5 h-5 text-minimal-accent animate-spin shrink-0" />
            ) : status === "done" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-bold ${
                  status === "exporting"
                    ? "text-minimal-text"
                    : status === "done"
                      ? "text-emerald-700"
                      : "text-red-700"
                }`}
              >
                {status === "exporting"
                  ? progress?.message || "Exporting…"
                  : status === "done"
                    ? "Export complete"
                    : errorMessage || "Export failed"}
              </p>
              {status === "exporting" && progress && (
                <div className="mt-1.5 w-full bg-minimal-border/30 rounded-full h-1.5">
                  <div
                    className="h-full rounded-full bg-minimal-accent transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleOpenChange(false)}
            disabled={status === "exporting"}
            className="flex-1 px-4 py-2.5 rounded-xl border border-minimal-border text-minimal-muted text-xs font-bold hover:bg-minimal-sidebar transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={status === "exporting" || status === "done"}
            className="flex-1 px-4 py-2.5 rounded-xl bg-minimal-accent text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "exporting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === "exporting"
              ? "Exporting…"
              : status === "done"
                ? "Exported ✓"
                : `Export ${selectedFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFormatColor(id: ExportFormat, isSelected: boolean): { icon: string } {
  const selectedMap: Record<ExportFormat, string> = {
    pdf: "bg-red-500 text-white",
    docx: "bg-blue-600 text-white",
    html: "bg-blue-500 text-white",
    markdown: "bg-minimal-muted text-minimal-bg",
    rtf: "bg-amber-600 text-white",
  };
  const idleMap: Record<ExportFormat, string> = {
    pdf: "bg-red-50 text-red-500",
    docx: "bg-blue-50 text-blue-600",
    html: "bg-blue-50 text-blue-500",
    markdown: "bg-minimal-border/30 text-minimal-muted",
    rtf: "bg-amber-50 text-amber-600",
  };
  const cls = isSelected ? selectedMap[id] : idleMap[id];
  return { icon: `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${cls}` };
}
