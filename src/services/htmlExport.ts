/**
 * HTML export — wraps content in a standalone styled HTML document and triggers download.
 */
import { downloadBlob } from "./exportUtils";
import type { ExportProgressCallback } from "./exportUtils";

export interface HtmlExportOptions {
  filename?: string;
  title?: string;
}

const DEFAULT_OPTIONS: Required<HtmlExportOptions> = {
  filename: "document",
  title: "Ink & Quill Document",
};

/**
 * Export HTML content as a standalone .html file.
 */
export function exportToHTML(
  htmlContent: string,
  filename: string = DEFAULT_OPTIONS.filename,
  _onProgress?: ExportProgressCallback,
  options?: HtmlExportOptions,
): void {
  const opts = { ...DEFAULT_OPTIONS, filename, ...options };
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
    blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #666; font-style: italic; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { font-family: monospace; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f9f9f9; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${opts.filename}.html`);
}

/** Minimal HTML entity escaping */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
