import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { getKrokiUrl } from "./kroki";

export type UmlTheme = "dark" | "light";

export interface UmlPluginOptions {
  /** Resolve the current theme. Defaults to reading `data-theme` on <html>. */
  getTheme?: () => UmlTheme;
  /** Languages recognized as diagram sources rendered through Kroki. */
  languages?: readonly string[];
  /** Build the Kroki image URL. Defaults to `getKrokiUrl` from `./kroki`. */
  buildKrokiUrl?: (lang: string, source: string, theme: UmlTheme) => string | null;
}

export interface UmlPluginState {
  decorations: DecorationSet;
  expanded: Set<number>;
}

export const umlPluginKey = new PluginKey<UmlPluginState>("umlPlugin");

export const DEFAULT_UML_LANGS = [
  "mermaid",
  "plantuml",
  "graphviz",
  "ditaa",
  "erd",
  "blockdiag",
  "c4plantuml",
  "structurizr",
  "vega",
  "vegalite",
  "bpmn",
  "d2",
  "nomnoml",
  "rackdiag",
  "seqdiag",
  "actdiag",
  "nwdiag",
] as const;

const COLLAPSE_THRESHOLD = 25;

const defaultGetTheme = (): UmlTheme =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/** Renders the Kroki diagram preview (with lazy loading, toolbar and error state) for one code block. */
class UmlDiagramRenderer {
  dom: HTMLElement;
  img: HTMLImageElement | null = null;
  errorDOM: HTMLElement | null = null;
  toolbar: HTMLElement;
  observer: IntersectionObserver | null = null;
  updateImageTimeout: any = null;
  private node: any;
  private options: Required<UmlPluginOptions>;

