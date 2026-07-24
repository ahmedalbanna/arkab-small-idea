import { strokeToPathD, hitTestStrokes } from "./scribbleTypes";
import type { Stroke } from "./scribbleTypes";

let strokeIdCounter = 0;
function nextStrokeId(): string {
  strokeIdCounter++;
  return `s${strokeIdCounter}-${Date.now().toString(36)}`;
}

/**
 * ProseMirror NodeView for the `scribble` block.
 *
 * Renders an inline <svg> with one <path> per stroke.  New strokes are
 * accumulated as point arrays in the node's `strokes` attr; each completed
 * stroke (or whole-stroke erase) dispatches a single `setNodeMarkup` so
 * ProseMirror's history plugin gives per-stroke undo/redo for free.
 *
 * Legacy documents (pre-stroke-model) carry a base64 PNG in the `data` attr.
 * Those are rendered as a static <image> layer behind any new vector strokes.
 */
class ScribbleNodeView {
  dom: HTMLElement;
  svg: SVGSVGElement;
  /** The <g> inside the SVG that holds the <path> elements for each stroke. */
  strokeGroup: SVGGElement;
  /** The <path> element for the stroke currently being drawn (null when idle). */
  activePath: SVGPathElement | null = null;
  /** The <image> element for legacy background data (null if none). */
  bgImage: SVGImageElement | null = null;
  toolbar: HTMLElement;

  node: any;
  view: any;
  getPos: any;

  /** Points of the in-progress stroke. */
  currentPoints: [number, number][] = [];
  color = "#000000";
  strokeWidth = 3;
  mode: "draw" | "erase" = "draw";

  /** Ref to the SVG's viewBox so we can scale pointer coords properly. */
  private svgRect: DOMRect | null = null;

  /** Whether this view has been destroyed (guards against double-free). */
  private destroyed = false;

  // Bound event handlers for cleanup.
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerLeave: (e: PointerEvent) => void;

  constructor(node: any, view: any, getPos: any) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // ── Container ──
    this.dom = document.createElement("div");
    this.dom.className =
      "scribble-block group relative border border-minimal-border rounded-[2.5rem] overflow-hidden bg-minimal-bg my-8 transition-all hover:shadow-2xl hover:shadow-minimal-accent/5";
    // Fix the aspect ratio so the SVG scales correctly.
    this.dom.style.aspectRatio = String(this.node.attrs.aspectRatio || 0.5);

