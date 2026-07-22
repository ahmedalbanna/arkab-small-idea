/**
 * PDF export — uses html2pdf.js with enhanced styling and progress reporting.
 */
import html2pdf from "html2pdf.js";
import type { ExportProgressCallback } from "./exportUtils";
import { noopProgress } from "./exportUtils";

export interface PdfExportOptions {
  filename?: string;
  margin?: [number, number, number, number];
  imageQuality?: number;
  format?: "a4" | "letter" | "legal";
  orientation?: "portrait" | "landscape";
}

const DEFAULT_OPTIONS: Required<PdfExportOptions> = {
  filename: "document",
  margin: [1, 1, 1, 1],
  imageQuality: 0.98,
  format: "a4",
  orientation: "portrait",
};

/**
 * Export an HTMLElement to PDF.
 * Clones the element to preserve the original UI, applies print-friendly
 * styling, and triggers download.
 */
export async function exportToPDF(
  element: HTMLElement,
  filename: string = "document",
  onProgress: ExportProgressCallback = noopProgress,
  options: PdfExportOptions = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, filename, ...options };

  onProgress({ stage: "preparing", percent: 10, message: "Preparing content…" });

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.padding = "40px";
  clone.style.color = "#333";
  clone.style.backgroundColor = "#fff";
  clone.style.width = "800px";
  clone.classList.add("export-pdf-content");

  const style = document.createElement("style");
  style.textContent = `
    .export-pdf-content {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
    }
    .export-pdf-content h1 { font-size: 24pt; margin-bottom: 20pt; }
    .export-pdf-content h2 { font-size: 18pt; margin-top: 20pt; margin-bottom: 10pt; }
    .export-pdf-content h3 { font-size: 14pt; margin-top: 16pt; margin-bottom: 8pt; }
    .export-pdf-content p { margin-bottom: 10pt; }
    .export-pdf-content blockquote {
      border-left: 4px solid #ddd;
      padding-left: 15px;
      color: #666;
      font-style: italic;
    }
    .export-pdf-content pre {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
      font-size: 9pt;
    }
    .export-pdf-content img { max-width: 100%; height: auto; }
    .export-pdf-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
    }
    .export-pdf-content th, .export-pdf-content td {
      border: 1px solid #ddd;
      padding: 8pt;
      text-align: left;
    }
    .export-pdf-content th { background: #f9f9f9; }
  `;
  document.head.appendChild(style);

  onProgress({ stage: "rendering", percent: 40, message: "Rendering PDF…" });

  try {
    onProgress({ stage: "packaging", percent: 70, message: "Packaging PDF…" });
    await html2pdf()
      .set({
        margin: opts.margin,
        filename: `${opts.filename}.pdf`,
        image: { type: "jpeg" as const, quality: opts.imageQuality },
        html2canvas: { scale: 2, letterRendering: true, useCORS: true },
        jsPDF: {
          unit: "in" as const,
          format: opts.format,
          orientation: opts.orientation,
        },
      })
      .from(clone)
      .save();
    onProgress({ stage: "downloading", percent: 100, message: "Done" });
  } finally {
    style.remove();
  }
}
