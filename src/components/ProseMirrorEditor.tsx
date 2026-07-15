import {
  useEffect,
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import {
  EditorState,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { Schema, DOMParser, DOMSerializer, Slice, Node } from "prosemirror-model";
import { schema as baseSchema } from "prosemirror-markdown";
import { keymap } from "prosemirror-keymap";
import { toggleMark, setBlockType, baseKeymap, wrapIn } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { history, undo, redo } from "prosemirror-history";
import { buildInputRules, buildKeymap } from "./prose-setup";
import { highlightPlugin } from "./prose-highlight";
import { draftHighlightPlugin, draftHighlightKey } from "../lib/draftPlugin";
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownParser,
} from "prosemirror-markdown";
import {
  Bold,
  Italic,
  Link,
  Code,
  Quote,
  Type,
  Underline,
  Strikethrough,
  Sparkles,
  Wand2,
  CheckCheck,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowRight,
  Image as ImageIcon,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  List,
  Minimize2,
  Maximize2,
  Zap,
  Layout,
  FileText,
  RotateCcw,
  Copy,
  Scissors,
  ClipboardPaste,
  MoreVertical,
  Plus,
  GripVertical,
  RefreshCcw,
  Check,
  Square,
  X as XIcon,
  Eraser,
  PenTool,
  Trash2,
  Undo2,
  Redo2,
  Table
} from "lucide-react";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { tableNodes, tableEditing, goToNextCell } from "prosemirror-tables";
import { motion, AnimatePresence } from "motion/react";
import { cn, slugify } from "../lib/utils";
import { processAIAction, type AIAssistantAction } from "../services/aiService";
import { diagramNodeSpec } from "../lib/diagramNode";
import { diagramTransform } from "../lib/markdown/diagramTransform";
import { createDiagramNodeView } from "../lib/diagramNodeView";
import { createHeadingPlugin } from "../lib/headingPlugin";
import { createScribbleNodeView } from "../lib/scribblePlugin";
import { createImageNodeView, createGalleryNodeView } from "../lib/imagePlugin";
import { createSearchPlugin, searchPluginKey } from "../lib/searchPlugin";
import { createCollabPlugin } from "../lib/collabPlugin";
import { createMathPlugin } from "../lib/mathPlugin";
import "katex/dist/katex.min.css";
import { SlashMenu } from "./SlashMenu";
import { ErrorBoundary } from "./ErrorBoundary";
import { useUIStore } from "../stores/uiStore";

// We'll use a slightly customized schema to support more formatting
const editorSchema = new Schema({
  nodes: baseSchema.spec.nodes
    .update("paragraph", {
      content: "inline*",
      group: "block",
      attrs: { align: { default: "left" } },
      parseDOM: [
        {
          tag: "p",
          getAttrs: (dom: any) => ({
            align: dom.style.textAlign || "left",
          }),
        },
      ],
      toDOM(node) {
        const { align } = node.attrs;
        return ["p", { style: align && align !== "left" ? `text-align: ${align}` : null }, 0];
      },
    })
    .update("heading", {
      attrs: { level: { default: 1 }, align: { default: "left" }, id: { default: null } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", getAttrs: (dom: any) => ({ level: 1, align: dom.style.textAlign || "left", id: dom.id || null }) },
        { tag: "h2", getAttrs: (dom: any) => ({ level: 2, align: dom.style.textAlign || "left", id: dom.id || null }) },
        { tag: "h3", getAttrs: (dom: any) => ({ level: 3, align: dom.style.textAlign || "left", id: dom.id || null }) },
        { tag: "h4", getAttrs: (dom: any) => ({ level: 4, align: dom.style.textAlign || "left", id: dom.id || null }) },
        { tag: "h5", getAttrs: (dom: any) => ({ level: 5, align: dom.style.textAlign || "left", id: dom.id || null }) },
        { tag: "h6", getAttrs: (dom: any) => ({ level: 6, align: dom.style.textAlign || "left", id: dom.id || null }) },
      ],
      toDOM(node) {
        const { level, align, id } = node.attrs;
        const autoId = id || (node.textContent ? slugify(node.textContent) : null);
        return ["h" + level, { 
          id: autoId,
          style: align && align !== "left" ? `text-align: ${align}` : null 
        }, 0];
      },
    })
    .append(
      tableNodes({
        tableGroup: "block",
        cellContent: "block+",
        cellAttributes: {
          align: {
            default: "left",
            getFromDOM(dom) {
              return (dom as HTMLElement).style.textAlign || "left";
            },
            setDOMAttr(value, attrs) {
              if (value && value !== "left")
                attrs.style = (attrs.style || "") + `text-align: ${value};`;
            },
          },
          background: {
            default: null,
            getFromDOM(dom) {
              return (dom as HTMLElement).style.backgroundColor || null;
            },
            setDOMAttr(value, attrs) {
              if (value)
                attrs.style = (attrs.style || "") + `background-color: ${value};`;
            },
          },
          sort: {
            default: null,
            getFromDOM(dom) {
              return dom.getAttribute("data-sort") || null;
            },
            setDOMAttr(value, attrs) {
              if (value) attrs["data-sort"] = value;
            },
          },
        },
      }),
    )
    .update("image", {
      inline: true,
      group: "inline",
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        align: { default: "center" },
        width: { default: "100%" },
        float: { default: "none" },
      },
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs(dom: any) {
            return {
              src: dom.getAttribute("src"),
              title: dom.getAttribute("title"),
              alt: dom.getAttribute("alt"),
              align: dom.getAttribute("data-align") || "center",
              width: dom.style.width || "100%",
              float: dom.style.float || "none",
            };
          },
        },
      ],
      toDOM(node) {
        let { src, alt, title, align, width, float } = node.attrs;
        return [
          "img",
          {
            src,
            alt,
            title,
            "data-align": align,
            style: `width: ${width}; float: ${float};`,
          },
        ];
      },
    })
    .append({
      gallery: {
        group: "block",
        content: "image*",
        attrs: {
          layout: { default: "grid" },
        },
        parseDOM: [
          {
            tag: "div.image-gallery",
            getAttrs: (dom: any) => ({
              layout: dom.getAttribute("data-layout") || "grid",
            }),
          },
        ],
        toDOM(node) {
          return [
            "div",
            { class: "image-gallery", "data-layout": node.attrs.layout },
            0,
          ];
        },
      },
      scribble: {
        group: "block",
        attrs: {
          data: { default: null },
          width: { default: "100%" },
          aspectRatio: { default: 0.5 },
        },
        draggable: true,
        selectable: true,
        parseDOM: [
          {
            tag: "div.scribble-block",
            getAttrs: (dom: any) => ({
              data: dom.getAttribute("data-scribble"),
              width: dom.style.width || "100%",
              aspectRatio: parseFloat(dom.getAttribute("data-aspect") || "0.5"),
            }),
          },
        ],
        toDOM(node) {
          return [
            "div",
            {
              class: "scribble-block",
              "data-scribble": node.attrs.data,
              "data-aspect": node.attrs.aspectRatio,
              style: `width: ${node.attrs.width}; position: relative;`,
            },
          ];
        },
      },
      diagram: diagramNodeSpec,
    }),
  marks: baseSchema.spec.marks.append({
    strike: {
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        { style: "text-decoration=line-through" },
      ],
      toDOM() {
        return ["s", 0];
      },
    },
    underline: {
      parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
      toDOM() {
        return ["u", 0];
      },
    },
  }),
});

// Custom serializer to handle our new marks and tables
const editorSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    paragraph: (state, node) => {
      if (node.attrs.align && node.attrs.align !== "left") {
        state.write(`<p style="text-align: ${node.attrs.align}">`);
        state.renderInline(node);
        state.write("</p>\n\n");
      } else {
        state.renderInline(node);
        state.closeBlock(node);
      }
    },
    heading: (state, node) => {
      if (node.attrs.align && node.attrs.align !== "left") {
        state.write(`<h${node.attrs.level} style="text-align: ${node.attrs.align}">`);
        state.renderInline(node);
        state.write(`</h${node.attrs.level}>\n\n`);
      } else {
        state.write(state.repeat("#", node.attrs.level) + " ");
        state.renderInline(node);
        state.closeBlock(node);
      }
    },
    table: (state, node) => {
      state.write("\n");
      state.renderContent(node);
      state.write("\n");
    },
    table_row: (state, node) => {
      state.write("| ");
      node.forEach((cell, _, i) => {
        if (i > 0) state.write(" | ");
        state.renderContent(cell);
      });
      state.write(" |\n");
      
      // Write separator if this is the first row
      if (node.childCount > 0 && node.child(0).type.name === "table_header") {
        state.write("|");
        node.forEach((cell) => {
          const align = cell.attrs.align || "left";
          if (align === "center") state.write(" :---: |");
          else if (align === "right") state.write(" ---: |");
          else state.write(" --- |");
        });
        state.write("\n");
      }
    },
    table_cell: (state, node) => {
      state.renderContent(node);
    },
    table_header: (state, node) => {
      state.renderContent(node);
    },
    gallery: (state, node) => {
      state.write("\n");
      state.renderContent(node);
      state.write("\n");
    },
    scribble: (state, node) => {
      state.write("\n```scribble\n");
      state.write(`aspect: ${node.attrs.aspectRatio}\n`);
      if (node.attrs.data) {
        state.write(`${node.attrs.data}\n`);
      }
      state.write("```\n");
    },
    diagram: (state, node) => {
      state.write("```" + (node.attrs.lang || "") + "\n");
      state.text(node.attrs.source || "", false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strike: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    underline: { open: "<u>", close: "</u>", mixable: true },
  },
);

const tableTokens = {
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: { block: "table_header" },
  td: { block: "table_cell" },
};

