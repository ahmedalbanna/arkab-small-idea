import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import DOMPurify from "dompurify";
import type { DiagramFailure } from "./diagrams/types";
import { renderDiagram } from "./diagrams/engine";
import { resolveTheme } from "./diagrams/theme";
import { saveAs } from "file-saver";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DiagramNodeViewOptions {
  /** Reserved for future configuration (e.g. max render size). */
}

/**
 * Creates a ProseMirror NodeView constructor for the `diagram` node.
 * Renders the diagram inline, and supports a click-to-edit inline overlay:
 * clicking the preview opens a source editor; blur / Esc / Cmd/Ctrl+Enter
 * collapses back to the live preview.
 */
export function createDiagramNodeView(_options: DiagramNodeViewOptions = {}) {
  return (node: PMNode, view: EditorView, getPos: () => number | undefined) =>
    new DiagramNodeView(node, view, getPos);
}

class DiagramNodeView {
  dom: HTMLElement;
  private node: PMNode;
  private view: EditorView;
  private getPos: () => number | undefined;

  private previewEl: HTMLElement;
  private toolbarEl: HTMLElement;
  private editorEl: HTMLTextAreaElement;
  private errorEl: HTMLElement | null = null;
  private placeholderEl: HTMLElement | null = null;

  private editing = false;
  private renderToken = 0;
  private renderTimer: number | null = null;
  private inputTimer: number | null = null;
  private themeObserver: MutationObserver;
  private lastSvg: string | null = null;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className = "diagram-block";
    this.dom.setAttribute("data-lang", node.attrs.lang || "");
    this.dom.setAttribute("contenteditable", "false");

    this.previewEl = document.createElement("div");
    this.previewEl.className = "diagram-preview";
    this.dom.appendChild(this.previewEl);

    this.toolbarEl = document.createElement("div");
    this.toolbarEl.className = "diagram-toolbar";
    this.dom.appendChild(this.toolbarEl);

    this.editorEl = document.createElement("textarea");
    this.editorEl.className = "diagram-editor";
    this.editorEl.spellcheck = false;
    this.dom.appendChild(this.editorEl);

    this.buildToolbar();

    this.previewEl.addEventListener("click", () => this.startEditing());
    this.editorEl.addEventListener("input", () => this.onInput());
    this.editorEl.addEventListener("blur", () => this.stopEditing());
    this.editorEl.addEventListener("keydown", (e) => this.onKeydown(e));

