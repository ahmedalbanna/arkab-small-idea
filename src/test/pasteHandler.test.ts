// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isProbablyMarkdown,
  isWordOrDocsHtml,
  normalizeWordDocsHtml,
} from "../plugins/editor/pasteHandler";

describe("pasteHandler", () => {
  describe("isProbablyMarkdown", () => {
    it("detects headings", () => {
      expect(isProbablyMarkdown("# Heading")).toBe(true);
      expect(isProbablyMarkdown("## Subheading")).toBe(true);
    });

    it("detects bullet lists", () => {
      expect(isProbablyMarkdown("- item")).toBe(true);
      expect(isProbablyMarkdown("* item")).toBe(true);
      expect(isProbablyMarkdown("+ item")).toBe(true);
    });

    it("detects ordered lists", () => {
      expect(isProbablyMarkdown("1. first")).toBe(true);
    });

    it("detects blockquotes", () => {
      expect(isProbablyMarkdown("> quote")).toBe(true);
    });

    it("detects code fences", () => {
      expect(isProbablyMarkdown("```\ncode\n```")).toBe(true);
    });

    it("detects tables", () => {
      expect(isProbablyMarkdown("| a | b |")).toBe(true);
    });

    it("detects horizontal rules", () => {
      expect(isProbablyMarkdown("---")).toBe(true);
      expect(isProbablyMarkdown("***")).toBe(true);
      expect(isProbablyMarkdown("___")).toBe(true);
    });

    it("detects images", () => {
      expect(isProbablyMarkdown("![alt](url)")).toBe(true);
    });

    it("detects multi-line bold/italic markdown", () => {
      expect(isProbablyMarkdown("**bold** text\n\nmore text")).toBe(true);
    });

    it("returns false for plain text", () => {
      expect(isProbablyMarkdown("Hello, this is plain text.")).toBe(false);
    });

    it("returns false for short strings", () => {
      expect(isProbablyMarkdown("ab")).toBe(false);
    });

    it("returns false for empty strings", () => {
      expect(isProbablyMarkdown("")).toBe(false);
    });
  });

  describe("isWordOrDocsHtml", () => {
    it("detects Word HTML by Mso class", () => {
      const html = '<p class="MsoNormal">Text</p>';
      expect(isWordOrDocsHtml(html)).toBe(true);
    });

    it("detects Google Docs HTML", () => {
      const html = '<p id="docs-internal-guid-...">Text</p>';
      expect(isWordOrDocsHtml(html)).toBe(true);
    });

    it("detects mso- style attributes", () => {
      const html = '<p style="mso-line-height-alt: 1;">Text</p>';
      expect(isWordOrDocsHtml(html)).toBe(true);
    });

    it("returns false for clean HTML", () => {
      const html = "<p>Clean HTML</p><ul><li>Item</li></ul>";
      expect(isWordOrDocsHtml(html)).toBe(false);
    });
  });

  describe("normalizeWordDocsHtml", () => {
    it("removes XML prolog", () => {
      const input = '<?xml version="1.0"?><p>Text</p>';
      expect(normalizeWordDocsHtml(input)).not.toContain("<?xml");
    });

    it("removes style tags", () => {
      const input = "<style>p { color: red; }</style><p>Text</p>";
      expect(normalizeWordDocsHtml(input)).not.toContain("<style>");
    });

    it("converts MsoListParagraph to <li>", () => {
      const input = '<p class="MsoListParagraph">Item</p>';
      expect(normalizeWordDocsHtml(input)).toContain("<li>Item</li>");
    });

    it("removes empty paragraphs", () => {
      const input = "<p>Text</p><p>  </p><p>More</p>";
      const result = normalizeWordDocsHtml(input);
      expect(result).not.toContain("<p></p>");
      expect(result).not.toContain("<p>  </p>");
    });

    it("converts double <br> to paragraph break", () => {
      const input = "<p>Line1<br><br>Line2</p>";
      const result = normalizeWordDocsHtml(input);
      expect(result).toContain("</p><p>");
    });
  });

  describe("createPasteHandler plugin", () => {
    it("exports a plugin factory", async () => {
      const mod = await import("../plugins/editor/pasteHandler");
      const plugin = mod.createPasteHandler();
      // Plugin should have props with handlePaste
      expect(plugin.props).toBeDefined();
      expect(typeof plugin.props.handlePaste).toBe("function");
    });

    it("accepts custom options", async () => {
      const mod = await import("../plugins/editor/pasteHandler");
      const plugin = mod.createPasteHandler({ maxImageSize: 1024, detectMarkdown: false });
      expect(plugin).toBeDefined();
    });
  });
});
