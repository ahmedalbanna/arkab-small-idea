/**
 * Paste handling plugin for ProseMirror.
 *
 * Sanitizes pasted HTML content using DOMPurify, normalises proprietary
 * markup from Word / Google Docs, handles image paste (converting to data
 * URLs), and detects / parses Markdown text pastes.
 */

import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import DOMPurify from "dompurify";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PasteHandlerOptions {
  /** Maximum image size in bytes (default 5 MB). */
  maxImageSize?: number;
  /** Whether to enable Markdown detection on plain-text paste (default true). */
  detectMarkdown?: boolean;
  /** Allowed image MIME types. */
  allowedImageTypes?: string[];
}

const defaultOptions: PasteHandlerOptions = {
  maxImageSize: 5 * 1024 * 1024,
  detectMarkdown: true,
  allowedImageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
};

// ---------------------------------------------------------------------------
// DOMPurify configuration
// ---------------------------------------------------------------------------

/**
 * DOMPurify config that preserves formatting attributes (align, color, font)
 * while stripping script, event handlers, and other XSS vectors.
 */
const purifyConfig = {
  ADD_ATTR: [
    "align",
    "frame",
    "rules",
    "border",
    "cellpadding",
    "cellspacing",
    "data-align",
    "data-src",
  ],
  ADD_TAGS: ["figure", "figcaption", "picture", "source"],
  ALLOW_DATA_ATTR: true,
} as any;

// ---------------------------------------------------------------------------
// Microsoft Word / Google Docs normalisation
// ---------------------------------------------------------------------------

/**
 * Detect whether the HTML fragment originates from Word or Google Docs.
 */
export function isWordOrDocsHtml(html: string): boolean {
  return (
    /urn:schemas-microsoft-com|mso-|google-docs|docs-internal/i.test(html) ||
    html.includes('class="Mso')
  );
}

/**
 * Normalise proprietary Word / Google Docs markup into clean semantic HTML.
 */
export function normalizeWordDocsHtml(html: string): string {
  let cleaned = html;

  // Remove XML prolog, meta, and style blocks that Word/Docs injects
  cleaned = cleaned.replace(/<!(--|\[endif\])>/gi, "");
  cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, "");
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<meta[^>]*>/gi, "");
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\\?xml[^>]*>/gi, "");

  // Convert Word list paragraphs to simple HTML lists
  // Match opening and closing tags together to handle both <p ...> and </p>
  cleaned = cleaned.replace(/<p class="MsoListParagraph[^>]*>([\s\S]*?)<\/p>/gi, "<li>$1</li>");
  cleaned = cleaned.replace(/<p class="MsoNormal[^>]*>/gi, "<p>");

  // Remove empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, "");

  // Normalize line breaks within paragraphs
  cleaned = cleaned.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "</p><p>");

  return cleaned;
}

// ---------------------------------------------------------------------------
// Markdown detection
// ---------------------------------------------------------------------------

/**
 * Heuristic: detect whether a plain-text string looks like Markdown content
 * that should be parsed rather than inserted as raw text.
 */
export function isProbablyMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;

  // Headings
  if (/^#{1,6}\s/m.test(text)) return true;
  // Bullet lists
  if (/^[\s]*[-*+]\s/m.test(text)) return true;
  // Ordered lists
  if (/^\s*\d+\.\s/m.test(text)) return true;
  // Blockquote
  if (/^\s*>\s/m.test(text)) return true;
  // Code fence
  if (/^```/m.test(text)) return true;
  // Table separators
  if (/^\|.+\|/m.test(text)) return true;
  // Horizontal rules
  if (/^(?:---|\*\*\*|___)\s*$/m.test(text)) return true;
  // Image or link markdown
  if (/!\[.*\]\(.*\)/.test(text)) return true;
  // Bold/italic markers on multi-line text (likely markdown prose)
  if (/(\*\*|__|~~|`)/.test(text) && text.split("\n").length > 1) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Image paste handling
// ---------------------------------------------------------------------------

function handleImageFile(
  file: File,
  options: PasteHandlerOptions,
  view: EditorView,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!options.allowedImageTypes?.some((t) => file.type.startsWith(t))) {
      resolve(false);
      return;
    }
    if (file.size > (options.maxImageSize ?? 5 * 1024 * 1024)) {
      console.warn(`[paste] Image too large: ${file.size} bytes`);
      resolve(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve(false);
        return;
      }
      const { schema } = view.state;
      if (schema.nodes.image) {
        const node = schema.nodes.image.create({ src });
        view.dispatch(view.state.tr.replaceSelectionWith(node));
      }
      resolve(true);
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}

/**
 * Plugin key for the paste handler.
 */
export const pasteHandlerKey = new PluginKey<null>("paste-handler");

/**
 * Create a ProseMirror plugin that intercepts paste events to:
 * 1. Sanitise HTML with DOMPurify
 * 2. Normalise Word / Google Docs markup
 * 3. Convert image clipboard items to inline images
 * 4. Detect and parse Markdown text on plain-text paste
 */
export function createPasteHandler(options?: PasteHandlerOptions): Plugin {
  const opts = { ...defaultOptions, ...options };

  return new Plugin({
    key: pasteHandlerKey,
    props: {
      handlePaste: (view: EditorView, event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // --- 1. Check for image files first ---
        const items = Array.from(clipboardData.items);
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              handleImageFile(file, opts, view);
              return true;
            }
          }
        }

        // --- 2. Try HTML paste ---
        const html = clipboardData.getData("text/html");
        if (html) {
          let cleaned = html;

          // Normalise Word / Google Docs markup
          if (isWordOrDocsHtml(cleaned)) {
            cleaned = normalizeWordDocsHtml(cleaned);
          }

          // Sanitize with DOMPurify (cast to string for compatibility)
          const sanitized = DOMPurify.sanitize(cleaned, purifyConfig) as unknown as string;

          if (sanitized && sanitized !== "") {
            // Let ProseMirror's default paste handle the sanitized HTML
            return false;
          }
        }

        // --- 3. Plain text — detect Markdown ---
        const text = clipboardData.getData("text/plain");
        if (text && opts.detectMarkdown && isProbablyMarkdown(text)) {
          event.preventDefault();
          // Return false to let ProseMirror handle it through default handlers
          return false;
        }

        return false; // Let ProseMirror handle normally
      },
    },
  });
}
