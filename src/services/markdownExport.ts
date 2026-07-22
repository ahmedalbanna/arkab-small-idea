/**
 * Markdown export — triggers a .md file download.
 */
import { downloadBlob } from "./exportUtils";

export interface MarkdownExportOptions {
  filename?: string;
}

/**
 * Export raw markdown string as a .md file.
 */
export function exportToMarkdown(markdown: string, filename: string = "document"): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, `${filename}.md`);
}
