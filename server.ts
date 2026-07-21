import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  app.get("/api/ai/tags", async (req, res) => {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw new Error(`Ollama tags error: ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("AI Tags Error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // AI Chat Proxy
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, model, stream = true } = req.body;
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
        throw new Error(`Ollama chat error: ${response.status} - ${errorText}`);
      }

      if (stream) {
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = (response.body as any).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } catch (streamErr) {
          console.error("Stream reading error:", streamErr);
          res.write(
            Buffer.from(
              JSON.stringify({ error: (streamErr as Error).message }) + "\n",
            ),
          );
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error) {
      console.error("AI Chat Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // AI Generation proxy
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, system, model, stream = true } = req.body;
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
        throw new Error(
          `Ollama generation error: ${response.status} - ${errorText}`,
        );
      }

      if (stream) {
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = (response.body as any).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } catch (streamErr) {
          console.error("Stream reading error:", streamErr);
          res.write(
            Buffer.from(
              JSON.stringify({ error: (streamErr as Error).message }) + "\n",
            ),
          );
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: (error as Error).message });
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
    console.log(
      `Proxying AI requests to ${OLLAMA_HOST} using model ${OLLAMA_MODEL}`,
    );
  });
}

startServer();