    this.themeObserver = new MutationObserver(() => this.scheduleRender());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    this.scheduleRender();
  }

  private buildToolbar() {
    this.toolbarEl.innerHTML = "";

    const mk = (label: string, title: string, onClick: () => void, extraClass = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "diagram-toolbar-btn " + extraClass;
      btn.textContent = label;
      btn.title = title;
      // Prevent ProseMirror from hijacking the mousedown on toolbar buttons.
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return btn;
    };

    this.toolbarEl.appendChild(
      mk("Edit", "Edit diagram source", () => this.startEditing(), "diagram-edit-btn"),
    );
    this.toolbarEl.appendChild(mk("Copy", "Copy source", () => this.copySource()));
    this.toolbarEl.appendChild(mk("SVG", "Download as SVG", () => this.downloadSvg()));
    this.toolbarEl.appendChild(mk("Open", "Open rendered diagram", () => this.openDiagram()));
    this.toolbarEl.appendChild(
      mk("Delete", "Delete diagram", () => this.deleteNode(), "diagram-delete-btn"),
    );
  }

  private startEditing() {
    if (this.editing) {
      this.editorEl.focus();
      return;
    }
    this.editing = true;
    this.editorEl.value = this.node.attrs.source || "";
    this.editorEl.classList.add("is-active");
    this.dom.classList.add("is-editing");
    this.previewEl.classList.add("is-editing");
    this.editorEl.focus();
    const len = this.editorEl.value.length;
    this.editorEl.setSelectionRange(len, len);
  }

  private stopEditing() {
    if (!this.editing) return;
    this.editing = false;
    this.editorEl.classList.remove("is-active");
    this.dom.classList.remove("is-editing");
    this.previewEl.classList.remove("is-editing");
    this.scheduleRender();
  }

  private onInput() {
    if (this.inputTimer) window.clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => this.commitSource(), 350);
  }

  private commitSource() {
    const pos = this.getPos();
    if (pos === undefined) return;
    const text = this.editorEl.value;
    if (text === this.node.attrs.source) return;
    const tr = this.view.state.tr.setNodeAttribute(pos, "source", text);
    this.view.dispatch(tr);
  }

  private onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.stopEditing();
      this.editorEl.blur();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      this.stopEditing();
      this.editorEl.blur();
    }
  }

  private copySource() {
    const text = this.node.attrs.source || "";
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  private downloadSvg() {
    if (!this.lastSvg) return;
    const blob = new Blob([this.lastSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    saveAs(url, `diagram.${(this.node.attrs.lang || "diagram").replace(/\W+/g, "-")}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private openDiagram() {
    if (!this.lastSvg) return;
    const blob = new Blob([this.lastSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private deleteNode() {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.delete(pos, pos + this.node.nodeSize);
    this.view.dispatch(tr);
  }

  private scheduleRender() {
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderToken++;
      void this.render(this.renderToken);
    }, 60);
  }

  private async render(token: number) {
    const lang = this.node.attrs.lang || "";
    const source = this.node.attrs.source || "";
    const theme = resolveTheme(document.documentElement.getAttribute("data-theme"));

    if (!source.trim()) {
      if (token === this.renderToken) this.showPlaceholder();
      return;
    }

    this.clearError();
    this.clearPlaceholder();
    this.previewEl.classList.add("is-rendering");

    try {
      const result = await renderDiagram(lang, source, { theme });
      if (token !== this.renderToken) return; // a newer render superseded this one
      this.previewEl.classList.remove("is-rendering");
      if (result.ok) {
        this.lastSvg = result.svg;
        // Sanitize the SVG to prevent XSS from untrusted diagram sources
        // (e.g. malicious mermaid/vega/graphviz output, or compromised Kroki).
        // ALLOWED TAGS include SVG elements; script/on* handlers are stripped.
        const cleanSvg = DOMPurify.sanitize(result.svg, {
          ALLOWED_TAGS: [
            "svg",
            "g",
            "path",
            "rect",
            "circle",
            "ellipse",
            "line",
            "polyline",
            "polygon",
            "text",
            "tspan",
            "tref",
            "defs",
            "pattern",
            "linearGradient",
            "radialGradient",
            "stop",
            "mask",
            "clipPath",
            "marker",
            "use",
            "filter",
            "feGaussianBlur",
            "feOffset",
            "feMerge",
            "feMergeNode",
            "feFlood",
            "feComposite",
            "image",
          ],
          ALLOWED_ATTR: [
            "d",
            "x",
            "y",
            "x1",
            "y1",
            "x2",
            "y2",
            "cx",
            "cy",
            "r",
            "rx",
            "ry",
            "width",
            "height",
            "viewBox",
            "preserveAspectRatio",
            "transform",
            "fill",
            "stroke",
            "stroke-width",
            "stroke-linecap",
            "stroke-linejoin",
            "stroke-dasharray",
            "stroke-dashoffset",
            "fill-opacity",
            "opacity",
            "font-family",
            "font-size",
            "font-weight",
            "text-anchor",
            "class",
            "id",
            "style",
            "href",
            "xlink:href",
            "xmlns",
            "xmlns:xlink",
            "data-*",
            "marker-end",
            "marker-start",
            "marker-mid",
          ],
          ADD_ATTR: ["data-*"],
          FORBID_ATTR: [
            "onload",
            "onerror",
            "onclick",
            "onmouseover",
            "onfocus",
            "onanimationstart",
          ],
        });
        this.previewEl.innerHTML = cleanSvg;
        this.decorateSvg();
      } else if (!result.ok) {
        this.showError((result as DiagramFailure).error);
      }
    } catch (e: unknown) {
      if (token !== this.renderToken) return;
      this.previewEl.classList.remove("is-rendering");
      if (e instanceof Error && e.name === "AbortError") return;
      this.showError(e instanceof Error ? e.message : "Failed to render diagram.");
    }
  }

  /** Make the embedded SVG fluid and remove fixed dimensions. */
  private decorateSvg() {
    const svg = this.previewEl.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
  }

  private showError(message: string) {
    this.previewEl.classList.remove("is-rendering");
    this.previewEl.innerHTML = "";
    if (!this.errorEl) {
      this.errorEl = document.createElement("div");
      this.errorEl.className = "diagram-error";
      this.previewEl.appendChild(this.errorEl);
    }
    this.errorEl.textContent = message;
  }

  private clearError() {
    if (this.errorEl) {
      this.errorEl.remove();
      this.errorEl = null;
    }
  }

  private showPlaceholder() {
    this.previewEl.classList.remove("is-rendering");
    this.previewEl.innerHTML = "";
    if (!this.placeholderEl) {
      this.placeholderEl = document.createElement("div");
      this.placeholderEl.className = "diagram-placeholder";
      this.placeholderEl.textContent = "Empty diagram — click to add source";
    }
    this.previewEl.appendChild(this.placeholderEl);
  }

  private clearPlaceholder() {
    if (this.placeholderEl) {
      this.placeholderEl.remove();
      this.placeholderEl = null;
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    const langChanged = node.attrs.lang !== this.node.attrs.lang;
    const sourceChanged = node.attrs.source !== this.node.attrs.source;
    if (!langChanged && !sourceChanged) return true;

    this.node = node;
    this.dom.setAttribute("data-lang", node.attrs.lang || "");

    if (this.editing) {
      if (sourceChanged && this.editorEl.value !== node.attrs.source) {
        this.editorEl.value = node.attrs.source || "";
      }
    } else {
      this.scheduleRender();
    }
    return true;
  }

  /** Keep ProseMirror from handling events on our interactive controls. */
  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    if (target === this.editorEl) return true;
    if (this.toolbarEl.contains(target as Node)) return true;
    return false;
  }

  destroy() {
    this.themeObserver.disconnect();
    if (this.renderTimer) window.clearTimeout(this.renderTimer);
    if (this.inputTimer) window.clearTimeout(this.inputTimer);
    this.renderToken = 0;
  }
}
