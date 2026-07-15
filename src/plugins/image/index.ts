import type { InkPlugin } from "../types";
import { createImageNodeView, createGalleryNodeView } from "../../lib/imagePlugin";

export const imagePlugin: InkPlugin = {
  id: "image",
  name: "Images & Gallery",
  version: "1.0.0",
  init(ctx) {
    ctx.registerNodeView({ name: "image", view: createImageNodeView() });
    ctx.registerNodeView({ name: "gallery", view: createGalleryNodeView() });
  },
};

export default imagePlugin;
