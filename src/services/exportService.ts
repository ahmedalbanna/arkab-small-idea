import html2pdf from 'html2pdf.js';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  VerticalAlign,
  ImageRun,
  ExternalHyperlink,
  LevelFormat
} from 'docx';
import { saveAs } from 'file-saver';
import { getKrokiUrl } from '../lib/kroki';

async function getImageData(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (e) {
    console.error("Failed to fetch image data for DOCX export:", e);
    return null;
  }
}

export const exportToPDF = async (element: HTMLElement, filename: string = 'document') => {
  const options = {
    margin: [1, 1, 1, 1] as [number, number, number, number],
    filename: `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, letterRendering: true, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
  };

  // Create a clone to avoid messing with the original UI
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.padding = '40px';
  clone.style.color = '#333';
  clone.style.backgroundColor = '#fff';
  clone.style.width = '800px';
  clone.classList.add('export-pdf-content');

  // Basic styling for the PDF
  const style = document.createElement('style');
  style.textContent = `
    .export-pdf-content { font-family: 'Inter', sans-serif; line-height: 1.6; }
    .export-pdf-content h1 { font-size: 24pt; margin-bottom: 20pt; }
    .export-pdf-content h2 { font-size: 18pt; margin-top: 20pt; margin-bottom: 10pt; }
    .export-pdf-content p { margin-bottom: 10pt; }
    .export-pdf-content blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #666; font-style: italic; }
    .export-pdf-content pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    .export-pdf-content img { max-width: 100%; height: auto; }
  `;
  document.head.appendChild(style);

  try {
    await html2pdf().set(options).from(clone).save();
  } finally {
    style.remove();
  }
};

export const exportToDOCX = async (doc: any, filename: string = 'document') => {
  const children: any[] = [];

  const processTextRuns = (node: any): (TextRun | ExternalHyperlink)[] => {
    const runs: (TextRun | ExternalHyperlink)[] = [];
    node.content.forEach((child: any) => {
      if (child.isText) {
        const linkMark = child.marks.find((m: any) => m.type.name === 'link');
        
        const run = new TextRun({
          text: child.text,
          bold: child.marks.some((m: any) => m.type.name === 'strong'),
          italics: child.marks.some((m: any) => m.type.name === 'em'),
          underline: child.marks.some((m: any) => m.type.name === 'underline') ? {} : undefined,
          strike: child.marks.some((m: any) => m.type.name === 'strike'),
          font: 'Inter',
          size: 24, // 12pt
          color: child.marks.some((m: any) => m.type.name === 'code') ? 'C7254E' : undefined,
          shading: child.marks.some((m: any) => m.type.name === 'code') ? { fill: 'F9F2F4', color: 'C7254E' } : undefined,
        });

        if (linkMark) {
          runs.push(new ExternalHyperlink({
            children: [run],
            link: linkMark.attrs.href,
          }));
        } else {
          runs.push(run);
        }
      }
    });
    return runs;
  };

  const processNode = async (node: any, options: { listLevel?: number, listType?: 'bullet' | 'ordered' } = {}) => {
    if (node.type.name === 'paragraph') {
      const pChildren = processTextRuns(node);
      children.push(new Paragraph({
        children: pChildren,
        spacing: { after: 200 },
        bullet: options.listType === 'bullet' ? { level: options.listLevel } : undefined,
        numbering: options.listType === 'ordered' ? { reference: 'main-numbering', level: options.listLevel } : undefined,
      }));
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level;
      const headingMap: Record<number, any> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      children.push(new Paragraph({
        children: processTextRuns(node),
        heading: headingMap[level] || HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }));
    } else if (node.type.name === 'blockquote') {
      children.push(new Paragraph({
        children: processTextRuns(node),
        indent: { left: 720 },
        border: {
          left: { color: 'E5E7EB', size: 24, style: BorderStyle.SINGLE, space: 10 },
        },
        spacing: { before: 200, after: 200 },
      }));
    } else if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') {
      const type = node.type.name === 'bullet_list' ? 'bullet' : 'ordered';
      const listLevel = (options.listLevel !== undefined ? options.listLevel + 1 : 0);
      for (let i = 0; i < node.childCount; i++) {
        const item = node.child(i);
        // A list item usually contains a paragraph, but could contain sub-lists
        for (let j = 0; j < item.childCount; j++) {
          await processNode(item.child(j), { listLevel, listType: type });
        }
      }
    } else if (node.type.name === 'table') {
      const tableRows: TableRow[] = [];
      node.forEach((row: any) => {
        const cells: TableCell[] = [];
        row.forEach((cell: any) => {
          const cellParagraphs: Paragraph[] = [];
          cell.forEach((p: any) => {
            cellParagraphs.push(new Paragraph({
              children: processTextRuns(p),
              spacing: { after: 0 },
            }));
          });
          cells.push(new TableCell({
            children: cellParagraphs,
            verticalAlign: VerticalAlign.CENTER,
            shading: cell.type.name === 'table_header' ? { fill: 'F3F4F6' } : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
            },
          }));
        });
        tableRows.push(new TableRow({ children: cells }));
      });
      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
      }));
      children.push(new Paragraph({ spacing: { after: 200 } }));
    } else if (node.type.name === 'image') {
      const imageData = await getImageData(node.attrs.src);
      if (imageData) {
        children.push(new Paragraph({
          children: [
            new ImageRun({
              data: imageData,
              transformation: {
                width: 600,
                height: 400,
              },
            } as any), // Cast to any to bypass strict type check for now if it continues to fail
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }));
      }
    } else if (node.type.name === 'horizontal_rule') {
      children.push(new Paragraph({
        border: {
          bottom: { color: 'E5E7EB', size: 12, style: BorderStyle.SINGLE, space: 1 },
        },
        spacing: { before: 200, after: 200 },
      }));
    } else if (node.type.name === 'code_block') {
      const lang = (node.attrs.params || "").trim().toLowerCase();
      const umlLangs = ["mermaid", "plantuml", "graphviz", "ditaa", "erd", "blockdiag", "c4plantuml", "structurizr", "vega", "vegalite", "bpmn", "d2", "nomnoml", "rackdiag", "seqdiag", "actdiag", "nwdiag"];
      
      if (umlLangs.includes(lang)) {
        const url = getKrokiUrl(lang, node.textContent);
        const imageData = url ? await getImageData(url) : null;
        if (imageData) {
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: imageData,
                transformation: {
                  width: 600,
                  height: 400,
                },
              } as any),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }));
          return;
        }
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: node.textContent, font: 'Courier New', size: 20 })],
        shading: { fill: 'F3F4F6' },
        indent: { left: 360, right: 360 },
        spacing: { before: 200, after: 200 },
        border: {
          top: { color: 'E5E7EB', size: 6, style: BorderStyle.SINGLE },
          bottom: { color: 'E5E7EB', size: 6, style: BorderStyle.SINGLE },
          left: { color: 'E5E7EB', size: 6, style: BorderStyle.SINGLE },
          right: { color: 'E5E7EB', size: 6, style: BorderStyle.SINGLE },
        }
      }));
    } else if (node.type.name === 'gallery') {
      for (let i = 0; i < node.childCount; i++) {
        await processNode(node.child(i));
      }
    }
  };

  // We need to iterate through top-level nodes manually because processNode is async
  for (let i = 0; i < doc.childCount; i++) {
    await processNode(doc.child(i));
  }

  const docx = new Document({
    numbering: {
      config: [
        {
          reference: 'main-numbering',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT },
            { level: 1, format: LevelFormat.DECIMAL, text: '%2.', alignment: AlignmentType.LEFT },
            { level: 2, format: LevelFormat.DECIMAL, text: '%3.', alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${filename}.docx`);
};

