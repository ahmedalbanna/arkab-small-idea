/**
 * DOCX export — uses the docx library to convert editor state to Word format.
 * Supports images, tables, diagrams, headings, lists, and more.
 */
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
  LevelFormat,
} from "docx";
import { saveAs } from "file-saver";
import { renderDiagram, isDiagramLang } from "../lib/diagrams/engine";
import { resolveTheme } from "../lib/diagrams/theme";
import { getImageData, svgToPng, getImageDimensions, noopProgress } from "./exportUtils";
import type { ExportProgressCallback } from "./exportUtils";

export interface DocxExportOptions {
  filename?: string;
  maxImageWidth?: number;
}

const DEFAULT_OPTIONS: Required<DocxExportOptions> = {
  filename: "document",
  maxImageWidth: 600,
};

/**
 * Export a ProseMirror document (node) to a .docx file.
 */
export async function exportToDOCX(
  doc: any,
  filename: string = "document",
  onProgress: ExportProgressCallback = noopProgress,
  options: DocxExportOptions = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, filename, ...options };
  const children: any[] = [];

  onProgress({ stage: "preparing", percent: 5, message: "Preparing DOCX…" });

  /** Creates a plain code-styled paragraph with shading and border. */
  const plainCodeParagraph = (text: string): Paragraph =>
    new Paragraph({
      children: [new TextRun({ text, font: "Courier New", size: 20 })],
      shading: { fill: "F3F4F6" },
      indent: { left: 360, right: 360 },
      spacing: { before: 200, after: 200 },
      border: {
        top: { color: "E5E7EB", size: 6, style: BorderStyle.SINGLE },
        bottom: { color: "E5E7EB", size: 6, style: BorderStyle.SINGLE },
        left: { color: "E5E7EB", size: 6, style: BorderStyle.SINGLE },
        right: { color: "E5E7EB", size: 6, style: BorderStyle.SINGLE },
      },
    });

  /** Renders a diagram as an embedded PNG image. */
  const embedDiagram = async (lang: string, source: string): Promise<boolean> => {
    if (!source.trim()) return false;
    const theme = resolveTheme(
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("data-theme")
        : "light",
    );
    const result = await renderDiagram(lang, source, { theme });
    if (!result.ok) return false;
    const png = await svgToPng(result.svg, opts.maxImageWidth);
    if (!png) return false;

    // Determine dynamic dimensions from rendered image
    let imgWidth = opts.maxImageWidth;
    let imgHeight = Math.round(imgWidth * 0.667); // default 2:3 fallback

    // Create a temporary Image to measure the PNG dimensions
    if (typeof document !== "undefined") {
      const blob = new Blob([png], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      try {
        const dims = await getImageDimensions(url);
        if (dims) {
          imgWidth = Math.min(opts.maxImageWidth, dims.width);
          imgHeight = Math.round(imgWidth / dims.aspectRatio);
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: png,
            transformation: { width: imgWidth, height: imgHeight },
          } as any),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      }),
    );
    return true;
  };

  /** Convert inline text marks to docx TextRun / ExternalHyperlink. */
  const processTextRuns = (node: any): (TextRun | ExternalHyperlink)[] => {
    const runs: (TextRun | ExternalHyperlink)[] = [];
    node.content?.forEach((child: any) => {
      if (child.isText) {
        const linkMark = child.marks?.find((m: any) => m.type.name === "link");
        const run = new TextRun({
          text: child.text,
          bold: child.marks?.some((m: any) => m.type.name === "strong"),
          italics: child.marks?.some((m: any) => m.type.name === "em"),
          underline: child.marks?.some((m: any) => m.type.name === "underline") ? {} : undefined,
          strike: child.marks?.some((m: any) => m.type.name === "strike"),
          font: "Inter",
          size: 24, // 12pt in half-points
          color: child.marks?.some((m: any) => m.type.name === "code") ? "C7254E" : undefined,
          shading: child.marks?.some((m: any) => m.type.name === "code")
            ? { fill: "F9F2F4", color: "C7254E" }
            : undefined,
        });
        if (linkMark) {
          runs.push(
            new ExternalHyperlink({
              children: [run],
              link: linkMark.attrs.href,
            }),
          );
        } else {
          runs.push(run);
        }
      }
    });
    return runs;
  };

  /** Process a single ProseMirror node, adding docx elements to `children`. */
  const processNode = async (
    node: any,
    ctx: { listLevel?: number; listType?: "bullet" | "ordered" } = {},
  ) => {
    const nAttrs = node.attrs || {};
    const nType = node.type;

    if (nType.name === "paragraph") {
      children.push(
        new Paragraph({
          children: processTextRuns(node),
          spacing: { after: 200 },
          bullet: ctx.listType === "bullet" ? { level: ctx.listLevel ?? 0 } : undefined,
          numbering:
            ctx.listType === "ordered"
              ? {
                  reference: "main-numbering",
                  level: ctx.listLevel ?? 0,
                }
              : undefined,
        }),
      );
    } else if (nType.name === "heading") {
      const level = nAttrs.level || 1;
      const headingMap: Record<number, any> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      children.push(
        new Paragraph({
          children: processTextRuns(node),
          heading: headingMap[level] || HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    } else if (nType.name === "blockquote") {
      children.push(
        new Paragraph({
          children: processTextRuns(node),
          indent: { left: 720 },
          border: {
            left: {
              color: "E5E7EB",
              size: 24,
              style: BorderStyle.SINGLE,
              space: 10,
            },
          },
          spacing: { before: 200, after: 200 },
        }),
      );
    } else if (nType.name === "bullet_list" || nType.name === "ordered_list") {
      const listType = nType.name === "bullet_list" ? "bullet" : "ordered";
      const listLevel = ctx.listLevel !== undefined ? ctx.listLevel + 1 : 0;
      for (let i = 0; i < node.childCount; i++) {
        const item = node.child(i);
        for (let j = 0; j < item.childCount; j++) {
          await processNode(item.child(j), { listLevel, listType });
        }
      }
    } else if (nType.name === "table") {
      const tableRows: TableRow[] = [];
      node.forEach((row: any) => {
        const cells: TableCell[] = [];
        row.forEach((cell: any) => {
          const cellParagraphs: Paragraph[] = [];
          cell.forEach((p: any) => {
            cellParagraphs.push(
              new Paragraph({
                children: processTextRuns(p),
                spacing: { after: 0 },
              }),
            );
          });
          const isHeader = cell.type.name === "table_header";
          cells.push(
            new TableCell({
              children: cellParagraphs,
              verticalAlign: VerticalAlign.CENTER,
              shading: isHeader ? { fill: "F3F4F6" } : undefined,
              // Proper visible borders — thicker (size: 4 = 0.5pt) with visible color
              borders: {
                top: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: "CCCCCC",
                },
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: "CCCCCC",
                },
                left: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: "CCCCCC",
                },
                right: {
                  style: BorderStyle.SINGLE,
                  size: 4,
                  color: "CCCCCC",
                },
              },
            }),
          );
        });
        tableRows.push(new TableRow({ children: cells }));
      });
      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        }),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
    } else if (nType.name === "image") {
      const src = nAttrs.src;
      if (src) {
        const imageData = await getImageData(src);
        if (imageData) {
          // Dynamically determine image dimensions
          let imgWidth = opts.maxImageWidth;
          let imgHeight = Math.round(imgWidth * 0.667);
          const dims = await getImageDimensions(src);
          if (dims) {
            imgWidth = Math.min(opts.maxImageWidth, dims.width);
            imgHeight = Math.round(imgWidth / dims.aspectRatio);
          }
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageData,
                  transformation: { width: imgWidth, height: imgHeight },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            }),
          );
        }
      }
    } else if (nType.name === "horizontal_rule") {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: "E5E7EB",
              size: 12,
              style: BorderStyle.SINGLE,
              space: 1,
            },
          },
          spacing: { before: 200, after: 200 },
        }),
      );
    } else if (nType.name === "diagram") {
      const lang = (nAttrs.lang || "").trim().toLowerCase();
      const source = nAttrs.source || "";
      const embedded = await embedDiagram(lang, source);
      if (!embedded) {
        children.push(plainCodeParagraph(source));
      }
    } else if (nType.name === "code_block") {
      const lang = (nAttrs.params || "").trim().toLowerCase();
      if (isDiagramLang(lang)) {
        const embedded = await embedDiagram(lang, node.textContent);
        if (embedded) return;
      }
      children.push(plainCodeParagraph(node.textContent));
    } else if (nType.name === "gallery") {
      for (let i = 0; i < node.childCount; i++) {
        await processNode(node.child(i));
      }
    }
  };

  // Iterate top-level nodes
  const total = doc.childCount || 1;
  for (let i = 0; i < doc.childCount; i++) {
    await processNode(doc.child(i));
    const pct = Math.round(5 + ((i + 1) / total) * 60);
    onProgress({ stage: "rendering", percent: pct });
  }

  onProgress({ stage: "packaging", percent: 70, message: "Building .docx…" });

  const wordDoc = new Document({
    numbering: {
      config: [
        {
          reference: "main-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%2.",
              alignment: AlignmentType.LEFT,
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: "%3.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  onProgress({ stage: "packaging", percent: 85, message: "Compressing DOCX…" });

  const blob = await Packer.toBlob(wordDoc);

  onProgress({
    stage: "downloading",
    percent: 95,
    message: "Downloading…",
  });
  saveAs(blob, `${opts.filename}.docx`);

  onProgress({ stage: "downloading", percent: 100, message: "Done" });
}
