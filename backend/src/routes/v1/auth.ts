import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { parseWith } from "../../http/validate.js";
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from "../../auth/service.js";

const registerBody = z.object({
  email: z.string().email().max(320),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "username must be alphanumeric or underscore"),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(80),
});

const loginBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

const refreshBody = z.object({
  refreshToken: z.string().min(16).max(256),
});

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
      },
    },
  },
} as const;

const tokensSchema = {
  type: "object",
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    tokenType: { type: "string" },
    expiresIn: { type: "string" },
  },
} as const;

function requestMeta(request: FastifyRequest): { userAgent?: string; ip?: string } {
  const agent = request.headers["user-agent"];
  return {
    userAgent: typeof agent === "string" ? agent.slice(0, 512) : undefined,
    ip: request.ip,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Register",
        body: {
          type: "object",
          required: ["email", "username", "password", "displayName"],
          properties: {
            email: { type: "string", format: "email" },
            username: { type: "string" },
            password: { type: "string" },
            displayName: { type: "string" },
          },
        },
        response: {
          201: { type: "object", additionalProperties: true },
          400: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = parseWith(registerBody, request.body, "body");
      const result = await registerUser({ ...body, meta: requestMeta(request) });
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: { type: "object", additionalProperties: true },
          401: errorSchema,
        },
      },
    },
    async (request) => {
      const body = parseWith(loginBody, request.body, "body");
      return loginUser({ ...body, meta: requestMeta(request) });
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Rotate refresh token",
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        },
        response: { 200: tokensSchema, 401: errorSchema },
      },
    },
    async (request) => {
      const body = parseWith(refreshBody, request.body, "body");
      return refreshSession({
        refreshToken: body.refreshToken,
        meta: requestMeta(request),
      });
    },
  );

  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Revoke refresh token",
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        },
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      const body = parseWith(refreshBody, request.body, "body");
      await logoutSession(body.refreshToken);
      return reply.status(204).send();
    },
  );
}