const tokenizer = (defaultMarkdownParser as any).tokenizer;
if (tokenizer && tokenizer.enable) {
  tokenizer.enable("table");
}

  const editorParser = new MarkdownParser(editorSchema, tokenizer, {
    ...((defaultMarkdownParser as any).tokens || {}),
    s: { mark: "strike" },
    strike: { mark: "strike" },
    u: { mark: "underline" },
    scribble: { 
      block: "scribble", 
      getAttrs: (tok: any) => {
        const lines = tok.content.split('\n');
        const aspectLine = lines.find((l: string) => l.startsWith('aspect:'));
        const data = lines.find((l: string) => l.startsWith('data:image'));
        return { 
          data: data || null, 
          aspectRatio: aspectLine ? parseFloat(aspectLine.split(':')[1]) : 0.5 
        };
      } 
    },
    ...tableTokens,
  });

  /**
   * Parses markdown into a document and converts any fenced diagram code
   * blocks into `diagram` nodes so they render via the diagram NodeView.
   * Used for initial load, paste, AI streaming, and all markdown insertion.
   */
  const parseMarkdownDoc = (md: string): Node => {
    const parsed = editorParser.parse(md);
    const doc = parsed ?? editorSchema.nodes.doc.createAndFill()!;
    return diagramTransform(doc);
  };

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  className?: string;
  placeholder?: string;
  isTypewriter?: boolean;
  isFocusMode?: boolean;
  fontSize?: number;
  lineHeight?: number;
  onToggleFocusMode?: () => void;
  direction?: "ltr" | "rtl";
  personalInstructions?: string;
  selectedModel?: string;
  provider?: string;
  apiKeys?: any;
  providerConfigs?: any;
  onAiResult?: (result: string) => void;
  onAiStream?: (chunk: string, isNew?: boolean) => void;
  onImageUploadRequest?: () => void;
  onSearchMetadata?: (count: number, current: number) => void;
  onSelectionChange?: (selection: { from: number; to: number }) => void;
  onScroll?: () => void;
  initialCursor?: { from: number; to: number };
  searchQuery?: string;
  searchOptions?: {
    isCaseSensitive: boolean;
    isWholeWord: boolean;
    isSemantic: boolean;
    searchIndex: number;
    currentMatchIndex: number;
    embeddingOptions?: { provider?: string; apiKey?: string; model?: string };
  };
  collab?: {
    enabled: boolean;
    docId: string;
    username?: string;
  };
}

export interface EditorRef {
  focus: () => void;
  insertText: (before: string, after?: string) => void;
  insertImage: (src: string, alt?: string, title?: string) => void;
  insertGallery: (srcs: string[]) => void;
  appendMarkdown: (markdown: string) => void;
  replaceSelectionWithMarkdown: (markdown: string) => void;
  getSelectedText: () => string;
  getHtml: () => string;
  getDoc: () => any;
  getTextWithPositions: () => { text: string; pos: number }[];
  getHeadings: () => { text: string; level: number; pos: number; id: string }[];
  setTTSHighlight: (range: { from: number; to: number } | null) => void;
  handleFormat: (type: string) => void;
  getCursorContext: () => string;
  scrollToText: (text: string) => void;
  scrollToPos: (pos: number) => void;
  streamMarkdown: (content: string, isNew?: boolean) => void;
  setMarkdown: (content: string) => void;
}

const linkPreviewPlugin = new Plugin({
  props: {
    handleDOMEvents: {
      mouseover(view, event) {
        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (pos) {
          const node = view.state.doc.nodeAt(pos.pos);
          const linkMark = view.state.doc
            .resolve(pos.pos)
            .marks()
            .find((m) => m.type.name === "link");
          if (linkMark) {
            const el = event.target as HTMLElement;
            el.title = `Preview: ${linkMark.attrs.href}`;
          }
        }
        return false;
      },
      click(view, event) {
        const target = event.target as HTMLElement;

        // Toggle checkbox logic
        if (target.classList.contains("task-checkbox")) {
          const isChecked = target.getAttribute("data-checked") === "true";
          const pos = view.posAtDOM(target, 0);
          if (pos !== null) {
            const newText = isChecked ? "[ ]" : "[x]";
            view.dispatch(view.state.tr.insertText(newText, pos, pos + 3));
            return true;
          }
        }

        // Cycle priority logic
        if (target.classList.contains("task-priority")) {
          const current = target.getAttribute("data-priority");
          const priorities = ["H", "M", "L"];
          const currentIndex = priorities.indexOf(current || "");
          const nextIndex = (currentIndex + 1) % (priorities.length + 1); // +1 for "none"

          const pos = view.posAtDOM(target, 0);
          if (pos !== null) {
            if (nextIndex === priorities.length) {
              // Remove priority badge
              view.dispatch(
                view.state.tr.delete(pos, pos + 3).scrollIntoView(),
              );
            } else {
              const next = priorities[nextIndex];
              const newTag = `(${next})`;
              view.dispatch(
                view.state.tr.insertText(newTag, pos, pos + 3).scrollIntoView(),
              );
            }
            return true;
          }
        }
        return false;
      },
    },
  },
});

const tableSortKey = new PluginKey("tableSort");

const tableSortPlugin = new Plugin({
  key: tableSortKey,
  props: {
    handleDOMEvents: {
      click(view, event) {
        const target = event.target as HTMLElement;
        const th = target.closest("th");
        if (!th) return false;

        const pos = view.posAtDOM(th, 0);
        if (pos === null) return false;

        const $pos = view.state.doc.resolve(pos);
        // Find the parent table node
        let tableDepth = -1;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "table") {
            tableDepth = d;
            break;
          }
        }
        if (tableDepth === -1) return false;

        const tableNode = $pos.node(tableDepth);
        const tablePos = $pos.before(tableDepth);

        // Find cell position info
        const cellNode = $pos.node($pos.depth);
        if (cellNode.type.name !== "table_header") return false;

        // Determine column index
        let columnIndex = -1;
        const headerRow = tableNode.firstChild;
        if (!headerRow) return false;
        headerRow.forEach((cell, _, i) => {
          if (cell === cellNode) columnIndex = i;
        });

        if (columnIndex === -1) return false;

        // Toggle sort based on current data-sort attribute (if any)
        const currentSort = th.getAttribute("data-sort");
        const ascending = currentSort !== "asc";

        // Collect rows
        const rows: Node[] = [];
        tableNode.forEach((row) => rows.push(row));

        if (rows.length < 2) return true;

        const bodyRows = rows.slice(1);

        bodyRows.sort((a, b) => {
          const cellA = a.child(columnIndex).textContent.trim();
          const cellB = b.child(columnIndex).textContent.trim();
          
          const isNumA = !isNaN(Number(cellA)) && cellA !== "";
          const isNumB = !isNaN(Number(cellB)) && cellB !== "";

          if (isNumA && isNumB) {
            return ascending ? Number(cellA) - Number(cellB) : Number(cellB) - Number(cellA);
          }
          
          return ascending 
            ? cellA.localeCompare(cellB, undefined, { numeric: true, sensitivity: 'base' })
            : cellB.localeCompare(cellA, undefined, { numeric: true, sensitivity: 'base' });
        });

        const newTable = tableNode.type.create(tableNode.attrs, [headerRow, ...bodyRows]);
        const tr = view.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
        
        // Update data-sort attribute on the new table's header cell if possible
        // Actually it's easier to just use decoration in NodeView, but let's try to set attribute
        // Since we are replacing the whole table, we need to make sure the specific cell has the attr
        const finalTable = tr.doc.nodeAt(tablePos);
        if (finalTable) {
          // Re-create the header row with the sort attribute on the target cell
          const cells: Node[] = [];
          headerRow.forEach((cell, _, i) => {
            if (i === columnIndex) {
              cells.push(cell.type.create({ ...cell.attrs, sort: ascending ? "asc" : "desc" }, cell.content));
            } else {
              cells.push(cell.type.create({ ...cell.attrs, sort: null }, cell.content));
            }
          });
          const newHeader = headerRow.type.create(headerRow.attrs, cells);
          tr.replaceWith(tablePos + 1, tablePos + 1 + headerRow.nodeSize, newHeader);
        }

        view.dispatch(tr);
        return true;
      }
    }
  }
});

const tableRowActionsKey = new PluginKey("tableRowActions");

const tableRowActionsPlugin = new Plugin({
  key: tableRowActionsKey,
  state: {
    init() { return DecorationSet.empty; },
    apply(tr, set) {
      set = set.map(tr.mapping, tr.doc);
      if (tr.docChanged) {
        const decorations: Decoration[] = [];
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "table_row") {
            const widget = document.createElement("div");
            widget.className = "table-row-delete-handle";
            widget.title = "Delete row";
            widget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
            
            // We use a closure or a data attribute to store the position since it might change
            // Actually DecorationSet.map handles position mapping
            widget.setAttribute("data-pos", pos.toString());
            widget.setAttribute("data-size", node.nodeSize.toString());

            decorations.push(Decoration.widget(pos + 1, widget, { key: `delete-${pos}` }));
          }
        });
        return DecorationSet.create(tr.doc, decorations);
      }
      return set;
    }
  },
  props: {
    decorations(state) {
      return tableRowActionsKey.getState(state);
    },
    handleDOMEvents: {
      mousedown(view, event) {
        const target = event.target as HTMLElement;
        const handle = target.closest(".table-row-delete-handle");
        if (handle) {
          event.preventDefault();
          event.stopPropagation();
          
          // Re-find the handle pos using ProseMirror state because it might have shifted
          const posAtDom = view.posAtDOM(handle, 0);
          if (posAtDom === null) return false;
          
          // Find the row node
          const $pos = view.state.doc.resolve(posAtDom);
          const rowNode = $pos.node($pos.depth);
          if (rowNode.type.name !== "table_row") return false;
          
          const rowPos = $pos.before($pos.depth);
          
          // Check if it's the only row in the table (maybe we want to delete the whole table then?)
          const tableNode = $pos.node($pos.depth - 1);
          if (tableNode.childCount <= 1) {
            const tablePos = $pos.before($pos.depth - 1);
            view.dispatch(view.state.tr.delete(tablePos, tablePos + tableNode.nodeSize));
          } else {
            view.dispatch(view.state.tr.delete(rowPos, rowPos + rowNode.nodeSize));
          }
          return true;
        }
        return false;
      }
    }
  }
});

