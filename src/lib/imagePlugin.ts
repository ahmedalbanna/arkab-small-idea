class ImageNodeView {
  dom: HTMLElement;
  img: HTMLImageElement;
  caption: HTMLInputElement;
  toolbar: HTMLElement;
  resizer: HTMLElement;
  node: any;
  view: any;
  getPos: any;

  constructor(node: any, view: any, getPos: any) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className = "image-node-view-container group";
    this.dom.setAttribute("data-align", node.attrs.align || "center");
    this.dom.style.width = node.attrs.width || "100%";
    if (node.attrs.float && node.attrs.float !== "none") {
      this.dom.style.float = node.attrs.float;
      this.dom.classList.add(`float-${node.attrs.float}`);
    }

    // Alignment & Float Toolbar
    this.toolbar = document.createElement("div");
    this.toolbar.className = "image-alignment-toolbar";

    const createLayoutButton = (
      name: string,
      alignment: string,
      floatValue: string,
      iconSvg: string,
    ) => {
      const btn = document.createElement("button");
      const isActive = node.attrs.align === alignment && node.attrs.float === floatValue;
      btn.className = `align-btn ${isActive ? "active" : ""}`;
      btn.title = name;
      btn.innerHTML = iconSvg;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.updateLayout(alignment, floatValue);
      });
      return btn;
    };

    // Icons
    const ICONS = {
      left: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" x2="3" y1="6" y2="6"/><line x1="21" x2="3" y1="12" y2="12"/><line x1="15" x2="3" y1="18" y2="18"/></svg>`,
      center: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="6"/><line x1="21" x2="3" y1="12" y2="12"/><line x1="17" x2="7" y1="18" y2="18"/></svg>`,
      right: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="7" y1="6" y2="6"/><line x1="21" x2="3" y1="12" y2="12"/><line x1="21" x2="9" y1="18" y2="18"/></svg>`,
      floatLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8"/><line x1="15" x2="21" y1="5" y2="5"/><line x1="15" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="14" y2="14"/><line x1="3" x2="21" y1="18" y2="18"/></svg>`,
      floatRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="3" width="8" height="8"/><line x1="3" x2="9" y1="5" y2="5"/><line x1="3" x2="9" y1="9" y2="9"/><line x1="3" x2="21" y1="14" y2="14"/><line x1="3" x2="21" y1="18" y2="18"/></svg>`,
    };

    this.toolbar.appendChild(createLayoutButton("Float Left", "left", "left", ICONS.floatLeft));
    this.toolbar.appendChild(createLayoutButton("Align Left", "left", "none", ICONS.left));
    this.toolbar.appendChild(createLayoutButton("Align Center", "center", "none", ICONS.center));
    this.toolbar.appendChild(createLayoutButton("Align Right", "right", "none", ICONS.right));
    this.toolbar.appendChild(createLayoutButton("Float Right", "right", "right", ICONS.floatRight));
    this.dom.appendChild(this.toolbar);

    this.img = document.createElement("img");
    this.img.src = node.attrs.src;
    if (node.attrs.alt) this.img.alt = node.attrs.alt;
    this.img.className = "image-node-view-img";
    this.dom.appendChild(this.img);

    // Resizer handle
    this.resizer = document.createElement("div");
    this.resizer.className = "image-resizer-handle";
    this.dom.appendChild(this.resizer);

    this.resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = this.dom.offsetWidth;
      const parentWidth = this.dom.parentElement?.offsetWidth || 1;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        let newWidth = startWidth + deltaX;
        // Constraint: min 50px, max parent width
        newWidth = Math.max(50, Math.min(newWidth, parentWidth));
        const widthPercent = (newWidth / parentWidth) * 100 + "%";
        this.dom.style.width = widthPercent;
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        const finalWidth = this.dom.style.width;
        const pos = this.getPos();
        if (typeof pos === "number") {
          this.view.dispatch(
            this.view.state.tr.setNodeMarkup(pos, null, {
              ...this.node.attrs,
              width: finalWidth,
            }),
          );
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    this.caption = document.createElement("input");
    this.caption.className = "image-caption-input";
    this.caption.placeholder = "Write a caption...";
    this.caption.value = node.attrs.title || "";
    this.dom.appendChild(this.caption);

    this.caption.addEventListener("input", (e) => {
      const title = (e.target as HTMLInputElement).value;
      const pos = this.getPos();
      if (typeof pos === "number") {
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, null, {
            ...this.node.attrs,
            title,
          }),
        );
      }
    });

    this.caption.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });

    this.caption.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }

  updateLayout(align: string, float: string) {
    const pos = this.getPos();
    if (typeof pos === "number") {
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, null, {
          ...this.node.attrs,
          align,
          float,
        }),
      );
    }
  }

  update(node: any) {
    if (node.type !== this.node.type) return false;
    this.node = node;

    if (this.img.src !== node.attrs.src) this.img.src = node.attrs.src;
    if (this.caption.value !== (node.attrs.title || "")) {
      this.caption.value = node.attrs.title || "";
    }

    this.dom.setAttribute("data-align", node.attrs.align || "center");
    this.dom.style.width = node.attrs.width || "100%";

    // Reset float classes
    this.dom.classList.remove("float-left", "float-right");
    if (node.attrs.float && node.attrs.float !== "none") {
      this.dom.style.float = node.attrs.float;
      this.dom.classList.add(`float-${node.attrs.float}`);
    } else {
      this.dom.style.float = "none";
    }

    // Update active toolbar button
    const btns = this.toolbar.children;
    for (let i = 0; i < btns.length; i++) {
      const btn = btns[i] as HTMLElement;
      const title = btn.title;
      let active = false;
      if (title === "Float Left") active = node.attrs.float === "left";
      else if (title === "Align Left")
        active = node.attrs.align === "left" && node.attrs.float === "none";
      else if (title === "Align Center") active = node.attrs.align === "center";
      else if (title === "Align Right")
        active = node.attrs.align === "right" && node.attrs.float === "none";
      else if (title === "Float Right") active = node.attrs.float === "right";

      btn.className = `align-btn ${active ? "active" : ""}`;
    }

    return true;
  }

  stopEvent(event: Event) {
    return event.target === this.caption || event.target === this.resizer;
  }

  ignoreMutation() {
    return true;
  }
}
class GalleryNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  node: any;
  view: any;
  getPos: any;

  constructor(node: any, view: any, getPos: any) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("div");
    this.dom.className = `image-gallery image-gallery-${node.attrs.layout}`;

    this.contentDOM = document.createElement("div");
    this.contentDOM.className = "gallery-content";
    this.dom.appendChild(this.contentDOM);
  }

  update(node: any) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.className = `image-gallery image-gallery-${node.attrs.layout}`;
    return true;
  }
}

export function createImageNodeView() {
  return (node: any, view: any, getPos: any) => new ImageNodeView(node, view, getPos);
}

export function createGalleryNodeView() {
  return (node: any, view: any, getPos: any) => new GalleryNodeView(node, view, getPos);
}
