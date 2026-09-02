import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { Env } from "../config/env.js";
import { apiErrorBody, ErrorCodes } from "../http/errors.js";

function isHealthPath(request: FastifyRequest): boolean {
  const path = (request.url.split("?")[0] ?? "").replace(/\/$/, "") || "/";
  return path === "/health" || path === "/api/v1/health";
}

export async function rateLimitPlugin(app: FastifyInstance, env: Env): Promise<void> {
  await app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => request.ip || "anonymous",
    allowList: (request) => isHealthPath(request),
    errorResponseBuilder: (request) => ({
      statusCode: 429,
      ...apiErrorBody(ErrorCodes.RATE_LIMITED, "Too many requests", request.id),
    }),
  });

  // Global onRequest so unknown routes (404) are limited too, not only registered handlers.
  app.addHook("onRequest", app.rateLimit());
}