export const exportToHTML = (htmlContent: string, filename: string = 'document') => {
// ...
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
    blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #666; font-style: italic; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { font-family: monospace; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToMarkdown = (markdown: string, filename: string = 'document') => {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToRTF = (doc: any, filename: string = 'document') => {
  const escapeRTF = (text: string) => {
    return text.replace(/[\\}{]/g, "\\$&")
               .replace(/\n/g, "\\line ")
               .replace(/[^\x00-\x7F]/g, (c) => "\\u" + c.charCodeAt(0) + "?");
  };

  let rtfHeader = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}}\n';
  let rtfBody = '\\f0\\fs24 ';

  doc.descendants((node: any) => {
    if (node.type.name === 'paragraph') {
      node.content.forEach((child: any) => {
        if (child.isText) {
          let text = escapeRTF(child.text);
          if (child.marks.some((m: any) => m.type.name === 'strong')) text = `\\b ${text}\\b0 `;
          if (child.marks.some((m: any) => m.type.name === 'em')) text = `\\i ${text}\\i0 `;
          if (child.marks.some((m: any) => m.type.name === 'underline')) text = `\\ul ${text}\\ulnone `;
          rtfBody += text;
        }
      });
      rtfBody += '\\par\n';
      return false;
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level;
      const size = (20 - (level * 2)) * 2; // fs is half-points, Heading 1: 18pt (fs36), Heading 2: 16pt (fs32)...
      rtfBody += `\\b\\fs${size} `;
      node.content.forEach((child: any) => {
        if (child.isText) {
          rtfBody += escapeRTF(child.text);
        }
      });
      rtfBody += `\\b0\\fs24\\par\n`;
      return false;
    } else if (node.type.name === 'horizontal_rule') {
      rtfBody += '\\par\\line __________________________________________________\\line\\par\n';
    } else if (node.type.name === 'blockquote') {
      rtfBody += '{\\i ';
      rtfBody += escapeRTF(node.textContent);
      rtfBody += ' }\\par\n';
      return false;
    }
    return true;
  });

  const fullRTF = rtfHeader + rtfBody + '}';
  const blob = new Blob([fullRTF], { type: 'application/rtf' });
  saveAs(blob, `${filename}.rtf`);
};
