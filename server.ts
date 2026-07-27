import express from "express";
import { createServer as createViteServer } from "vite";
import * as http from "http";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// --- Request body schemas (validated before forwarding to Ollama) ---
const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string().optional(),
  parts: z.array(z.any()).optional(),
  images: z.array(z.string()).optional(),
});

const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

const generateBodySchema = z.object({
  prompt: z.string(),
  system: z.string().optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

const embeddingsBodySchema = z.object({
  model: z.string().optional(),
  prompt: z.string(),
});

/** Generic message returned to clients; details are logged server-side only. */
const GENERIC_ERROR = "Upstream AI service error. Check server logs for details.";

/**
 * Streams an NDJSON response body to the Express response, writing each
 * chunk as it arrives. Used by both /api/ai/chat and /api/ai/generate.
 */
async function pipeNdjson(response: Response, res: express.Response): Promise<void> {
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = response.body?.getReader();
  if (!reader) {
    res.status(502).json({ error: "Upstream returned an empty response body." });
    return;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (streamErr) {
    console.error("Stream reading error:", streamErr);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming connection interrupted." });
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

/**
 * Proxies a POST request to the Ollama API, handling validation, fetch,
 * streaming vs non-streaming response, and consistent error handling.
 */
async function proxyOllamaRequest<T extends z.ZodTypeAny>(
  req: express.Request,
  res: express.Response,
  ollamaPath: string,
  logLabel: string,
  bodySchema: T,
  buildFetchBody: (data: z.infer<T>) => Record<string, unknown>,
): Promise<void> {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    const data = parsed.data;
    const body = buildFetchBody(data);

    const response = await fetch(`${OLLAMA_HOST}${ollamaPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: body.stream ?? true }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ollama ${logLabel} error: ${response.status} - ${errorText}`);
      throw new Error(GENERIC_ERROR);
    }

    if (body.stream !== false) {
      await pipeNdjson(response, res);
    } else {
      const json = await response.json();
      res.json(json);
    }
  } catch (error) {
    console.error(`AI ${logLabel.charAt(0).toUpperCase() + logLabel.slice(1)} Error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: GENERIC_ERROR });
    }
  }
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";

// Server-side API keys for remote provider proxies.
// When set, the client can route requests through the server instead of
// calling the provider directly (useful for deployments that keep keys
// server-side).
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

// ---- Generic provider proxy ----

interface ProxyApiOptions {
  /** Upstream API base URL. */
  baseUrl: string;
  /** Request path (appended to baseUrl). */
  path: string;
  /** HTTP method. */
  method?: string;
  /** Custom headers to add (e.g. Authorization). */
  headers: Record<string, string>;
  /** Request body to forward. */
  body: unknown;
  /** Label for logging. */
  label: string;
}

/**
 * Proxy a request to an upstream REST API, handling streaming and
 * non-streaming responses uniformly.
 *
 * The upstream response is forwarded as-is for streaming (SSE/NDJSON)
 * or as JSON for non-streaming responses.
 */
async function proxyApiRequest(res: express.Response, opts: ProxyApiOptions): Promise<void> {
  const { baseUrl, path: apiPath, method = "POST", headers, body, label } = opts;
  const url = `${baseUrl.replace(/\/+$/, "")}/${apiPath.replace(/^\/+/, "")}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[proxy] ${label} error: ${response.status} - ${errorText}`);
      res.status(response.status).json({
        error: GENERIC_ERROR,
        status: response.status,
      });
      return;
    }

    // If the upstream response is streaming (SSE/NDJSON), pipe it through.
    const contentType = response.headers.get("content-type") || "";
    if (body && typeof body === "object" && (body as Record<string, unknown>).stream !== false) {
      await pipeNdjson(response, res);
    } else if (contentType.includes("text/event-stream") || contentType.includes("x-ndjson")) {
      await pipeNdjson(response, res);
    } else {
      const json = await response.json();
      res.json(json);
    }
  } catch (error) {
    console.error(`[proxy] ${label} Error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: GENERIC_ERROR });
    }
  }
}

// ---- Collab server & middleware (lazy imports) ----
let collabHandle: import("./server/collab-server").CollabServerHandle | null = null;

async function startServer() {
  const app = express();
  const API_ONLY = process.argv.includes("--api-only");
  const PORT = API_ONLY ? 3010 : 3008;

  app.use(express.json({ limit: "10mb" }));

  // ---- Rate limiting & auth middleware ----
  if (process.env.RATE_LIMIT_ENABLED === "true") {
    const { createRateLimiter } = await import("./server/middleware/rateLimit");
    app.use(
      createRateLimiter({
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60", 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
      }),
    );
    console.log("[server] Rate limiting enabled");
  }

  if (process.env.AUTH_ENABLED === "true") {
    const { createAuthMiddleware } = await import("./server/middleware/auth");
    app.use(createAuthMiddleware({ enabled: true }));
    console.log("[server] API auth middleware enabled");
  }

  // CORS for Vite dev server when running standalone
  if (API_ONLY) {
    app.use((_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      next();
    });
  }

  // AI Tags Proxy (Connection check)
  app.get("/api/ai/tags", async (_req, res) => {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Ollama tags error: ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("AI Tags Error:", error);
      res.status(500).json({ error: GENERIC_ERROR });
    }
  });

  // AI Chat Proxy
  app.post("/api/ai/chat", (req, res) => {
    proxyOllamaRequest(req, res, "/api/chat", "chat", chatBodySchema, (data) => ({
      model: data.model || OLLAMA_MODEL,
      messages: data.messages,
      stream: data.stream ?? true,
    }));
  });

  // AI Generation proxy
  app.post("/api/ai/generate", (req, res) => {
    proxyOllamaRequest(req, res, "/api/generate", "generation", generateBodySchema, (data) => ({
      model: data.model || OLLAMA_MODEL,
      prompt: data.prompt,
      system: data.system,
      stream: data.stream ?? true,
    }));
  });

  // AI Embeddings proxy (non-streaming — used by EmbeddingService for RAG)
  app.post("/api/ai/embeddings", async (req, res) => {
    try {
      const parsed = embeddingsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      const { model, prompt } = parsed.data;
      const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model || "nomic-embed-text", prompt }),
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama embeddings error: ${response.status} - ${errorText}`);
        res.status(response.status).json({ error: "Ollama Embedding failed." });
        return;
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("AI Embeddings Error:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Upstream AI service error. Check server logs for details." });
      }
    }
  });

  // ---- Remote provider proxies (optional, require server-side API keys) ----

  const openaiProxyEnabled = !!OPENAI_API_KEY;
  const anthropicProxyEnabled = !!ANTHROPIC_API_KEY;
  const googleProxyEnabled = !!GOOGLE_API_KEY;

  // OpenAI Chat Completions proxy
  if (openaiProxyEnabled) {
    const openaiBodySchema = z.object({
      model: z.string(),
      messages: z.array(z.any()),
      stream: z.boolean().optional(),
      max_tokens: z.number().optional(),
      temperature: z.number().optional(),
    });

    app.post("/api/proxy/openai/chat", (req, res) => {
      const parsed = openaiBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      proxyApiRequest(res, {
        baseUrl: "https://api.openai.com",
        path: "v1/chat/completions",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: parsed.data,
        label: "OpenAI chat",
      });
    });
    console.log("[server] OpenAI proxy enabled");
  }

  // Anthropic Messages proxy
  if (anthropicProxyEnabled) {
    const anthropicBodySchema = z.object({
      model: z.string(),
      messages: z.array(z.any()),
      system: z.string().optional(),
      max_tokens: z.number().optional(),
      stream: z.boolean().optional(),
    });

    app.post("/api/proxy/anthropic/messages", (req, res) => {
      const parsed = anthropicBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      proxyApiRequest(res, {
        baseUrl: "https://api.anthropic.com",
        path: "v1/messages",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: parsed.data,
        label: "Anthropic messages",
      });
    });
    console.log("[server] Anthropic proxy enabled");
  }

  // Google Gemini proxy
  if (googleProxyEnabled) {
    const googleBodySchema = z.object({
      model: z.string(),
      contents: z.array(z.any()),
      stream: z.boolean().optional(),
    });

    app.post("/api/proxy/google/generateContent", (req, res) => {
      const parsed = googleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      const { model, stream, ...rest } = parsed.data;
      const geminiPath = `v1beta/models/${model}:${stream !== false ? "streamGenerateContent" : "generateContent"}?key=${GOOGLE_API_KEY}`;
      proxyApiRequest(res, {
        baseUrl: "https://generativelanguage.googleapis.com",
        path: geminiPath,
        headers: {},
        body: rest,
        label: "Google generateContent",
      });
    });
    console.log("[server] Google Gemini proxy enabled");
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    const health: Record<string, unknown> = { status: "ok", uptime: process.uptime() };
    if (collabHandle) {
      health.collab = collabHandle.manager.getHealth();
    }
    res.json(health);
  });

  // Vite middleware for development (skipped when using --api-only)
  if (!API_ONLY) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  // Create HTTP server and start listening
  const httpServer = http.createServer(app);

  // Start the collaboration WebSocket server on the same HTTP server
  const enableCollab = process.env.COLLAB_ENABLED !== "false";
  if (enableCollab) {
    const { createCollabServer } = await import("./server/collab-server");
    collabHandle = createCollabServer(httpServer);
    console.log(
      `[server] Collaboration server enabled at ws://0.0.0.0:${PORT}${collabHandle.wss.path}`,
    );
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    if (API_ONLY) {
      console.log(`API server running on http://localhost:${PORT}`);
    } else {
      console.log(`Server running on http://localhost:${PORT}`);
    }
    console.log(`Proxying AI requests to ${OLLAMA_HOST} using model ${OLLAMA_MODEL}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[server] Shutting down gracefully...");
    if (collabHandle) {
      await collabHandle.close();
    }
    httpServer.close(() => {
      console.log("[server] Server closed");
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