  constructor(node: any, options: Required<UmlPluginOptions>) {
    this.node = node;
    this.options = options;

    this.dom = document.createElement("div");
    this.dom.className = "uml-diagram-wrapper";

    this.toolbar = document.createElement("div");
    this.toolbar.className = "uml-diagram-toolbar";
    this.dom.appendChild(this.toolbar);

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.scheduleUpdate();
        });
      },
      { rootMargin: "200px" },
    );
    this.observer.observe(this.dom);
  }

  scheduleUpdate() {
    if (this.updateImageTimeout) clearTimeout(this.updateImageTimeout);
    this.updateImageTimeout = setTimeout(() => this.updateImage(), 500);
  }

  updateImage() {
    const lang = (this.node.attrs.params || "").trim().toLowerCase();
    const theme = this.options.getTheme();
    const url = this.options.buildKrokiUrl(lang, this.node.textContent, theme);

    if (url) {
      if (!this.img) {
        this.img = document.createElement("img");
        this.img.className = "uml-diagram-preview";
        this.dom.appendChild(this.img);
      }

      this.img.src = url;
      this.dom.classList.add("is-rendering");

      if (this.errorDOM) {
        this.errorDOM.remove();
        this.errorDOM = null;
      }

      this.img.onload = () => {
        this.dom.classList.remove("is-rendering");
        this.updateToolbar(url);
      };

      this.img.onerror = () => {
        this.dom.classList.remove("is-rendering");
        this.showError("Failed to render diagram. Check your syntax.");
      };
    } else {
      this.clearPreview();
    }
  }

  showError(msg: string) {
    if (!this.errorDOM) {
      this.errorDOM = document.createElement("div");
      this.errorDOM.className =
        "uml-diagram-error flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm italic font-medium";
      this.errorDOM.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` + msg;
      this.dom.appendChild(this.errorDOM);
    }
    if (this.img) {
      this.img.remove();
      this.img = null;
    }
    this.toolbar.innerHTML = "";
  }

  updateToolbar(url: string) {
    this.toolbar.innerHTML = "";

    const copyBtn = document.createElement("button");
    copyBtn.className =
      "uml-toolbar-btn flex items-center gap-1 px-2 py-1 bg-minimal-sidebar text-minimal-muted hover:text-minimal-accent hover:bg-minimal-accent/10 rounded border border-minimal-border transition-all text-[10px] font-bold uppercase tracking-wider";
    copyBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    copyBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url);
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = original;
      }, 2000);
    };

    const openBtn = document.createElement("button");
    openBtn.className =
      "uml-toolbar-btn flex items-center gap-1 px-2 py-1 bg-minimal-sidebar text-minimal-muted hover:text-minimal-accent hover:bg-minimal-accent/10 rounded border border-minimal-border transition-all text-[10px] font-bold uppercase tracking-wider";
    openBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Open`;
    openBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, "_blank");
    };

    this.toolbar.appendChild(copyBtn);
    this.toolbar.appendChild(openBtn);
  }

  clearPreview() {
    this.dom.innerHTML = "";
    this.toolbar = document.createElement("div");
    this.toolbar.className = "uml-diagram-toolbar";
    this.dom.appendChild(this.toolbar);
    this.img = null;
    this.errorDOM = null;
    this.dom.classList.remove("is-rendering");
  }

  destroy() {
    if (this.updateImageTimeout) clearTimeout(this.updateImageTimeout);
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

function buildUmlDecorations(
  doc: any,
  expanded: Set<number>,
  options: Required<UmlPluginOptions>,
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== "code_block") return;

    const lang = (node.attrs.params || "").trim().toLowerCase();
    if (!options.languages.includes(lang)) return;

    const text = node.textContent || "";
    if (!text.trim()) return;

    const lineCount = text.split("\n").length;
    const isExpanded = expanded.has(pos);
    const theme = options.getTheme();
    const textHash = hashString(text);

    if (!isExpanded && lineCount > COLLAPSE_THRESHOLD) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: "uml-block uml-collapsed" }),
      );

      decorations.push(
        Decoration.widget(
          pos,
          (view) => {
            const btn = document.createElement("button");
            btn.className =
              "uml-expand-btn relative block mx-auto my-3 px-4 py-1.5 bg-zinc-900/95 text-zinc-300 hover:text-white rounded-full border border-zinc-700/60 text-[11px] font-bold shadow-xl backdrop-blur-md transition-all flex items-center gap-1.5 z-[10] hover:scale-105 active:scale-95 uppercase tracking-wider";
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> Show Full Snippet (${lineCount} lines)`;
            btn.onmousedown = (e) => {
              e.preventDefault();
              e.stopPropagation();
              view.dispatch(view.state.tr.setMeta(umlPluginKey, { type: "toggleExpand", pos }));
            };
            return btn;
          },
          { side: -1, key: `uml-expand-${pos}`, stopEvent: () => true },
        ),
      );
    } else {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: "uml-block" }),
      );
    }

    decorations.push(
      Decoration.widget(
        pos + node.nodeSize,
        (view) => {
          const renderer = new UmlDiagramRenderer(node, options);
          renderer.scheduleUpdate();
          (renderer.dom as any)._renderer = renderer;
          return renderer.dom;
        },
        {
          side: 1,
          key: `uml-diagram-${pos}-${lang}-${textHash}-${theme}`,
          stopEvent: () => true,
          destroy: (dom: HTMLElement) => {
            const renderer = (dom as any)._renderer as UmlDiagramRenderer | undefined;
            renderer?.destroy();
          },
        },
      ),
    );
  });

  return DecorationSet.create(doc, decorations);
}

export function createUmlPlugin(options: UmlPluginOptions = {}): Plugin<UmlPluginState> {
  const resolved: Required<UmlPluginOptions> = {
    getTheme: options.getTheme ?? defaultGetTheme,
    languages: options.languages ?? DEFAULT_UML_LANGS,
    buildKrokiUrl:
      options.buildKrokiUrl ?? ((lang, source, theme) => getKrokiUrl(lang, source, theme)),
  };

  return new Plugin<UmlPluginState>({
    key: umlPluginKey,
    state: {
      init(_, state) {
        return {
          decorations: buildUmlDecorations(state.doc, new Set(), resolved),
          expanded: new Set(),
        };
      },
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(umlPluginKey) as
          | { type: "toggleExpand"; pos: number }
          | { type: "refresh" }
          | undefined;

        if (meta && meta.type === "toggleExpand") {
          const expanded = new Set(prev.expanded);
          if (expanded.has(meta.pos)) expanded.delete(meta.pos);
          else expanded.add(meta.pos);
          return {
            decorations: buildUmlDecorations(newState.doc, expanded, resolved),
            expanded,
          };
        }

        let expanded = prev.expanded;
        if (prev.expanded.size) {
          const mapped = new Set<number>();
          prev.expanded.forEach((p) => {
            const m = tr.mapping.map(p);
            if (m !== null && m >= 0 && m <= newState.doc.content.size) mapped.add(m);
          });
          expanded = mapped;
        }

        if (tr.docChanged || (meta && meta.type === "refresh")) {
          return {
            decorations: buildUmlDecorations(newState.doc, expanded, resolved),
            expanded,
          };
        }

        return {
          decorations: prev.decorations.map(tr.mapping, newState.doc),
          expanded,
        };
      },
    },
    view(view) {
      const observer = new MutationObserver(() => {
        view.dispatch(view.state.tr.setMeta(umlPluginKey, { type: "refresh" }));
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return {
        destroy() {
          observer.disconnect();
        },
      };
    },
    props: {
      decorations(state) {
        return umlPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}
