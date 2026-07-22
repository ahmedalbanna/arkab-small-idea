/**
 * Shared export utilities: image processing, blob download, progress reporting.
 */

/** Progress event emitted during export operations */
export interface ExportProgressEvent {
  stage: "preparing" | "rendering" | "packaging" | "downloading" | "error";
  percent: number;
  message?: string;
}

/** Type for progress callback */
export type ExportProgressCallback = (event: ExportProgressEvent) => void;

/** No-op progress handler */
export const noopProgress: ExportProgressCallback = () => {};

/** Fetch image data as Uint8Array for embedding in DOCX */
export async function getImageData(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Rasterizes an SVG string to a PNG byte array for embedding in DOCX/PDF.
 * Maintains aspect ratio while respecting maxWidth.
 */
export async function svgToPng(svg: string, maxWidth = 800): Promise<Uint8Array | null> {
  try {
    if (typeof document === "undefined") return null;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG load failed"));
      img.src = url;
    });
    const w = img.naturalWidth || img.width || maxWidth;
    const h = img.naturalHeight || img.height || Math.round(w * 0.6);
    const scale = Math.min(1, maxWidth / Math.max(w, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    URL.revokeObjectURL(url);
    const base64 = dataUrl.split(",")[1];
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Extract inset dimensions from an image URL by loading it in a hidden canvas.
 * Returns { width, height, aspectRatio } or null on failure.
 */
export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export async function getImageDimensions(url: string): Promise<ImageDimensions | null> {
  try {
    if (typeof document === "undefined") return null;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
    const w = img.naturalWidth || img.width || 600;
    const h = img.naturalHeight || img.height || 400;
    return { width: w, height: h, aspectRatio: w / Math.max(h, 1) };
  } catch {
    return null;
  }
}

/**
 * Trigger a file download via a temporary anchor element.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
