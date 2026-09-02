import type { FastifyInstance } from "fastify";

export const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["ok"] },
  },
} as const;

const healthRouteSchema = {
  tags: ["health"],
  summary: "Liveness probe",
  description: "Does not touch the music catalog or any provider.",
  response: {
    200: healthResponseSchema,
  },
};

async function healthHandler(): Promise<{ status: "ok" }> {
  return { status: "ok" };
}

export async function rootHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", { schema: healthRouteSchema }, healthHandler);
}

export async function v1HealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", { schema: healthRouteSchema }, healthHandler);
}
