import { describe, expect, it } from "vitest";
import {
  getDefaultTemplates,
  getTemplate,
  buildSystemPrompt,
  buildUserPrompt,
  getCursorSection,
  type TemplateOverrides,
} from "../services/promptTemplates";

describe("promptTemplates", () => {
  describe("getDefaultTemplates", () => {
    it("returns all 11 templates", () => {
      const templates = getDefaultTemplates();
      expect(templates).toHaveLength(11);
    });

    it("includes all AI action types", () => {
      const templates = getDefaultTemplates();
      const ids = templates.map((t) => t.id);
      expect(ids).toContain("improve");
      expect(ids).toContain("fix-grammar");
      expect(ids).toContain("shorten");
      expect(ids).toContain("expand");
      expect(ids).toContain("summarize");
      expect(ids).toContain("generate-outline");
      expect(ids).toContain("expand-outline");
      expect(ids).toContain("draft-topic");
      expect(ids).toContain("rewrite");
      expect(ids).toContain("suggest-title");
      expect(ids).toContain("complete-text");
    });

    it("returns deep copies (mutations don't affect originals)", () => {
      const templates = getDefaultTemplates();
      templates[0].systemPrompt = "MUTATED";
      const templates2 = getDefaultTemplates();
      expect(templates2[0].systemPrompt).not.toBe("MUTATED");
    });
  });

  describe("getTemplate", () => {
    it("returns the default template when no overrides", () => {
      const tpl = getTemplate("improve");
      expect(tpl).toBeDefined();
      expect(tpl?.id).toBe("improve");
      expect(tpl?.enabled).toBe(true);
    });

    it("returns undefined for unknown action", () => {
      const tpl = getTemplate("unknown-action");
      expect(tpl).toBeUndefined();
    });

    it("applies user overrides on top of defaults", () => {
      const overrides: TemplateOverrides = {
        improve: {
          systemPrompt: "CUSTOM SYSTEM PROMPT",
          userPrompt: "CUSTOM USER PROMPT",
        },
      };
      const tpl = getTemplate("improve", overrides);
      expect(tpl?.systemPrompt).toBe("CUSTOM SYSTEM PROMPT");
      expect(tpl?.userPrompt).toBe("CUSTOM USER PROMPT");
      // Non-overridden fields stay from default
      expect(tpl?.label).toBe("Improve Writing");
      expect(tpl?.enabled).toBe(true);
    });

    it("returns undefined for unknown action even with overrides", () => {
      const overrides: TemplateOverrides = { unknown: { systemPrompt: "test" } };
      const tpl = getTemplate("unknown", overrides);
      expect(tpl).toBeUndefined();
    });
  });

  describe("buildSystemPrompt", () => {
    it("builds a system prompt with placeholders filled", () => {
      const result = buildSystemPrompt("improve", {
        text: "Hello world",
        personalInstructions: "Be formal",
      });
      expect(result).toContain("Be formal");
      expect(result).toContain("Improve the quality");
    });

    it("returns empty string for disabled template", () => {
      const overrides: TemplateOverrides = {
        improve: { enabled: false },
      };
      const result = buildSystemPrompt("improve", { text: "test" }, overrides);
      expect(result).toBe("");
    });

    it("includes document structure when documentContext is large enough", () => {
      const doc =
        "# Heading 1\n\nSome content here that is long enough to pass the threshold check for document structure extraction. This paragraph has enough characters to make the total document exceed the 200 character minimum.\n\n## Heading 2\n\nMore content here as well to ensure we have a sufficiently large document for testing purposes.\n\n## Heading 3\n\nFinal section with some additional text.";
      const result = buildSystemPrompt("improve", { text: "test" }, undefined, doc);
      expect(result).toContain("DOCUMENT STRUCTURE (for orientation only)");
      expect(result).toContain("Heading 1");
      expect(result).toContain("Heading 2");
    });

    it("does not include document structure for short documents", () => {
      const result = buildSystemPrompt("improve", { text: "test" }, undefined, "short");
      expect(result).not.toContain("DOCUMENT STRUCTURE (for orientation only)");
    });

    it("appends custom instruction when not in template", () => {
      const result = buildSystemPrompt("improve", {
        text: "test",
        customInstruction: "Make it fun",
      });
      expect(result).toContain("Make it fun");
    });
  });

  describe("buildUserPrompt", () => {
    it("builds a user prompt with text placeholder filled", () => {
      const result = buildUserPrompt("improve", { text: "Hello world" });
      expect(result).toContain("Hello world");
      expect(result).toContain("Improve ONLY the selected text");
    });

    it("returns raw text for unknown action", () => {
      const result = buildUserPrompt("unknown", { text: "Hello" });
      expect(result).toBe("Hello");
    });

    it("handles generate template with context placeholder", () => {
      const result = buildUserPrompt("generate", { text: "Write about AI" });
      expect(result).toContain("Write about AI");
    });
  });

  describe("getCursorSection", () => {
    it("returns the current section heading", () => {
      const markdown = "# Introduction\n\nSome text\n\n## Methods\n\nMore text";
      // Cursor at position after "Some text"
      const section = getCursorSection(markdown, 20);
      expect(section).toBe("Introduction");
    });

    it("returns updated section when cursor moves past heading", () => {
      const markdown = "# Introduction\n\nSome text\n\n## Methods\n\nMore text";
      // Cursor at position after "## Methods"
      const section = getCursorSection(markdown, 30);
      expect(section).toBe("Methods");
    });

    it("returns default when no headings", () => {
      const markdown = "Just some plain text without headings";
      const section = getCursorSection(markdown, 10);
      expect(section).toBe("Introduction");
    });

    it("returns default when cursor at start", () => {
      const markdown = "# Heading\n\nText";
      const section = getCursorSection(markdown, 0);
      expect(section).toBe("Heading");
    });
  });
});