    // ── SVG layer ──
    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg") as SVGSVGElement;
    this.svg.setAttribute("viewBox", `0 0 1000 ${1000 * (this.node.attrs.aspectRatio || 0.5)}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.svg.style.width = "100%";
    this.svg.style.height = "100%";
    this.svg.style.display = "block";
    this.svg.style.cursor = "crosshair";
    this.dom.appendChild(this.svg);

    // Legacy background image (pre-stroke-model).
    this.renderBackground();

    // Stroke group — paths are rendered inside here.
    this.strokeGroup = document.createElementNS(ns, "g") as SVGGElement;
    this.svg.appendChild(this.strokeGroup);

    // Render existing strokes.
    this.renderStrokes();

    // ── Toolbar ──
    this.toolbar = document.createElement("div");
    this.toolbar.className =
      "scribble-toolbar absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0 bg-minimal-bg/90 backdrop-blur-xl p-2 rounded-2xl border border-minimal-border shadow-[0_10px_30px_rgba(0,0,0,0.1)]";
    this.dom.appendChild(this.toolbar);
    this.setupToolbar();

    // ── Pointer events ──
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundPointerLeave = this.onPointerLeave.bind(this);

    this.svg.addEventListener("pointerdown", this.boundPointerDown);
    this.svg.addEventListener("pointermove", this.boundPointerMove);
    this.svg.addEventListener("pointerup", this.boundPointerUp);
    this.svg.addEventListener("pointerleave", this.boundPointerLeave);
  }

  // ── Rendering helpers ──

  /** Render the legacy background <image> if `data` is present. */
  private renderBackground() {
    const ns = "http://www.w3.org/2000/svg";
    if (this.node.attrs.data && !this.bgImage) {
      this.bgImage = document.createElementNS(ns, "image") as SVGImageElement;
      this.bgImage.setAttribute("href", this.node.attrs.data);
      this.bgImage.setAttribute("width", "100%");
      this.bgImage.setAttribute("height", "100%");
      this.bgImage.setAttribute("preserveAspectRatio", "xMidYMid meet");
      this.svg.insertBefore(this.bgImage, this.svg.firstChild);
    }
  }

  /** Rebuild all stroke <path> elements from the node's `strokes` attr. */
  private renderStrokes() {
    const ns = "http://www.w3.org/2000/svg";
    // Clear existing paths.
    while (this.strokeGroup.firstChild) {
      this.strokeGroup.removeChild(this.strokeGroup.firstChild);
    }
    const strokes: Stroke[] = this.node.attrs.strokes || [];
    for (const s of strokes) {
      const path = document.createElementNS(ns, "path") as SVGPathElement;
      path.setAttribute("d", strokeToPathD(s.points));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", String(s.width));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("data-stroke-id", s.id);
      this.strokeGroup.appendChild(path);
    }
  }

  /** Convert a PointerEvent's clientX/clientY to SVG viewBox coordinates. */
  private svgPoint(e: PointerEvent): [number, number] {
    const rect = this.svg.getBoundingClientRect();
    const vbx = this.svg.viewBox.animVal;
    const x = ((e.clientX - rect.left) / rect.width) * vbx.width;
    const y = ((e.clientY - rect.top) / rect.height) * vbx.height;
    return [x, y];
  }

  // ── Pointer handlers ──

  private onPointerDown(e: PointerEvent) {
    if (this.destroyed) return;
    e.preventDefault();
    this.svg.setPointerCapture(e.pointerId);
    const pt = this.svgPoint(e);

    if (this.mode === "erase") {
      // Erase: try to delete the stroke under the pointer immediately.
      const strokes: Stroke[] = this.node.attrs.strokes || [];
      const hitId = hitTestStrokes(pt, strokes, this.strokeWidth * 2);
      if (hitId) {
        const remaining = strokes.filter((s) => s.id !== hitId);
        this.dispatchStrokes(remaining);
      }
      return;
    }

    // Draw: start accumulating points.
    this.currentPoints = [pt];

    // Create a temporary <path> for the in-progress stroke.
    const ns = "http://www.w3.org/2000/svg";
    this.activePath = document.createElementNS(ns, "path") as SVGPathElement;
    this.activePath.setAttribute("fill", "none");
    this.activePath.setAttribute("stroke", this.color);
    this.activePath.setAttribute("stroke-width", String(this.strokeWidth));
    this.activePath.setAttribute("stroke-linecap", "round");
    this.activePath.setAttribute("stroke-linejoin", "round");
    this.activePath.setAttribute("d", strokeToPathD(this.currentPoints));
    this.strokeGroup.appendChild(this.activePath);
  }

  private onPointerMove(e: PointerEvent) {
    if (this.destroyed) return;
    const pt = this.svgPoint(e);

    if (this.mode === "erase") {
      // Show a visual indicator at the eraser location.
      // We don't continuously erase — only on pointerdown.
      return;
    }

    if (!this.activePath) return; // not currently drawing
    this.currentPoints.push(pt);
    this.activePath.setAttribute("d", strokeToPathD(this.currentPoints));
  }

  private onPointerUp(_e: PointerEvent) {
    if (this.destroyed) return;

    if (this.mode === "draw" && this.activePath) {
      const strokes: Stroke[] = this.node.attrs.strokes || [];
      // Only commit if we have at least one point beyond the initial one.
      if (this.currentPoints.length > 1) {
        const newStroke: Stroke = {
          id: nextStrokeId(),
          color: this.color,
          width: this.strokeWidth,
          mode: "draw",
          points: this.currentPoints,
        };
        this.dispatchStrokes([...strokes, newStroke]);
      }
    }

    this.currentPoints = [];
    this.activePath = null;
  }

  private onPointerLeave(_e: PointerEvent) {
    // If the pointer leaves the SVG while drawing, cancel the stroke.
    if (this.activePath) {
      this.activePath.remove();
      this.activePath = null;
      this.currentPoints = [];
    }
  }

  /** Dispatch a `setNodeMarkup` transaction with the given strokes array. */
  private dispatchStrokes(strokes: Stroke[]) {
    const tr = this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
      ...this.node.attrs,
      strokes,
    });
    this.view.dispatch(tr);
  }

  // ── Toolbar ──

  private setupToolbar() {
    const createBtn = (icon: string, title: string, onClick: () => void, isActive = false) => {
      const btn = document.createElement("button");
      btn.className = `p-2 rounded-xl transition-all flex items-center justify-center ${
        isActive
          ? "bg-minimal-accent text-minimal-bg shadow-lg shadow-minimal-accent/20"
          : "text-minimal-muted hover:bg-minimal-sidebar hover:text-minimal-text"
      }`;
      btn.title = title;
      btn.innerHTML = icon;
      btn.onclick = (e) => {
        if (this.destroyed) return;
        e.preventDefault();
        e.stopPropagation();
        onClick();
        this.setupToolbar();
      };
      return btn;
    };

    this.toolbar.innerHTML = "";

    const penIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 5 5"/><path d="m8.5 8.5 1 1"/></svg>';
    const eraserIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21 14-14"/><path d="M11 21 21 11"/><path d="M22 22H2"/><path d="m12 21 10-10"/></svg>';

    this.toolbar.appendChild(
      createBtn(penIcon, "Pen", () => (this.mode = "draw"), this.mode === "draw"),
    );
    this.toolbar.appendChild(
      createBtn(eraserIcon, "Eraser", () => (this.mode = "erase"), this.mode === "erase"),
    );

    const divider = document.createElement("div");
    divider.className = "w-px h-4 bg-minimal-border mx-1";
    this.toolbar.appendChild(divider);

    // Color swatches + custom colour picker.
    const swatches = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];
    const theme = document.documentElement.getAttribute("data-theme");
    const adjustedSwatches =
      theme === "dark"
        ? ["#ffffff", "#f87171", "#60a5fa", "#4ade80", "#fbbf24", "#a78bfa"]
        : swatches;

    for (const c of adjustedSwatches) {
      const btn = document.createElement("button");
      btn.className = `w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${
        this.color === c ? "border-minimal-accent scale-110 shadow-sm" : "border-transparent"
      }`;
      btn.style.backgroundColor = c;
      btn.onclick = (e) => {
        if (this.destroyed) return;
        e.preventDefault();
        e.stopPropagation();
        this.color = c;
        this.mode = "draw";
        this.setupToolbar();
      };
      this.toolbar.appendChild(btn);
    }

    // Native colour picker for custom colours.
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = this.color;
    picker.title = "Custom colour";
    picker.className = "w-6 h-6 rounded-full border-2 border-minimal-border cursor-pointer p-0";
    picker.style.background = "none";
    picker.addEventListener("input", (e) => {
      if (this.destroyed) return;
      this.color = (e.target as HTMLInputElement).value;
      this.mode = "draw";
      this.setupToolbar();
    });
    picker.addEventListener("mousedown", (e) => e.stopPropagation());
    this.toolbar.appendChild(picker);

    const divider2 = document.createElement("div");
    divider2.className = "w-px h-4 bg-minimal-border mx-1";
    this.toolbar.appendChild(divider2);

    // Stroke-width slider.
    const widthLabel = document.createElement("span");
    widthLabel.className = "text-[9px] font-bold text-minimal-muted tracking-wider";
    widthLabel.textContent = "W";
    this.toolbar.appendChild(widthLabel);

    const widthSlider = document.createElement("input");
    widthSlider.type = "range";
    widthSlider.min = "1";
    widthSlider.max = "20";
    widthSlider.value = String(this.strokeWidth);
    widthSlider.title = "Stroke width";
    widthSlider.className = "w-16 h-1 accent-minimal-accent cursor-pointer";
    widthSlider.addEventListener("input", (e) => {
      if (this.destroyed) return;
      this.strokeWidth = parseInt((e.target as HTMLInputElement).value, 10);
    });
    widthSlider.addEventListener("mousedown", (e) => e.stopPropagation());
    this.toolbar.appendChild(widthSlider);

    const widthVal = document.createElement("span");
    widthVal.className = "text-[9px] font-mono text-minimal-muted min-w-[14px] text-right";
    widthVal.textContent = String(this.strokeWidth);
    this.toolbar.appendChild(widthVal);
    widthSlider.addEventListener("input", () => {
      widthVal.textContent = widthSlider.value;
    });

    const divider3 = document.createElement("div");
    divider3.className = "w-px h-4 bg-minimal-border mx-1";
    this.toolbar.appendChild(divider3);

    // Clear.
    const trashIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
    this.toolbar.appendChild(
      createBtn(trashIcon, "Clear All", () => {
        if (this.destroyed) return;
        if (confirm("Clear all strokes?")) {
          this.dispatchStrokes([]);
        }
      }),
    );

    // Delete block.
    const closeIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>';
    this.toolbar.appendChild(
      createBtn(closeIcon, "Delete Block", () => {
        if (this.destroyed) return;
        if (confirm("Delete this scribble block?")) {
          const pos = this.getPos();
          this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
        }
      }),
    );

    // Download PNG.
    const downloadIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';
    this.toolbar.appendChild(
      createBtn(downloadIcon, "Download PNG", () => {
        if (this.destroyed) return;
        this.downloadPng();
      }),
    );
  }

  // ── Download ──

  /** Rasterise the SVG (and background image, if any) to a PNG and trigger download. */
  private downloadPng() {
    const rect = this.svg.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;

    // Serialise the SVG to a data URL and draw it onto the canvas.
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const img = new Image();
    img.onload = () => {
      ctx.scale(dpr, dpr);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      const link = document.createElement("a");
      link.download = "scribble.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  // ── ProseMirror NodeView lifecycle ──

  update(node: any): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;

    // Update background image if data attr changed.
    const ns = "http://www.w3.org/2000/svg";
    if (this.node.attrs.data) {
      if (this.bgImage) {
        this.bgImage.setAttribute("href", this.node.attrs.data);
      } else {
        this.renderBackground();
      }
    } else if (this.bgImage) {
      this.bgImage.remove();
      this.bgImage = null;
    }

    // Rebuild stroke paths.
    this.renderStrokes();
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  ignoreSelection(): boolean {
    return true;
  }

  stopEvent(_event: any): boolean {
    return true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.svg.removeEventListener("pointerdown", this.boundPointerDown);
    this.svg.removeEventListener("pointermove", this.boundPointerMove);
    this.svg.removeEventListener("pointerup", this.boundPointerUp);
    this.svg.removeEventListener("pointerleave", this.boundPointerLeave);

    this.activePath = null;
    this.currentPoints = [];
  }
}

export function createScribbleNodeView() {
  return (node: any, view: any, getPos: any) => new ScribbleNodeView(node, view, getPos);
}
