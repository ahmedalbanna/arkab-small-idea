/**
 * API key validation middleware for AI provider proxy endpoints.
 *
 * Clients send their provider API key in the `Authorization: Bearer <key>`
 * header or in the request body as `apiKey`. The middleware validates that
 * the key is present and well-formed (non-empty string).
 *
 * The actual key is NOT stored or validated against any authority — it is
 * passed through to the upstream AI provider.  This middleware exists to:
 *   1. Reject obviously malformed requests early
 *   2. Provide consistent error messages
 *   3. Log auth failures for observability
 */

import type { Request, Response, NextFunction } from "express";

export interface AuthOptions {
  /** Whether to require authentication for API proxy routes. */
  enabled: boolean;
  /** Set of routes that require auth (prefix match). */
  protectedRoutes: string[];
}

const defaultOptions: AuthOptions = {
  enabled: false,
  protectedRoutes: ["/api/ai/chat", "/api/ai/generate"],
};

export function createAuthMiddleware(options: Partial<AuthOptions> = {}) {
  const opts = { ...defaultOptions, ...options };

  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!opts.enabled) {
      next();
      return;
    }

    const isProtected = opts.protectedRoutes.some((route) => req.path.startsWith(route));
    if (!isProtected) {
      next();
      return;
    }

    // Check Authorization header first, then fall back to body.apiKey
    let apiKey: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7).trim();
    }

    if (!apiKey && req.body?.apiKey) {
      apiKey = String(req.body.apiKey).trim();
    }

    if (!apiKey) {
      res.status(401).json({
        error:
          "Authentication required. Provide an API key via Authorization header or in the request body.",
      });
      return;
    }

    if (apiKey.length < 8) {
      res.status(401).json({
        error: "Invalid API key format.",
      });
      return;
    }

    // Attach the validated key to the request so downstream handlers can use it
    (req as unknown as { apiKey?: string }).apiKey = apiKey;
    next();
  };
}
