class ScribbleNodeView {
  dom: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  toolbar: HTMLElement;
  node: any;
  view: any;
  getPos: any;

  isDrawing = false;
  lastX = 0;
  lastY = 0;
  color = "#000000";
  brushSize = 3;
  mode: "draw" | "erase" = "draw";

  constructor(node: any, view: any, getPos: any) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className =
      "scribble-container group relative border border-minimal-border rounded-[2.5rem] overflow-hidden bg-minimal-bg my-8 transition-all hover:shadow-2xl hover:shadow-minimal-accent/5";
    this.dom.style.aspectRatio = (this.node.attrs.aspectRatio || 0.5).toString();

    this.canvas = document.createElement("canvas");
    this.canvas.className = "scribble-canvas touch-none cursor-crosshair block w-full h-full";
    this.dom.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;

    this.toolbar = document.createElement("div");
    this.toolbar.className =
      "scribble-toolbar absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0 bg-minimal-bg/90 backdrop-blur-xl p-2 rounded-2xl border border-minimal-border shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-10";
    this.dom.appendChild(this.toolbar);

    this.setupToolbar();
    this.setupCanvas();

    // Load after a short delay to ensure canvas dimensions are correct
    setTimeout(() => this.loadState(), 0);
  }

  setupToolbar() {
    const createBtn = (icon: string, title: string, onClick: () => void, isActive = false) => {
      const btn = document.createElement("button");
      btn.className = `p-2 rounded-xl transition-all flex items-center justify-center ${isActive ? "bg-minimal-accent text-minimal-bg shadow-lg shadow-minimal-accent/20" : "text-minimal-muted hover:bg-minimal-sidebar hover:text-minimal-text"}`;
      btn.title = title;
      btn.innerHTML = icon;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
        this.setupToolbar(); // Refresh state
      };
      return btn;
    };

    this.toolbar.innerHTML = "";

    const penIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pen-tool"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 5 5"/><path d="m8.5 8.5 1 1"/></svg>`;
    const eraserIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eraser"><path d="m7 21 14-14"/><path d="M11 21 21 11"/><path d="M22 22H2"/><path d="m12 21 10-10"/></svg>`;
    const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
    const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;

    this.toolbar.appendChild(
      createBtn(
        penIcon,
        "Pen",
        () => {
          this.mode = "draw";
        },
        this.mode === "draw",
      ),
    );
    this.toolbar.appendChild(
      createBtn(
        eraserIcon,
        "Eraser",
        () => {
          this.mode = "erase";
        },
        this.mode === "erase",
      ),
    );

    const divider = document.createElement("div");
    divider.className = "w-px h-4 bg-minimal-border mx-1";
    this.toolbar.appendChild(divider);

    const colors = ["#000000", "#ef4444", "#3b82f6", "#22c55e"];
    const theme = document.documentElement.getAttribute("data-theme");
    const adjustedColors = theme === "dark" ? ["#ffffff", "#f87171", "#60a5fa", "#4ade80"] : colors;

    adjustedColors.forEach((c) => {
      const colorBtn = document.createElement("button");
      colorBtn.className = `w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${this.color === c ? "border-minimal-accent scale-110 shadow-sm" : "border-transparent"}`;
      colorBtn.style.backgroundColor = c;
      colorBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.color = c;
        this.mode = "draw";
        this.setupToolbar();
      };
      this.toolbar.appendChild(colorBtn);
    });

    const divider2 = document.createElement("div");
    divider2.className = "w-px h-4 bg-minimal-border mx-1";
    this.toolbar.appendChild(divider2);

    this.toolbar.appendChild(
      createBtn(trashIcon, "Clear", () => {
        if (confirm("Clear this drawing?")) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.saveState();
        }
      }),
    );

    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-circle"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    this.toolbar.appendChild(
      createBtn(deleteIcon, "Delete Block", () => {
        if (confirm("Delete this scribble block?")) {
          const pos = this.getPos();
          this.view.dispatch(this.view.state.tr.delete(pos, pos + this.node.nodeSize));
        }
      }),
    );

    this.toolbar.appendChild(
      createBtn(downloadIcon, "Download", () => {
        const link = document.createElement("a");
        link.download = "scribble.png";
        link.href = this.canvas.toDataURL();
        link.click();
      }),
    );
  }

  setupCanvas() {
    const resizeCanvas = () => {
      const rect = this.dom.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Save current content
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tCtx = tempCanvas.getContext("2d");
      if (tCtx) tCtx.drawImage(this.canvas, 0, 0);

      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);

      // Restore content scaled
      this.ctx.drawImage(
        tempCanvas,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
        0,
        0,
        rect.width,
        rect.height,
      );
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
    };

    window.addEventListener("resize", resizeCanvas);

    const startDrawing = (e: PointerEvent) => {
      this.isDrawing = true;
      const rect = this.canvas.getBoundingClientRect();
      this.lastX = e.clientX - rect.left;
      this.lastY = e.clientY - rect.top;

      // Start a point immediately so dots work
      this.ctx.beginPath();
      this.ctx.arc(this.lastX, this.lastY, this.brushSize / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.mode === "erase" ? "white" : this.color;
      this.ctx.fill();
    };

    const draw = (e: PointerEvent) => {
      if (!this.isDrawing) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);

      if (this.mode === "erase") {
        this.ctx.globalCompositeOperation = "destination-out";
        this.ctx.lineWidth = 20;
      } else {
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.brushSize;
      }

      this.ctx.stroke();

      this.lastX = x;
      this.lastY = y;
    };

    const stopDrawing = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.saveState();
      }
    };

    this.canvas.addEventListener("pointerdown", startDrawing);
    this.canvas.addEventListener("pointermove", draw);
    this.canvas.addEventListener("pointerup", stopDrawing);
    this.canvas.addEventListener("pointerleave", stopDrawing);

    // Initial resize
    setTimeout(resizeCanvas, 100);
  }

  loadState() {
    if (this.node.attrs.data) {
      const img = new Image();
      img.onload = () => {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = this.node.attrs.data;
    }
  }

  saveState() {
    const dataUrl = this.canvas.toDataURL("image/png");
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
        ...this.node.attrs,
        data: dataUrl,
      }),
    );
  }

  update(node: any) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    return true;
  }

  ignoreSelection() {
    return true;
  }

  stopEvent(_event: any) {
    return true;
  }
}

export function createScribbleNodeView() {
  return (node: any, view: any, getPos: any) => new ScribbleNodeView(node, view, getPos);
}
