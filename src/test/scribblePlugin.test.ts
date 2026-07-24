import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scribblePlugin } from "../plugins/scribble";
import { buildEditorSchema } from "../plugins/editor/schema";
import { buildMarkdownParser, editorSerializer } from "../core/serialization/markdown";
import { createPluginTestBench } from "../plugins/devtools/pluginDevHelper";
import type { PluginTestBench } from "../plugins/devtools/pluginDevHelper";
import type { SchemaContribution } from "../plugins/types";

describe("Scribble Plugin", () => {
  // ---------------------------------------------------------------------------
  // Schema contribution
  // ---------------------------------------------------------------------------

  describe("getSchemaContribution", () => {
    it("returns a scribble node spec with correct attributes", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      expect(contribution).toBeDefined();
      expect(contribution.nodes).toBeDefined();
      expect(contribution.nodes!.scribble).toBeDefined();

      const spec = contribution.nodes!.scribble;
      expect(spec.group).toBe("block");
      expect(spec.draggable).toBe(true);
      expect(spec.selectable).toBe(true);
      expect(spec.attrs).toBeDefined();
      expect(spec.attrs!.data).toEqual({ default: null });
      expect(spec.attrs!.width).toEqual({ default: "100%" });
      expect(spec.attrs!.aspectRatio).toEqual({ default: 0.5 });
      expect(spec.attrs!.strokes).toEqual({ default: [] });
    });

    it("produces a valid parseDOM rule", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const parseRules = contribution.nodes!.scribble.parseDOM as any[];
      expect(parseRules).toHaveLength(1);
      expect(parseRules[0].tag).toBe("div.scribble-block");
    });
  });

  // ---------------------------------------------------------------------------
  // Schema integration — node is available in the final built schema
  // ---------------------------------------------------------------------------

  describe("schema integration", () => {
    it("scribble node exists in the schema built with contributions", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      expect(schema.nodes.scribble).toBeTruthy();
    });

    it("scribble node has the correct attrs in the built schema", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      const spec = schema.nodes.scribble.spec;
      expect(spec.attrs).toHaveProperty("data");
      expect(spec.attrs).toHaveProperty("width");
      expect(spec.attrs).toHaveProperty("aspectRatio");
      expect(spec.attrs).toHaveProperty("strokes");
    });

    it("scribble node is a block-level node", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      expect(schema.nodes.scribble.spec.group).toBe("block");
    });
  });

  // ---------------------------------------------------------------------------
  // Plugin registration — commands, toolbar items, node views
  // ---------------------------------------------------------------------------

  describe("plugin registration", () => {
    let bench: PluginTestBench;

    beforeEach(() => {
      bench = createPluginTestBench();
    });

    afterEach(() => {
      bench.destroy();
    });

    it("registers the scribble node view", async () => {
      const ctx = bench.createPluginContext();
      await bench.loadPlugin(scribblePlugin, ctx);
      const { nodeViews } = bench.getContributions();

      expect(nodeViews).toHaveLength(1);
      expect(nodeViews[0].name).toBe("scribble");
    });

    it("registers the scribble.insert command with slash menu enabled", async () => {
      const ctx = bench.createPluginContext();
      await bench.loadPlugin(scribblePlugin, ctx);
      const { commands } = bench.getContributions();

      const insertCmd = commands.find((c) => c.id === "scribble.insert");
      expect(insertCmd).toBeDefined();
      expect(insertCmd!.slash).toBe(true);
      expect(insertCmd!.label).toBe("Insert Scribble");
    });

    it("registers a scribble toolbar item", async () => {
      const ctx = bench.createPluginContext();
      await bench.loadPlugin(scribblePlugin, ctx);
      const { toolbarItems } = bench.getContributions();

      const tbi = toolbarItems.find((t) => t.id === "scribble");
      expect(tbi).toBeDefined();
      expect(tbi!.label).toBe("Scribble");
      expect(tbi!.group).toBe("insert");
      expect(typeof tbi!.onClick).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // Markdown round-trip
  // ---------------------------------------------------------------------------

  describe("markdown serialization", () => {
    it("scribble nodes are serialized to a scribble fenced code block", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      const scribbleNode = schema.nodes.scribble.create({
        data: null,
        width: "100%",
        aspectRatio: 0.5,
        strokes: [],
      });
      const doc = schema.nodes.doc.create({}, [scribbleNode]);
      const md = editorSerializer.serialize(doc);

      expect(md).toContain("```scribble");
      expect(md).toContain("aspect: 0.5");
      expect(md).not.toContain("strokes:");
      expect(md).not.toContain("data:image");
      expect(md).toContain("```");
    });

    it("scribble nodes with drawing data serialize the data URL", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      const scribbleNode = schema.nodes.scribble.create({
        data: "data:image/png;base64,iVBORw0KGgo=",
        width: "100%",
        aspectRatio: 0.5,
        strokes: [],
      });
      const doc = schema.nodes.doc.create({}, [scribbleNode]);
      const md = editorSerializer.serialize(doc);

      expect(md).toContain("data:image/png;base64,iVBORw0KGgo=");
    });

    it("scribble nodes with strokes serialize the strokes JSON", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const schema = buildEditorSchema(contribution);
      const scribbleNode = schema.nodes.scribble.create({
        data: null,
        width: "100%",
        aspectRatio: 0.5,
        strokes: [
          {
            id: "s1",
            color: "#000",
            width: 3,
            mode: "draw" as const,
            points: [
              [10, 20],
              [30, 40],
            ],
          },
        ],
      });
      const doc = schema.nodes.doc.create({}, [scribbleNode]);
      const md = editorSerializer.serialize(doc);

      expect(md).toContain("```scribble");
      expect(md).toContain("aspect: 0.5");
      expect(md).toContain("strokes:");
      expect(md).toContain('"s1"');
      expect(md).toContain("```");
    });

    // Round-trip parsing of scribble from markdown requires a custom tokenizer
    // extension or post-process transform (similar to diagramTransform). The
    // serializer already handles scribble → ```scribble output correctly.
  });

  // ---------------------------------------------------------------------------
  // Plugin lifecycle — destroy is idempotent
  // ---------------------------------------------------------------------------

  describe("lifecycle", () => {
    it("init() succeeds without throwing", async () => {
      const bench = createPluginTestBench();
      const ctx = bench.createPluginContext();
      await expect(bench.loadPlugin(scribblePlugin, ctx)).resolves.toBeUndefined();
      bench.destroy();
    });

    it("destroy() is idempotent — calling it twice does not throw", () => {
      // The plugin itself doesn't have a destroy method, but the InkPlugin
      // interface requires it to be safe. This verifies that.
      expect(() => scribblePlugin.destroy?.()).not.toThrow();
      expect(() => scribblePlugin.destroy?.()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Content attribute schema test
  // ---------------------------------------------------------------------------

  describe("content attributes", () => {
    it("the scribble node has draggable and selectable set", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      const spec = contribution.nodes!.scribble;
      expect(spec.draggable).toBe(true);
      expect(spec.selectable).toBe(true);
    });

    it("the scribble node has isolating set", async () => {
      const contribution = (await scribblePlugin.getSchemaContribution?.()) as SchemaContribution;
      expect(contribution.nodes!.scribble.isolating).toBe(true);
    });
  });
});
