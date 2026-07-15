export type DiagramSuccess = { ok: true; svg: string; engine: string };
export type DiagramFailure = { ok: false; error: string; engine: string };

export type DiagramRenderResult = DiagramSuccess | DiagramFailure;

export interface RenderOptions {
  theme: "dark" | "light";
  signal?: AbortSignal;
}

export type DiagramAdapter = (
  lang: string,
  source: string,
  opts: RenderOptions,
) => Promise<DiagramRenderResult>;
