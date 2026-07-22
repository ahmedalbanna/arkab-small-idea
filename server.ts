import express from "express";
import { createServer as createViteServer } from "vite";
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

async function startServer() {
  const app = express();
  const API_ONLY = process.argv.includes("--api-only");
  const PORT = API_ONLY ? 3009 : 3008;

  app.use(express.json());

  const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";

  // CORS for Vite dev server when running standalone
  if (API_ONLY) {
    app.use((_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const parsed = chatBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      const { messages, model, stream = true } = parsed.data;

      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || OLLAMA_MODEL,
          messages: messages,
          stream: stream,
        }),
        signal: AbortSignal.timeout(300000), // 5 minutes for streaming
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama chat error: ${response.status} - ${errorText}`);
        throw new Error(GENERIC_ERROR);
      }

      if (stream) {
        await pipeNdjson(response, res);
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error) {
      console.error("AI Chat Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: GENERIC_ERROR });
      }
    }
  });

  // AI Generation proxy
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const parsed = generateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request body." });
        return;
      }
      const { prompt, system, model, stream = true } = parsed.data;

      const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || OLLAMA_MODEL,
          prompt: prompt,
          system: system,
          stream: stream,
        }),
        signal: AbortSignal.timeout(300000), // 5 minutes for streaming
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama generation error: ${response.status} - ${errorText}`);
        throw new Error(GENERIC_ERROR);
      }

      if (stream) {
        await pipeNdjson(response, res);
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: GENERIC_ERROR });
      }
    }
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

  app.listen(PORT, "0.0.0.0", () => {
    if (API_ONLY) {
      console.log(`API server running on http://localhost:${PORT}`);
    } else {
      console.log(`Server running on http://localhost:${PORT}`);
    }
    console.log(`Proxying AI requests to ${OLLAMA_HOST} using model ${OLLAMA_MODEL}`);
  });
}

startServer();