const ProseMirrorEditor = forwardRef<EditorRef, Props>(
  (
    {
      value,
      onChange,
      onKeyDown,
      className,
      placeholder,
      isTypewriter,
      isFocusMode,
      fontSize,
      lineHeight,
      onToggleFocusMode,
      direction = "ltr",
      personalInstructions,
      selectedModel = "mistral",
      provider = "ollama",
      apiKeys,
      providerConfigs,
      onAiResult,
      onAiStream,
      onImageUploadRequest,
      onSearchMetadata,
      onSelectionChange,
      onScroll,
      initialCursor,
      searchQuery = "",
      searchOptions = {
        isCaseSensitive: false,
        isWholeWord: false,
        isSemantic: false,
        searchIndex: -1,
        currentMatchIndex: 0,
      },
      collab,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isUpdatingFromProps = useRef(false);

    // Use a ref to store the latest props to avoid stale closures in ProseMirror callbacks/plugins
    const latestProps = useRef({
      onChange,
      onKeyDown,
      onSearchMetadata,
      onSelectionChange,
      onScroll,
      onAiResult,
      onAiStream,
      isTypewriter,
      isFocusMode,
      searchOptions,
      searchQuery,
      personalInstructions,
      selectedModel,
      provider,
      apiKeys,
      providerConfigs,
    });

    useEffect(() => {
      latestProps.current = {
        onChange,
        onKeyDown,
        onSearchMetadata,
        onSelectionChange,
        onScroll,
        onAiResult,
        onAiStream,
        isTypewriter,
        isFocusMode,
        searchOptions,
        searchQuery,
        personalInstructions,
        selectedModel,
        provider,
        apiKeys,
        providerConfigs,
      };
    });

    const [bubbleMenu, setBubbleMenu] = useState<{
      x: number;
      y: number;
      show: boolean;
    }>({ x: 0, y: 0, show: false });

    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
    
    // AI Draft State
    const [aiDraft, setAiDraft] = useState<{
      isStreaming: boolean;
      content: string;
      originalText: string;
      action: AIAssistantAction | null;
      from: number;
      to: number;
      showActions: boolean;
      y: number; // for rendering buttons
      abortController: AbortController | null;
      originalSelection: { from: number; to: number };
      streamEnd: number;
    } | null>(null);
    const aiDraftRef = useRef(aiDraft);
    useEffect(() => { aiDraftRef.current = aiDraft; }, [aiDraft]);

    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showAiPopover, setShowAiPopover] = useState(false);
    const [slashMenu, setSlashMenu] = useState<{
      x: number;
      y: number;
      show: boolean;
      pos: number;
      query: string;
    }>({ x: 0, y: 0, show: false, pos: 0, query: "" });
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      show: boolean;
      pos: number;
    }>({ x: 0, y: 0, show: false, pos: 0 });
    const [sideMenu, setSideMenu] = useState<{
      y: number;
      show: boolean;
      pos: number;
      nodeName?: string;
    }>({ y: 0, show: false, pos: 0 });
    const isSideMenuEnabled = useUIStore((s) => s.showQuickCommands);
    const isSideMenuEnabledRef = useRef(isSideMenuEnabled);
    useEffect(() => { isSideMenuEnabledRef.current = isSideMenuEnabled; }, [isSideMenuEnabled]);
    const sideMenuHideTimeout = useRef<NodeJS.Timeout | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const streamStartRef = useRef<number | null>(null);
    const streamEndRef = useRef<number | null>(null);

    // Close menus on outside click
    useEffect(() => {
      const handleClick = () => {
        setContextMenu((prev) => ({ ...prev, show: false }));
      };
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }, []);

    useEffect(() => {
      if (!editorRef.current) return;

      const scrollContainer = editorRef.current.parentElement;
      if (!scrollContainer) return;

      const handleScroll = () => {
        if (latestProps.current.onScroll) {
          latestProps.current.onScroll();
        }
      };

      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    useLayoutEffect(() => {
      if (!editorRef.current) return;

      // Typewriter scrolling plugin
      const typewriterPlugin = new Plugin({
        view() {
          return {
            update(view) {
              if (!latestProps.current.isTypewriter) return;
              const { state } = view;
              const { selection } = state;
              if (!selection.empty) return;

              // Avoid scrolling for the first few lines of a new document
              if (selection.from < 50) return;

              const coords = view.coordsAtPos(selection.from);
              const editorRect = editorRef.current?.getBoundingClientRect();
              if (!editorRect) return;

              const viewportHeight = window.innerHeight;
              const targetY = viewportHeight / 2;
              const currentY = coords.top;

              const diff = currentY - targetY;

              // Only scroll if we are below the target point
              if (diff > 0 && Math.abs(diff) > 20) {
                const scrollContainer = editorRef.current?.parentElement;
                if (scrollContainer) {
                  scrollContainer.scrollBy({ top: diff, behavior: "smooth" });
                }
              }
            },
          };
        },
      });

      // Search highlighting plugin
      const searchPlugin = createSearchPlugin();

      // Focus Mode plugin
      const focusModePlugin = new Plugin({
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set, oldState, newState) {
            if (!latestProps.current.isFocusMode) return DecorationSet.empty;
            const { selection } = newState;
            const $pos = selection.$from;
            let topNodePos = 0;
            let found = false;
            newState.doc.forEach((node, pos) => {
              if (found) return;
              if (pos <= $pos.pos && pos + node.nodeSize >= $pos.pos) {
                topNodePos = pos;
                found = true;
              }
            });
            if (!found) return DecorationSet.empty;
            const node = newState.doc.nodeAt(topNodePos);
            if (!node) return DecorationSet.empty;
            const deco = Decoration.node(
              topNodePos,
              topNodePos + node.nodeSize,
              { class: "is-focused-node" },
            );
            return DecorationSet.create(newState.doc, [deco]);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      });

      // TTS Highlight plugin
      const ttsHighlightPlugin = new Plugin({
        state: {
          init() { return DecorationSet.empty; },
          apply(tr, set, oldState, newState) {
            const range = tr.getMeta("ttsHighlight");
            if (range === undefined) {
              return set.map(tr.mapping, tr.doc);
            }
            
            if (!range) return DecorationSet.empty;
            
            const from = Math.max(0, Math.min(range.from, tr.doc.content.size));
            const to = Math.max(from, Math.min(range.to, tr.doc.content.size));
            
            if (from === to) return DecorationSet.empty;

            const deco = Decoration.inline(from, to, { class: "tts-highlight" });
            return DecorationSet.create(tr.doc, [deco]);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      });

      // Collaboration plugin
      const collabInstance = collab?.enabled
        ? createCollabPlugin({
            docId: collab.docId,
            username: collab.username,
          })
        : null;

      const state = EditorState.create({
        schema: editorSchema,
        doc: parseMarkdownDoc(value) || editorSchema.nodes.doc.createAndFill()!,
        plugins: [
          ...(collabInstance
            ? collabInstance.plugins
            : [
                history(),
                keymap({
                  "Mod-z": undo,
                  "Mod-y": redo,
                  "Mod-Shift-z": redo,
                }),
              ]),
          keymap(buildKeymap(editorSchema)),
          keymap(baseKeymap),
          keymap({
            "Mod-j": (state, dispatch) => {
              let { from, to } = state.selection;
              if (from === to) {
                const $from = state.selection.$from;
                const blockFrom = $from.start();
                const blockTo = $from.end();
                if (blockFrom !== blockTo) {
                  if (dispatch) {
                    dispatch(state.tr.setSelection(TextSelection.create(state.doc, blockFrom, blockTo)));
                  }
                }
              }
              setShowAiPopover(true);
              return true;
            },
            "Mod-Shift-j": (state, dispatch) => {
              let { from, to } = state.selection;
              if (from === to) {
                const $from = state.selection.$from;
                const blockFrom = $from.start();
                const blockTo = $from.end();
                if (blockFrom !== blockTo) {
                  if (dispatch) {
                    dispatch(state.tr.setSelection(TextSelection.create(state.doc, blockFrom, blockTo)));
                  }
                }
              }
              setShowAiPopover(true);
              return true;
            },
            "Mod-Shift-i": (state) => {
              const { from, to } = state.selection;
              const text = state.doc.textBetween(from, to, " ");
              if (text.trim()) {
                handleAIAction("improve");
                return true;
              }
              return false;
            },
            "Mod-Shift-s": (state) => {
              const { from, to } = state.selection;
              const text = state.doc.textBetween(from, to, " ");
              if (text.trim()) {
                handleAIAction("summarize");
                return true;
              }
              return false;
            },
            "Mod-Shift-g": (state) => {
              const { from, to } = state.selection;
              const text = state.doc.textBetween(from, to, " ");
              if (text.trim()) {
                handleAIAction("fix-grammar");
                return true;
              }
              return false;
            }
          }),
          buildInputRules(editorSchema),
          dropCursor(),
          gapCursor(),
          highlightPlugin,
          draftHighlightPlugin,
          linkPreviewPlugin,
          tableEditing(),
          typewriterPlugin,
          focusModePlugin,
          searchPlugin,
          ttsHighlightPlugin,
          createHeadingPlugin(),
          tableSortPlugin,
          tableRowActionsPlugin,
          createMathPlugin(),
          new Plugin({
            props: {
              handleDOMEvents: {
                mousemove(view, event) {
                  if (bubbleMenu.show || !isSideMenuEnabledRef.current) return false;
                  
                  if (sideMenuHideTimeout.current) clearTimeout(sideMenuHideTimeout.current);

                  const pos = view.posAtCoords({
                    left: event.clientX,
                    top: event.clientY,
                  });
                  if (pos && pos.pos >= 0) {
                    const $pos = view.state.doc.resolve(pos.pos);
                    if ($pos.depth >= 1) {
                      let blockNode = $pos.node(1);
                      let blockPos = $pos.before(1);

                      if (blockNode) {
                        const coords = view.coordsAtPos(blockPos);
                        const editorRect =
                          editorRef.current?.getBoundingClientRect();
                        if (editorRect) {
                          setSideMenu({
                            y: coords.top - editorRect.top,
                            show: true,
                            pos: blockPos,
                            nodeName: blockNode.type.name,
                          });
                        }
                      }
                    } else {
                      setSideMenu((prev) => ({ ...prev, show: false }));
                    }
                  }
                  return false;
                },
                mouseleave() {
                  if (sideMenuHideTimeout.current) clearTimeout(sideMenuHideTimeout.current);
                  sideMenuHideTimeout.current = setTimeout(() => {
                    setSideMenu((prev) => ({ ...prev, show: false }));
                  }, 400);
                  return false;
                },
              },
            },
          }),
          new Plugin({
            props: {
              handleDOMEvents: {
                contextmenu(view, event) {
                  event.preventDefault();
                  const pos = view.posAtCoords({
                    left: event.clientX,
                    top: event.clientY,
                  });
                  const editorRect =
                    containerRef.current?.getBoundingClientRect();
                  setContextMenu({
                    x: event.clientX - (editorRect?.left || 0),
                    y: event.clientY - (editorRect?.top || 0),
                    show: true,
                    pos: pos ? pos.pos : view.state.selection.from,
                  });
                  return true;
                },
              },
            },
          }),
          new Plugin({
            view() {
              return {
                update(view) {
                  const { state } = view;
                  const { from, to } = state.selection;

                  if (from === to) {
                    setBubbleMenu((prev) => ({ ...prev, show: false }));
                    setShowAiPopover(false);
                    return;
                  }

                  const start = view.coordsAtPos(from);
                  const end = view.coordsAtPos(to);
                  const left = (start.left + end.left) / 2;

                  const editorRect =
                    containerRef.current?.getBoundingClientRect();
                  if (editorRect) {
                    const { state } = view;
                    const { from, $from, to, empty } = state.selection;
                    
                    // Update active formats
                    const formats: Record<string, boolean> = {
                      bold: state.doc.rangeHasMark(from, to, editorSchema.marks.strong) || (empty && !!editorSchema.marks.strong.isInSet(state.storedMarks || $from.marks())),
                      italic: state.doc.rangeHasMark(from, to, editorSchema.marks.em) || (empty && !!editorSchema.marks.em.isInSet(state.storedMarks || $from.marks())),
                      underline: state.doc.rangeHasMark(from, to, editorSchema.marks.underline) || (empty && !!editorSchema.marks.underline.isInSet(state.storedMarks || $from.marks())),
                      strike: state.doc.rangeHasMark(from, to, editorSchema.marks.strike) || (empty && !!editorSchema.marks.strike.isInSet(state.storedMarks || $from.marks())),
                      code: state.doc.rangeHasMark(from, to, editorSchema.marks.code) || (empty && !!editorSchema.marks.code.isInSet(state.storedMarks || $from.marks())),
                      h1: $from.parent.type.name === "heading" && $from.parent.attrs.level === 1,
                      h2: $from.parent.type.name === "heading" && $from.parent.attrs.level === 2,
                      h3: $from.parent.type.name === "heading" && $from.parent.attrs.level === 3,
                      alignLeft: $from.parent.attrs.align === "left" || !$from.parent.attrs.align,
                      alignCenter: $from.parent.attrs.align === "center",
                      alignRight: $from.parent.attrs.align === "right",
                      alignJustify: $from.parent.attrs.align === "justify",
                      blockquote: ((): boolean => {
                        for (let d = $from.depth; d > 0; d--) {
                          if ($from.node(d).type.name === "blockquote") return true;
                        }
                        return false;
                      })(),
                      bullet: ((): boolean => {
                        for (let d = $from.depth; d > 0; d--) {
                          if ($from.node(d).type.name === "bullet_list") return true;
                        }
                        return false;
                      })(),
                    };
                    setActiveFormats(formats);

                    setBubbleMenu({
                      x: left - editorRect.left,
                      y: start.top - editorRect.top - 45,
                      show: true,
                    });
                  }
                },
              };
            },
          }),
        ],
      });

      const view = new EditorView(editorRef.current, {
        state,
        attributes: {
          class: cn("ProseMirror", isTypewriter && "typewriter-mode"),
          "data-placeholder": placeholder || "Start writing...",
          dir: direction,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Markdown editor",
          spellcheck: "true",
        },
        nodeViews: {
          scribble: createScribbleNodeView(),
          image: createImageNodeView(),
          gallery: createGalleryNodeView(),
          diagram: createDiagramNodeView(),
        },
        clipboardSerializer: DOMSerializer.fromSchema(editorSchema),
        clipboardTextSerializer(slice) {
          return editorSerializer.serialize(
            editorSchema.nodes.doc.create(null, slice.content),
          );
        },
        clipboardTextParser(text, $context) {
          // Detect if text is markdown-like
          const isMarkdown = /[#*`\[]|^\s*[-+]\s|^\s*\d+\.\s/m.test(text);
          if (isMarkdown) {
            return new Slice(parseMarkdownDoc(text).content, 0, 0);
          }
          // Fallback to default parsing which might just be plain text
          return new Slice(parseMarkdownDoc(text).content, 0, 0);
        },
        dispatchTransaction(tr) {
          const newState = this.state.apply(tr);
          this.updateState(newState);

          // Slash menu query detection
          if (slashMenu.show) {
            const { selection, doc } = newState;
            // Check if the trigger slash is still there
            const charBefore = doc.textBetween(
              Math.max(0, slashMenu.pos - 1),
              Math.max(0, slashMenu.pos),
            );

            // If cursor moves before the slash, slash is deleted, or selection is not empty, hide menu
            if (
              selection.from < slashMenu.pos ||
              charBefore !== "/" ||
              !selection.empty
            ) {
              setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));
            } else {
              const text = doc.textBetween(slashMenu.pos, selection.from);
              // Limit query length or check for spaces to hide menu
              if (text.includes(" ") || text.length > 50) {
                setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));
              } else {
                setSlashMenu((prev) => ({ ...prev, query: text }));
              }
            }
          }

          // Track search metadata
          if (latestProps.current.onSearchMetadata) {
            const searchState = searchPluginKey.getState(newState);
            if (searchState) {
              const count = searchState.decorations.find().length;
              latestProps.current.onSearchMetadata(
                count,
                latestProps.current.searchOptions.currentMatchIndex,
              );
            }
          }

          if (tr.docChanged && !isUpdatingFromProps.current) {
            const markdown = editorSerializer.serialize(newState.doc);
            latestProps.current.onChange(markdown);
          }

          if (!tr.selection.eq(this.state.selection)) {
            latestProps.current.onSelectionChange?.({
              from: tr.selection.from,
              to: tr.selection.to,
            });
          }
        },
        handleKeyDown(view, event) {
          if (latestProps.current.onKeyDown) {
            latestProps.current.onKeyDown(event as any);
          }

          // Slash command detection
          if (event.key === "/") {
            const { selection } = view.state;
            if (selection.empty) {
              const $from = selection.$from;
              const before = $from.parent.textContent.substring(
                0,
                $from.parentOffset,
              );
              const isStartOfLine = $from.parentOffset === 0;
              const isAfterSpace = before.endsWith(" ");

              if (isStartOfLine || isAfterSpace) {
                const coords = view.coordsAtPos(selection.from);
                const editorRect =
                  containerRef.current?.getBoundingClientRect();
                if (editorRect) {
                  setSlashMenu({
                    x: coords.left - editorRect.left,
                    y: coords.bottom - editorRect.top + 5,
                    show: true,
                    pos: selection.from + 1, // Start query AFTER the slash
                    query: "",
                  });
                }
              }
            }
          } else if (event.key === "Escape") {
            setSlashMenu((prev) => ({ ...prev, show: false }));
          }

          return false;
        },
        handleDrop(view, event) {
          const files = event.dataTransfer?.files;
          if (files && files.length > 0) {
            const imageFiles = Array.from(files).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (imageFiles.length === 0) return false;

            const pos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            const insertPos = pos ? pos.pos : view.state.selection.from;

            if (imageFiles.length > 1) {
              // Create a gallery
              const promises = imageFiles.map((file) => {
                return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string);
                  reader.readAsDataURL(file);
                });
              });

              Promise.all(promises).then((srcs) => {
                const imageNodes = srcs.map((src) =>
                  editorSchema.nodes.image.create({ src }),
                );
                const galleryNode = editorSchema.nodes.gallery.create(
                  { layout: "grid" },
                  imageNodes,
                );
                view.dispatch(view.state.tr.insert(insertPos, galleryNode));
              });
            } else {
              // Single image
              const reader = new FileReader();
              reader.onload = (e) => {
                const src = e.target?.result as string;
                const node = editorSchema.nodes.image.create({ src });
                view.dispatch(view.state.tr.insert(insertPos, node));
              };
              reader.readAsDataURL(imageFiles[0]);
            }
            event.preventDefault();
            return true;
          }
          return false;
        },
        handlePaste(view, event) {
          const text = event.clipboardData?.getData("text/plain");
          const html = event.clipboardData?.getData("text/html");

          // Handle images
          const items = event.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                  // For now, we can base64 encode it or trigger an upload request
                  // Given the architecture, triggering an upload request or a dedicated handler is better
                  // If onImageUploadRequest is provided, we can potentially use it, but it's usually for a selector.
                  // Let's at least log or provide a placeholder.
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const src = e.target?.result as string;
                    const node = editorSchema.nodes.image.create({ src });
                    view.dispatch(view.state.tr.replaceSelectionWith(node));
                  };
                  reader.readAsDataURL(file);
                  return true;
                }
              }
            }
          }

          if (text && /^https?:\/\/[^\s$.?#].[^\s]*$/.test(text.trim())) {
            // If selecting text, we can wrap it as a link instead of prompting
            const { from, to } = view.state.selection;
            if (from !== to) {
              const tr = view.state.tr.addMark(
                from,
                to,
                editorSchema.marks.link.create({ href: text.trim() }),
              );
              view.dispatch(tr);
              return true;
            }

            const confirmed = window.confirm(
              "Detected a URL. Would you like to insert it as a Markdown link?",
            );
            if (confirmed) {
              const label =
                window.prompt("Enter link label:", "Link") || "Link";
              const markdownLink = `[${label}](${text.trim()})`;
              const node = parseMarkdownDoc(markdownLink);
              view.dispatch(view.state.tr.replaceSelectionWith(node));
              return true;
            }
          }
          return false;
        },
      });

      viewRef.current = view;

      return () => {
        view.destroy();
      };
    }, []); // Only run on mount

    // Sync search state
    const prevSearchQuery = useRef("");
    const prevSearchOptions = useRef<any>(null);

    useEffect(() => {
      if (viewRef.current) {
        const tr = viewRef.current.state.tr;
        tr.setMeta("searchQuery", searchQuery);
        tr.setMeta("searchOptions", searchOptions);
        // Explicitly trigger a decoration update for Focus Mode if it changed
        tr.setMeta("focusModeUpdate", isFocusMode);

        viewRef.current.dispatch(tr);

        prevSearchQuery.current = searchQuery;
        prevSearchOptions.current = searchOptions;

        viewRef.current.setProps({
          attributes: {
            class: cn(
              "ProseMirror",
              isTypewriter && "typewriter-mode",
              isFocusMode && "focus-mode-active",
            ),
            "data-placeholder": placeholder || "Start writing...",
            dir: direction,
          },
        });

        // If we have a current match, try to scroll to it
        // Note: mapping searchIndex (string index) to PM pos is approximate
        // but for basic markdown it's usually 1:1 or very close.
        if (searchQuery && searchOptions.searchIndex !== -1) {
          // We'll try to find the PM position that matches the searchIndex
          // For simplicity, we'll just scroll the view if we can find the decoration pos
          // Or just use coordsAtPos if we assume 1:1 mapping for now.
          try {
            const pos = searchOptions.searchIndex; // Naive approximation
            const coords = viewRef.current.coordsAtPos(pos);
            if (coords) {
              const editorRect = editorRef.current?.getBoundingClientRect();
              const scrollContainer = editorRef.current?.parentElement;
              if (scrollContainer && editorRect) {
                const relativeTop =
                  coords.top - editorRect.top + scrollContainer.scrollTop;
                scrollContainer.scrollTo({
                  top: relativeTop - scrollContainer.clientHeight / 3,
                  behavior: "smooth",
                });
              }
            }
          } catch (e) {}
        }
      }
    }, [
      searchQuery,
      searchOptions.searchIndex,
      searchOptions.currentMatchIndex,
      searchOptions.isCaseSensitive,
      searchOptions.isWholeWord,
      direction,
      isTypewriter,
      isFocusMode,
      placeholder,
    ]);

    const getCursorContextInternal = () => {
      if (!viewRef.current) return "";
      const { state } = viewRef.current;
      const { $from } = state.selection;
      const depth = $from.depth;

      // Get current block content safely
      const start = depth > 0 ? $from.start(depth) : 0;
      const end = depth > 0 ? $from.end(depth) : state.doc.content.size;
      const currentPara = state.doc.textBetween(start, end, " ");

      // Try to find the heading path
      let headingPath = [];
      let pos = $from.pos;
      while (pos > 0) {
        const $pos = state.doc.resolve(pos);
        const node = $pos.parent;
        if (node && node.type.name === "heading") {
          headingPath.unshift(node.textContent);
        }

        if ($pos.depth > 0) {
          pos = $pos.before();
        } else {
          break;
        }

        if (pos === 0) break;
      }

      const pathStr =
        headingPath.length > 0 ? `Path: ${headingPath.join(" > ")}` : "";
      return `${pathStr}\n\n${currentPara}`.trim();
    };

    useEffect(() => {
      if (isUpdatingFromProps.current) {
        isUpdatingFromProps.current = false;
        return;
      }
      if (viewRef.current) {
        const currentMarkdown = editorSerializer.serialize(viewRef.current.state.doc);
        if (value !== currentMarkdown) {
          const node = parseMarkdownDoc(value);
          if (node) {
            viewRef.current.dispatch(
              viewRef.current.state.tr.replaceWith(0, viewRef.current.state.doc.content.size, node.content)
                .setMeta("addToHistory", false)
            );
          }
        }
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      insertText: (before: string, after: string = "") => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { from, to } = state.selection;

        // This is a bit simplified. Real markdown insertion in ProseMirror
        // usually involves toggling marks or changing block types.
        // But we can insert raw text if we want.
        let tr = state.tr.insertText(before, from);
        tr = tr.insertText(after, to + before.length);
        dispatch(tr);
      },
      insertImage: (src: string, alt: string = "", title: string = "") => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { from } = state.selection;

        const node = editorSchema.nodes.image.create({ src, alt, title });
        const tr = state.tr.insert(from, node);
        dispatch(tr);
      },
      insertGallery: (srcs: string[]) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { from } = state.selection;

        const imageNodes = srcs.map((src) =>
          editorSchema.nodes.image.create({ src }),
        );
        const galleryNode = editorSchema.nodes.gallery.create(
          { layout: "grid" },
          imageNodes,
        );
        const tr = state.tr.insert(from, galleryNode);
        dispatch(tr);
      },
      insertScribble: () => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { from } = state.selection;
        const node = editorSchema.nodes.scribble.create({ aspectRatio: 0.5 });
        const tr = state.tr.insert(from, node);
        dispatch(tr);
      },
      appendMarkdown: (content: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const parsed = parseMarkdownDoc(content);
        const tr = state.tr.insert(state.doc.content.size, parsed.content);
        dispatch(tr);
        viewRef.current.focus();
      },
      replaceSelectionWithMarkdown: (content: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { from, to } = state.selection;
        const parsed = parseMarkdownDoc(content);
        const tr = state.tr.replaceWith(from, to, parsed.content);
        dispatch(tr);
        viewRef.current.focus();
      },
      getSelectedText: () => {
        if (!viewRef.current) return "";
        const { state } = viewRef.current;
        const { from, to } = state.selection;
        return state.doc.textBetween(from, to, " ");
      },
      getHtml: () => {
        if (!viewRef.current) return "";
        const fragment = DOMSerializer.fromSchema(
          editorSchema,
        ).serializeFragment(viewRef.current.state.doc.content);
        const container = document.createElement("div");
        container.appendChild(fragment);
        return container.innerHTML;
      },
      getDoc: () => {
        return viewRef.current?.state.doc;
      },
      getHeadings: () => {
        if (!viewRef.current) return [];
        const headings: { text: string; level: number; pos: number; id: string }[] = [];
        viewRef.current.state.doc.descendants((node, pos) => {
          if (node.type.name === "heading") {
            headings.push({
              text: node.textContent,
              level: node.attrs.level,
              pos: pos,
              id: node.attrs.id || slugify(node.textContent)
            });
          }
        });
        return headings;
      },
      getTextWithPositions: () => {
        if (!viewRef.current) return [];
        const result: { text: string; pos: number }[] = [];
        viewRef.current.state.doc.descendants((node, pos) => {
          if (node.isText) {
            result.push({ text: node.text || "", pos });
          }
        });
        return result;
      },
      setTTSHighlight: (range: { from: number; to: number } | null) => {
        const view = viewRef.current;
        if (!view) return;
        
        const tr = view.state.tr;
        tr.setMeta("ttsHighlight", range);
        if (range) {
          // Find if the range is valid
          const from = Math.max(0, Math.min(range.from, view.state.doc.content.size));
          // Center the highlight in view if possible
          tr.setSelection(TextSelection.create(view.state.doc, from));
          tr.scrollIntoView();
        }
        view.dispatch(tr);
        
        useUIStore.getState().setTTSHighlightRange(range);
      },
      handleFormat: (type: string) => {
        handleFormat(type);
      },
      getCursorContext: () => {
        return getCursorContextInternal();
      },
      scrollToText: (text: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const docText = state.doc.textContent;
        const index = docText.indexOf(text);
        if (index !== -1) {
          let pos = 1;
          let found = false;
          state.doc.descendants((node, nodePos) => {
            if (found) return false;
            if (node.isText) {
              const nodeText = node.text || "";
              const internalIndex = nodeText.indexOf(text);
              if (internalIndex !== -1) {
                pos = nodePos + internalIndex;
                found = true;
                return false;
              }
            }
            return true;
          });

          if (found) {
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, pos, pos + text.length),
            );
            tr.scrollIntoView();
            dispatch(tr);
            viewRef.current.focus();
          }
        }
      },
      scrollToPos: (pos: number) => {
        const view = viewRef.current;
        if (!view) return;
        
        try {
          const { state, dispatch } = view;
          const resolvedPos = state.doc.resolve(Math.min(pos, state.doc.content.size));
          // Create a point selection at the start of the heading
          const selection = TextSelection.create(state.doc, resolvedPos.pos);
          const tr = state.tr.setSelection(selection).scrollIntoView();
          dispatch(tr);
          view.focus();
        } catch (e) {
          console.error("Scroll to pos failed", e);
        }
      },
      streamMarkdown: (content: string, isNew: boolean = false) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;

        if (isNew) {
          streamStartRef.current = state.selection.from;
          streamEndRef.current = state.selection.to;
        }

        const from = streamStartRef.current ?? state.selection.from;
        const to = streamEndRef.current ?? state.selection.to;

        const parsed = parseMarkdownDoc(content);
        const tr = state.tr.replaceWith(from, to, parsed.content);

        // Update end ref after replacement
        streamEndRef.current = from + parsed.content.size;

        // Auto-scroll to keep bottom of stream visible
        tr.scrollIntoView();

        dispatch(tr);
      },
      setMarkdown: (content: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        isUpdatingFromProps.current = true;
        const tr = state.tr.replaceWith(
          0,
          state.doc.content.size,
          parseMarkdownDoc(content).content,
        );
        dispatch(tr);
        isUpdatingFromProps.current = false;
        viewRef.current.focus();
      },
    }));

    const handleFormat = (type: string) => {
      if (!viewRef.current) return;
      const { state, dispatch } = viewRef.current;

      const setAlign = (alignment: string) => {
        const { from, to } = state.selection;
        let tr = state.tr;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            tr.setNodeMarkup(pos, null, { ...node.attrs, align: alignment });
          }
        });
        if (tr.docChanged) dispatch(tr);
      };

      if (type === "bold")
        toggleMark(editorSchema.marks.strong)(state, dispatch);
      if (type === "italic") toggleMark(editorSchema.marks.em)(state, dispatch);
      if (type === "underline")
        toggleMark(editorSchema.marks.underline)(state, dispatch);
      if (type === "strike")
        toggleMark(editorSchema.marks.strike)(state, dispatch);
      if (type === "code") toggleMark(editorSchema.marks.code)(state, dispatch);
      if (type === "h1")
        setBlockType(editorSchema.nodes.heading, { level: 1 })(state, dispatch);
      if (type === "h2")
        setBlockType(editorSchema.nodes.heading, { level: 2 })(state, dispatch);
      if (type === "h3")
        setBlockType(editorSchema.nodes.heading, { level: 3 })(state, dispatch);
      if (type === "quote")
        wrapInBlock(editorSchema.nodes.blockquote)(state, dispatch);
      if (type === "alignLeft") setAlign("left");
      if (type === "alignCenter") setAlign("center");
      if (type === "alignRight") setAlign("right");
      if (type === "alignJustify") setAlign("justify");
      if (type === "bullet") wrapInList(editorSchema.nodes.bullet_list)(state, dispatch);
      if (type === "tableify") {
        const { from, to } = state.selection;
        const selectedText = state.doc.textBetween(from, to, "\n");
        if (selectedText.trim()) {
          const lines = selectedText.split("\n").filter(l => l.trim().length > 0);
          if (lines.length > 0) {
            const delimiters = ["|", "\t", ","];
            let bestDelimiter = delimiters[0];
            let maxCols = 0;

            for (const delim of delimiters) {
              const cols = lines[0].split(delim).length;
              if (cols > maxCols) {
                maxCols = cols;
                bestDelimiter = delim;
              }
            }

            const processLine = (line: string) => {
              let cols = line.split(bestDelimiter);
              if (bestDelimiter === "|") {
                cols = cols.filter((c, i) => {
                  if ((i === 0 || i === cols.length - 1) && c.trim() === "") return false;
                  return true;
                });
              }
              return cols.map(c => c.trim());
            };

            const tableData = lines.map(processLine);
            const colCount = Math.max(...tableData.map(r => r.length));

            let markdownTable = "";
            const header = [...tableData[0]];
            while (header.length < colCount) header.push(`Header ${header.length + 1}`);
            markdownTable += "| " + header.join(" | ") + " |\n";
            markdownTable += "| " + Array(colCount).fill("---").join(" | ") + " |\n";
            
            for (let i = 1; i < tableData.length; i++) {
              const row = [...tableData[i]];
              while (row.length < colCount) row.push("");
              markdownTable += "| " + row.join(" | ") + " |\n";
            }

            const slice = parseMarkdownDoc(markdownTable);
            dispatch(state.tr.replaceSelection(new Slice(slice.content, 0, 0)));
          }
        }
      }

      viewRef.current.focus();
    };

    const handleAIAction = async (action: AIAssistantAction, retryText?: string, retryAction?: AIAssistantAction, retryFrom?: number, retryTo?: number) => {
      if (!viewRef.current) return;
      
      const { state, dispatch } = viewRef.current;
      const from = retryFrom ?? state.selection.from;
      const to = retryTo ?? state.selection.to;
      const selectedText = retryText ?? state.doc.textBetween(from, to, " ");

      if (!selectedText.trim()) return;

      const abortController = new AbortController();
      
      const coords = viewRef.current.coordsAtPos(to);
      const editorRect = containerRef.current?.getBoundingClientRect();
      const y = coords.bottom - (editorRect?.top || 0);

      const initialDraftState = {
        isStreaming: true,
        content: "",
        originalText: selectedText,
        action: retryAction ?? action,
        from,
        to, // initial to
        showActions: false,
        y: y + 20,
        abortController,
        originalSelection: { from, to },
        streamEnd: to
      };
      
      setAiDraft(initialDraftState);
      setIsProcessingAI(true);
      setBubbleMenu((prev) => ({ ...prev, show: false }));
      setShowAiPopover(false);

      try {
        const fullDoc = editorSerializer.serialize(state.doc);
        const cursorContext = getCursorContextInternal();

        let fullResponse = "";
        let streamStart = from;
        let streamEnd = to;

        await processAIAction(selectedText, retryAction ?? action, {
          personalInstructions: latestProps.current.personalInstructions,
          model: latestProps.current.selectedModel,
          provider: latestProps.current.provider as any,
          apiKeys: latestProps.current.apiKeys,
          providerConfigs: latestProps.current.providerConfigs,
          signal: abortController.signal,
          onChunk: (chunk) => {
            fullResponse += chunk;
            
            if (viewRef.current) {
               const { state: curState, dispatch: curDispatch } = viewRef.current;
                const parsed = parseMarkdownDoc(fullResponse);
               
               // We replace the original text with the streamed text.
               const tr = curState.tr.replaceWith(streamStart, streamEnd, parsed.content);
               
               streamEnd = streamStart + parsed.content.size;
               
               tr.setMeta(draftHighlightKey, { from: streamStart, to: streamEnd, isGenerating: true });
               if (latestProps.current.isTypewriter) {
                   tr.scrollIntoView();
               }
               curDispatch(tr);

               setAiDraft(prev => prev ? ({
                 ...prev,
                 content: fullResponse,
                 to: streamEnd,
                 streamEnd
               }) : null);
            }
          },
          documentContext: fullDoc,
          cursorContext: cursorContext,
        });

        if (viewRef.current) {
           const { state: finalState, dispatch: finalDispatch } = viewRef.current;
           const tr = finalState.tr;
           tr.setMeta(draftHighlightKey, { from: streamStart, to: streamEnd, isGenerating: false });
           
           const finalCoords = viewRef.current.coordsAtPos(streamEnd);
           const finalY = finalCoords.bottom - (editorRect?.top || 0);

           finalDispatch(tr);
           
           setAiDraft(prev => prev ? ({
             ...prev,
             isStreaming: false,
             showActions: true,
             to: streamEnd,
             streamEnd,
             y: finalY + 10
           }) : null);
        }

      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("AI Action failed:", error);
          alert("Failed to process AI request. Check console for details.");
        }
        if (viewRef.current) {
           const { state: finalState, dispatch: finalDispatch } = viewRef.current;
           const tr = finalState.tr;
           
           // Restore original text
           const parsed = parseMarkdownDoc(initialDraftState.originalText);
           tr.replaceWith(initialDraftState.from, aiDraftRef.current?.streamEnd ?? initialDraftState.to, parsed.content);
           tr.setMeta(draftHighlightKey, null);
           finalDispatch(tr);
        }
        setAiDraft(null);
      } finally {
        setIsProcessingAI(false);
      }
    };

    const handleAIActionDecision = (decision: 'replace' | 'append' | 'retry' | 'cancel') => {
        if (!aiDraftRef.current || !viewRef.current) return;
        const draft = aiDraftRef.current;
        const { state, dispatch } = viewRef.current;
        const tr = state.tr;
        
        tr.setMeta(draftHighlightKey, null); // clear highlight

        if (decision === 'cancel') {
            const parsed = parseMarkdownDoc(draft.originalText);
            tr.replaceWith(draft.from, draft.streamEnd, parsed.content);
        } else if (decision === 'append') {
            // Restore original text, then append new text
            const parsedOrg = parseMarkdownDoc(draft.originalText);
            const parsedDraft = parseMarkdownDoc("\n\n" + draft.content);
            
            // first put original back
            tr.replaceWith(draft.from, draft.streamEnd, parsedOrg.content);
            
            // then append draft content after it
            tr.insert(draft.from + parsedOrg.content.size, parsedDraft.content);
            tr.scrollIntoView();
        } else if (decision === 'retry') {
            const parsedOrg = parseMarkdownDoc(draft.originalText);
            tr.replaceWith(draft.from, draft.streamEnd, parsedOrg.content);
            dispatch(tr);
            
            handleAIAction(draft.action!, draft.originalText, draft.action!, draft.from, draft.from + parsedOrg.content.size);
            return;
        } else if (decision === 'replace') {
            // Do nothing, text is already replaced. Just clear highlight.
            tr.setMeta("addToHistory", true);
            tr.setMeta("ai-modification", true);
        }

        dispatch(tr);
        setAiDraft(null);
        viewRef.current.focus();
    };

    const handleSlashSelect = async (action: string) => {
      if (!viewRef.current) return;
      const { state } = viewRef.current;

      const endPos = state.selection.from;
      const startPos = slashMenu.pos - 1;

      const finalStart = Math.max(
        0,
        Math.min(startPos, state.doc.content.size),
      );
      const finalEnd = Math.max(
        finalStart,
        Math.min(endPos, state.doc.content.size),
      );

      const tr = state.tr.delete(finalStart, finalEnd);
      viewRef.current.dispatch(tr);

      const afterDeleteState = viewRef.current.state;
      setSlashMenu((prev) => ({ ...prev, show: false, query: "" }));

      if (action === "h1") handleFormat("h1");
      else if (action === "h2") handleFormat("h2");
      else if (action === "align-left") handleFormat("alignLeft");
      else if (action === "align-center") handleFormat("alignCenter");
      else if (action === "align-right") handleFormat("alignRight");
      else if (action === "align-justify") handleFormat("alignJustify");
      else if (action === "bullet") handleFormat("bullet");
      else if (action.startsWith("todo-")) {
        const priority = action.replace("todo-", "");
        let priorityTag = "";
        switch (priority) {
          case "high":
            priorityTag = "(H)";
            break;
          case "medium":
            priorityTag = "(M)";
            break;
          case "low":
            priorityTag = "(L)";
            break;
        }
        const tr = afterDeleteState.tr.replaceSelectionWith(
          editorSchema.text(`- [ ] ${priorityTag} `),
        );
        viewRef.current.dispatch(tr);
      } else if (action === "code")
        setBlockType(editorSchema.nodes.code_block)(
          afterDeleteState,
          viewRef.current.dispatch,
        );
      else if (action === "scribble") {
        const node = editorSchema.nodes.scribble.create({ aspectRatio: 0.5 });
        viewRef.current.dispatch(afterDeleteState.tr.replaceSelectionWith(node));
      } else if (action === "tableify") {
        handleFormat("tableify");
      } else if (action === "image") onImageUploadRequest?.();
      else if (action === "gallery") {
        // We'll prompt for multiple images or just insert an empty one with a placeholder
        onImageUploadRequest?.(); // Reuse image upload for now, or we could have a specific gallery creator
      } else if (action === "quote") {
        handleFormat("quote");
      } else if (
        [
          "improve",
          "outline",
          "summarize",
          "rewrite",
          "complete-text",
        ].includes(action) ||
        action.startsWith("ai-")
      ) {
        const type = action.replace("ai-", "") as AIAssistantAction;

        const resolvedPos = afterDeleteState.doc.resolve(
          Math.min(finalStart, afterDeleteState.doc.content.size),
        );
        const depth = resolvedPos.depth;

        const start = depth > 0 ? resolvedPos.start(depth) : 0;
        const end =
          depth > 0
            ? resolvedPos.end(depth)
            : afterDeleteState.doc.content.size;

        try {
          const trSelect = afterDeleteState.tr.setSelection(
            TextSelection.create(afterDeleteState.doc, start, end),
          );
          viewRef.current.dispatch(trSelect);
          await handleAIAction(type);
        } catch (err) {
          console.error("Failed to set selection for AI action:", err);
          await handleAIAction(type);
        }
      }

      viewRef.current.focus();
    };

    const wrapInBlock = (type: any) => (state: EditorState, dispatch: any) => {
      return wrapIn(type)(state, dispatch);
    };

    useEffect(() => {
      if (viewRef.current) {
        viewRef.current.focus();
        const { state, dispatch } = viewRef.current;

        if (initialCursor) {
          try {
            const max = state.doc.content.size;
            const from = Math.min(initialCursor.from, max);
            const to = Math.min(initialCursor.to, max);
            dispatch(
              state.tr
                .setSelection(TextSelection.create(state.doc, from, to))
                .scrollIntoView(),
            );
          } catch (e) {
            console.warn("Failed to restore cursor position:", e);
            dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
          }
        } else {
          dispatch(state.tr.setSelection(Selection.atEnd(state.doc)));
        }
      }
    }, []);

    return (
      <div
        ref={containerRef}
        className={cn("relative h-full flex flex-col", className)}
        style={
          {
            "--editor-font-size": fontSize ? `${fontSize}px` : undefined,
            "--editor-line-height": lineHeight
              ? lineHeight.toString()
              : undefined,
          } as React.CSSProperties
        }
      >
        <ErrorBoundary>
          <div
            ref={editorRef}
            className="flex-1 overflow-y-auto outline-none prose-first-child-no-margin custom-scrollbar"
          />
        </ErrorBoundary>

        <AnimatePresence>
          {bubbleMenu.show && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              style={{
                position: "absolute",
                left: bubbleMenu.x,
                top: bubbleMenu.y,
                transform: "translateX(-50%)",
              }}
              className="z-[100] flex items-center gap-0.5 bg-zinc-900 border border-zinc-700/50 rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
            >
              {!isTypewriter && (
                <>
                  <button
                    onClick={() => handleFormat("h1")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.h1 && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Heading 1 (#)"
                  >
                    <Heading1 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("h2")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.h2 && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Heading 2 (##)"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("h3")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.h3 && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Heading 3 (###)"
                  >
                    <Heading3 className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3 bg-white/20 mx-0.5" />
                  <button
                    onClick={() => handleFormat("bold")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.bold && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Bold (Mod+B)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("italic")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.italic && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Italic (Mod+I)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("underline")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.underline && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Underline (Mod+U)"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("strike")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.strike && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Strikethrough (Mod+Shift+X)"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("quote")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.blockquote && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Quote"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("bullet")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.bullet && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Bullet List"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("code")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.code && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Code (Mod+E)"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("tableify")}
                    className="p-1.5 hover:bg-white/10 rounded text-white transition-colors"
                    title="Convert to Table"
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3 bg-white/20 mx-0.5" />
                  <button
                    onClick={() => handleFormat("alignLeft")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.alignLeft && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("alignCenter")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.alignCenter && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("alignRight")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.alignRight && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat("alignJustify")}
                    className={cn(
                      "p-1.5 hover:bg-white/10 rounded text-white transition-colors",
                      activeFormats.alignJustify && "bg-minimal-accent/20 text-minimal-accent"
                    )}
                    title="Justify"
                  >
                    <Layout className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3 bg-white/20 mx-0.5" />
                  <button
                    onClick={() => {
                      const url = window.prompt("Enter URL:");
                      if (url && viewRef.current) {
                        const { state, dispatch } = viewRef.current;
                        toggleMark(editorSchema.marks.link, { href: url })(
                          state,
                          dispatch,
                        );
                      }
                    }}
                    className="p-1.5 hover:bg-white/10 rounded text-white transition-colors"
                    title="Link"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (onImageUploadRequest) {
                        onImageUploadRequest();
                      } else {
                        const url = window.prompt("Enter Image URL:");
                        if (url && viewRef.current) {
                          const { state, dispatch } = viewRef.current;
                          const { from } = state.selection;
                          const node = editorSchema.nodes.image.create({
                            src: url,
                            alt: "Image",
                          });
                          dispatch(state.tr.insert(from, node));
                        }
                      }
                    }}
                    className="p-1.5 hover:bg-white/10 rounded text-white transition-colors"
                    title="Insert Image"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3 bg-white/20 mx-0.5" />
                </>
              )}

              <button
                onClick={() => handleAIAction("improve")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Improve Writing"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("summarize")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Summarize Selection"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("fix-grammar")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Fix Grammar"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleAIAction("expand")}
                disabled={isProcessingAI}
                className="p-1.5 hover:bg-minimal-accent/20 text-minimal-accent rounded transition-colors"
                title="Expand Selection"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-white/20 mx-0.5" />

              <div className="relative">
                <button
                  onClick={() => setShowAiPopover(!showAiPopover)}
                  disabled={isProcessingAI}
                  className={cn(
                    "p-1.5 rounded transition-all flex items-center gap-1",
                    isProcessingAI
                      ? "text-zinc-500 cursor-not-allowed"
                      : "hover:bg-minimal-accent/20 text-minimal-accent",
                    showAiPopover && "bg-minimal-accent/20",
                  )}
                  title="AI Writing Assistant"
                >
                  {isProcessingAI ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </motion.div>
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    AI
                  </span>
                </button>

                <AnimatePresence>
                  {showAiPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className={cn(
                        "absolute mb-3 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 flex flex-col gap-1 w-64 ring-1 ring-white/10",
                        bubbleMenu.y < 400
                          ? "top-full mt-3"
                          : "bottom-full mb-3",
                      )}
                    >
                      <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto pe-1 custom-scrollbar">
                        <div className="px-2 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 rounded-t-lg mb-1">
                          Editing
                        </div>
                        {[
                          {
                            id: "improve",
                            label: "Improve Writing",
                            icon: Wand2,
                          },
                          {
                            id: "fix-grammar",
                            label: "Fix Grammar",
                            icon: CheckCheck,
                          },
                          {
                            id: "shorten",
                            label: "Make Shorter",
                            icon: Minimize2,
                          },
                          {
                            id: "expand",
                            label: "Expand Selection",
                            icon: Maximize2,
                          },
                          {
                            id: "rewrite",
                            label: "Rewrite Section",
                            icon: RotateCcw,
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              handleAIAction(item.id as AIAssistantAction)
                            }
                            className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg text-left transition-colors"
                          >
                            <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                            <span className="text-xs text-zinc-300 font-medium">
                              {item.label}
                            </span>
                          </button>
                        ))}

                        <div className="px-2 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 mt-1 mb-1">
                          Structure
                        </div>
                        {[
                          {
                            id: "generate-outline",
                            label: "Create Outline",
                            icon: Layout,
                          },
                          {
                            id: "expand-outline",
                            label: "Draft from Outline",
                            icon: Zap,
                          },
                          {
                            id: "draft-topic",
                            label: "Draft Topic",
                            icon: ArrowRight,
                          },
                          {
                            id: "summarize",
                            label: "Summarize",
                            icon: FileText,
                          },
                          {
                            id: "suggest-title",
                            label: "Suggest Titles",
                            icon: Heading,
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              handleAIAction(item.id as AIAssistantAction)
                            }
                            className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg text-left transition-colors"
                          >
                            <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                            <span className="text-xs text-zinc-300 font-medium">
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {aiDraft && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              style={{
                position: "absolute",
                left: "2rem", // Align to text padding
                top: aiDraft.y,
              }}
              className="z-[150] flex flex-col items-start gap-2 max-w-full"
            >
              {aiDraft.isStreaming ? (
                <div className="flex items-center gap-2 bg-zinc-900 border border-minimal-accent/50 rounded-xl p-1.5 shadow-xl backdrop-blur-xl ring-1 ring-minimal-accent/20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-4 h-4 text-minimal-accent" />
                  </motion.div>
                  <span className="text-xs font-semibold text-minimal-accent pr-2">AI is Writing...</span>
                  <div className="w-px h-3 bg-zinc-700" />
                  <button
                    onClick={() => {
                       if (aiDraft.abortController) {
                           aiDraft.abortController.abort();
                       }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-400 hover:bg-white/10 hover:text-red-300 rounded"
                    title="Stop AI Generation"
                  >
                     <Square className="w-3.5 h-3.5 fill-current" /> Stop
                  </button>
                </div>
              ) : aiDraft.showActions ? (
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700/50 rounded-xl p-1 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                  <button
                    onClick={() => handleAIActionDecision("replace")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:bg-white/10 hover:text-emerald-300 rounded"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Replace
                  </button>
                  <div className="w-px h-4 bg-zinc-700" />
                  <button
                    onClick={() => handleAIActionDecision("append")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-minimal-accent hover:bg-white/10 hover:text-minimal-accent-hover rounded"
                  >
                    <Plus className="w-3.5 h-3.5" /> Append Below
                  </button>
                  <div className="w-px h-4 bg-zinc-700" />
                  <button
                    onClick={() => handleAIActionDecision("retry")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <div className="w-px h-4 bg-zinc-700" />
                  <button
                    onClick={() => handleAIActionDecision("cancel")}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-white/10 hover:text-red-300 rounded"
                  >
                    <XIcon className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {slashMenu.show && (
            <SlashMenu
              x={slashMenu.x}
              y={slashMenu.y}
              query={slashMenu.query}
              isAbsolute={true}
              onSelect={handleSlashSelect}
              onClose={() =>
                setSlashMenu((prev) => ({ ...prev, show: false, query: "" }))
              }
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sideMenu.show && !bubbleMenu.show && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              style={{
                position: "absolute",
                left: "-2rem",
                top: sideMenu.y,
              }}
              className="z-[50] flex items-center gap-0.5 group"
            >
              <button
                onClick={() => {
                  const coords = viewRef.current?.coordsAtPos(sideMenu.pos);
                  const editorRect =
                    containerRef.current?.getBoundingClientRect();
                  if (coords && editorRect) {
                    setSlashMenu({
                      x: coords.left - editorRect.left,
                      y: coords.bottom - editorRect.top + 5,
                      show: true,
                      pos: sideMenu.pos + 1,
                      query: "",
                    });
                  }
                }}
                className="p-1.5 hover:bg-minimal-accent/10 text-minimal-muted/40 hover:text-minimal-accent rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur"
                title="Add Block"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="p-1.5 text-minimal-muted/20 cursor-grab hover:text-minimal-muted transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              {sideMenu.nodeName === "heading" && (
                <>
                  <div className="w-px h-4 bg-minimal-border mx-0.5" />
                  <button
                    onClick={() => {
                      if (!viewRef.current) return;
                      const node = viewRef.current.state.doc.nodeAt(sideMenu.pos);
                      if (node && node.type.name === "heading") {
                        const slug = slugify(node.textContent);
                        const url = new URL(window.location.href);
                        url.hash = slug;
                        navigator.clipboard.writeText(url.toString());
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer bg-minimal-bg/50 backdrop-blur border border-transparent",
                      isCopied 
                        ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20" 
                        : "text-minimal-muted/40 hover:text-minimal-accent hover:bg-minimal-accent/10"
                    )}
                    title={isCopied ? "Copied!" : "Copy Anchor Link"}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {contextMenu.show && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: "absolute",
                left: contextMenu.x,
                top: contextMenu.y,
              }}
              className="z-[200] w-56 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <div className="px-2 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/30 rounded-t-lg mb-1">
                  Editing
                </div>
                {[
                  {
                    id: "bold",
                    label: "Bold",
                    icon: Bold,
                    action: () => handleFormat("bold"),
                  },
                  {
                    id: "italic",
                    label: "Italic",
                    icon: Italic,
                    action: () => handleFormat("italic"),
                  },
                  {
                    id: "underline",
                    label: "Underline",
                    icon: Underline,
                    action: () => handleFormat("underline"),
                  },
                  {
                    id: "strike",
                    label: "Strikethrough",
                    icon: Strikethrough,
                    action: () => handleFormat("strike"),
                  },
                  {
                    id: "code",
                    label: "Code Block",
                    icon: Code,
                    action: () => handleFormat("code"),
                  },
                  {
                    id: "focus",
                    label: isFocusMode
                      ? "Disable Focus"
                      : "Focus Active Paragraph",
                    icon: isFocusMode ? Minimize2 : Maximize2,
                    action: () => onToggleFocusMode?.(),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg text-left transition-colors text-zinc-300"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}

                <div className="h-px bg-zinc-800 my-1 mx-1" />

                <div className="px-2 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/30 mb-1">
                  AI Power
                </div>
                {[
                  {
                    id: "improve",
                    label: "Refine & Improve",
                    icon: Zap,
                    action: () => handleAIAction("improve"),
                  },
                  {
                    id: "fix-grammar",
                    label: "Fix Errors",
                    icon: CheckCheck,
                    action: () => handleAIAction("fix-grammar"),
                  },
                  {
                    id: "summarize",
                    label: "Summarize",
                    icon: FileText,
                    action: () => handleAIAction("summarize"),
                  },
                  {
                    id: "complete-text",
                    label: "Continue Writing",
                    icon: ArrowRight,
                    action: () => handleAIAction("complete-text"),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-minimal-accent/20 rounded-lg text-left transition-colors text-zinc-300"
                  >
                    <item.icon className="w-3.5 h-3.5 text-minimal-accent" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}

                <div className="h-px bg-zinc-800 my-1 mx-1" />

                <div className="px-2 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/30 mb-1">
                  Clipboard
                </div>
                {[
                  {
                    id: "copy",
                    label: "Copy as Markdown",
                    icon: Copy,
                    action: () => {
                      if (viewRef.current) {
                        const { state } = viewRef.current;
                        const { from, to } = state.selection;
                        const slice = state.selection.content();
                        const markdown = editorSerializer.serialize(
                          editorSchema.nodes.doc.create(null, slice.content),
                        );
                        const plainText = state.doc.textBetween(from, to, " ");

                        if (navigator.clipboard && navigator.clipboard.write) {
                          const textBlob = new Blob([plainText], {
                            type: "text/plain",
                          });
                          const markdownBlob = new Blob([markdown], {
                            type: "text/markdown",
                          });
                          const htmlBlob = new Blob(
                            [
                              DOMSerializer.fromSchema(
                                editorSchema,
                              ).serializeFragment(slice.content).textContent ||
                                "",
                            ],
                            { type: "text/html" },
                          );

                          try {
                            navigator.clipboard.write([
                              new ClipboardItem({
                                "text/plain": textBlob,
                                "text/markdown": markdownBlob,
                              }),
                            ]);
                          } catch (e) {
                            // Fallback to just text if writing multi-format fails
                            navigator.clipboard.writeText(
                              markdown || plainText,
                            );
                          }
                        } else {
                          navigator.clipboard.writeText(markdown || plainText);
                        }
                      }
                    },
                  },
                  {
                    id: "cut",
                    label: "Cut text",
                    icon: Scissors,
                    action: () => {
                      if (viewRef.current) {
                        const { state, dispatch } = viewRef.current;
                        const slice = state.selection.content();
                        const markdown = editorSerializer.serialize(
                          editorSchema.nodes.doc.create(null, slice.content),
                        );

                        navigator.clipboard.writeText(markdown);
                        dispatch(state.tr.deleteSelection());
                      }
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setContextMenu((prev) => ({ ...prev, show: false }));
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-zinc-800 rounded-lg text-left transition-colors text-zinc-400 hover:text-zinc-200"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

export default ProseMirrorEditor;
