import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listProviders } from "../../providers/bootstrap.js";
import {
  inspectProviderHealth,
  listProviderSyncLogs,
  sweepProviderHealth,
  syncProviderCatalog,
} from "../../providers/sync.js";
import { parseWith } from "../../http/validate.js";
import { requireOperator } from "../../security/operator.js";

const slugParam = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, or hyphens"),
});
const syncBody = z.object({
  query: z.string().min(1).max(200).optional(),
});

export async function providersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/providers",
    {
      schema: {
        tags: ["providers"],
        summary: "Configured music providers and health",
      },
    },
    async () => ({ providers: await listProviders() }),
  );

  app.post(
    "/providers/health-sweep",
    {
      schema: {
        tags: ["providers"],
        summary: "Check all providers and disable after repeated failures",
      },
      preHandler: requireOperator,
    },
    async () => sweepProviderHealth(),
  );

  app.get(
    "/providers/:slug/health",
    {
      schema: { tags: ["providers"], summary: "Provider health check" },
      preHandler: requireOperator,
    },
    async (request) => {
      const { slug } = parseWith(slugParam, request.params, "params");
      return inspectProviderHealth(slug);
    },
  );

  app.get(
    "/providers/:slug/sync-logs",
    {
      schema: {
        tags: ["providers"],
        summary: "Recent catalog metadata sync jobs",
      },
      preHandler: requireOperator,
    },
    async (request) => {
      const { slug } = parseWith(slugParam, request.params, "params");
      return listProviderSyncLogs(slug);
    },
  );

  app.post(
    "/providers/:slug/sync",
    {
      schema: { tags: ["providers"], summary: "Sync provider catalog metadata" },
      preHandler: requireOperator,
    },
    async (request) => {
      const { slug } = parseWith(slugParam, request.params, "params");
      const body = parseWith(syncBody, request.body ?? {}, "body");
      return syncProviderCatalog(slug, body.query ?? "*");
    },
  );
}
