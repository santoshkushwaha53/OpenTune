import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import { corsOrigins, getEnv, type Env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { bootstrapProviders } from "./providers/bootstrap.js";
import { rootHealthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
        'req.headers["x-opentune-operator"]',
        "*.password",
        "*.passwordHash",
        "*.refreshToken",
        "*.operatorToken",
      ],
      censor: "[redacted]",
    },
  };
}

function requestIdFromHeader(header: unknown): string | undefined {
  if (typeof header !== "string") {
    return undefined;
  }
  const value = header.trim();
  if (value.length < 8 || value.length > 128 || !/^[\w.:-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

export async function buildApp(overrides?: Partial<Env>): Promise<FastifyInstance> {
  const env = { ...getEnv(), ...overrides };

  const app = Fastify({
    logger: loggerOptions(env),
    requestIdHeader: false,
    genReqId: (request) =>
      requestIdFromHeader(request.headers["x-request-id"]) ?? randomUUID(),
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: corsOrigins(env),
  });

  await rateLimitPlugin(app, env);
  await errorHandlerPlugin(app, env);
  await swaggerPlugin(app);

  try {
    await bootstrapProviders(env);
  } catch (error) {
    app.log.warn({ err: error }, "provider bootstrap skipped");
  }

  await app.register(rootHealthRoutes);
  await app.register(v1Routes, { prefix: "/api/v1" });

  app.addHook("onClose", async () => {
    if (getEnv().NODE_ENV !== "test") {
      await prisma.$disconnect();
    }
  });

  return app;
}
