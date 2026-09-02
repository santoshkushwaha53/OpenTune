import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { searchCatalog } from "../../catalog/search.js";
import { parseWith } from "../../http/validate.js";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/search",
    {
      schema: {
        tags: ["search"],
        summary: "Aggregated catalog search",
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
    },
    async (request) => {
      const query = parseWith(querySchema, request.query, "query");
      const results = await searchCatalog(query.q, query.limit);
      return { results };
    },
  );
}
