/**
 * RTF export — generates a minimal Rich Text Format document from editor state.
 */
import { saveAs } from "file-saver";

export interface RtfExportOptions {
  filename?: string;
}

/**
 * Escape text for RTF encoding.
 */
function escapeRTF(text: string): string {
  return (
    text
      .replace(/[\\}{]/g, "\\$&")
      .replace(/\n/g, "\\line ")
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7F]/g, (c) => "\\u" + c.charCodeAt(0) + "?")
  );
}

/**
 * Export a ProseMirror document as .rtf.
 */
export function exportToRTF(doc: any, filename: string = "document"): void {
  const rtfHeader = "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}}\n";
  let rtfBody = "\\f0\\fs24 ";

  doc.descendants((node: any) => {
    if (node.type.name === "paragraph") {
      node.content.forEach((child: any) => {
        if (child.isText) {
          let text = escapeRTF(child.text);
          if (child.marks?.some((m: any) => m.type.name === "strong")) text = `\\b ${text}\\b0 `;
          if (child.marks?.some((m: any) => m.type.name === "em")) text = `\\i ${text}\\i0 `;
          if (child.marks?.some((m: any) => m.type.name === "underline"))
            text = `\\ul ${text}\\ulnone `;
          rtfBody += text;
        }
      });
      rtfBody += "\\par\n";
      return false;
    } else if (node.type.name === "heading") {
      const level = node.attrs.level || 1;
      // fs is half-points: Heading 1 → 36 (18pt), H2 → 32 (16pt), H3 → 28 (14pt)…
      const size = (20 - level * 2) * 2;
      rtfBody += `\\b\\fs${size} `;
      node.content.forEach((child: any) => {
        if (child.isText) {
          rtfBody += escapeRTF(child.text);
        }
      });
      rtfBody += `\\b0\\fs24\\par\n`;
      return false;
    } else if (node.type.name === "horizontal_rule") {
      rtfBody += "\\par\\line __________________________________________________\\line\\par\n";
    } else if (node.type.name === "blockquote") {
      rtfBody += "{\\i " + escapeRTF(node.textContent) + " }\\par\n";
      return false;
    }
    return true;
  });

  const fullRTF = rtfHeader + rtfBody + "}";
  const blob = new Blob([fullRTF], { type: "application/rtf" });
  saveAs(blob, `${filename}.rtf`);
}
