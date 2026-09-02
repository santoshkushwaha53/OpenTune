import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { searchArtists, searchCatalog } from "../../catalog/search.js";
import { parseWith } from "../../http/validate.js";

const querySchema = z
  .object({
    q: z.string().max(200).optional(),
    year: z.coerce.number().int().min(1950).max(2030).optional(),
    yearFrom: z.coerce.number().int().min(1950).max(2030).optional(),
    yearTo: z.coerce.number().int().min(1950).max(2030).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    (value) => Boolean(value.q?.trim()) || value.year != null || value.yearFrom != null,
    { message: "q or year is required" },
  );

const artistQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(80).optional(),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/search/artists",
    {
      schema: {
        tags: ["search"],
        summary: "Open-catalog singers with licensed tracks",
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
    },
    async (request) => {
      const query = parseWith(artistQuerySchema, request.query, "query");
      return searchArtists(query.q ?? "", { limit: query.limit });
    },
  );

  app.get(
    "/search",
    {
      schema: {
        tags: ["search"],
        summary: "Aggregated catalog search",
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            year: { type: "integer" },
            yearFrom: { type: "integer" },
            yearTo: { type: "integer" },
            limit: { type: "integer" },
          },
        },
      },
    },
    async (request) => {
      const query = parseWith(querySchema, request.query, "query");
      const yearFrom = query.year ?? query.yearFrom;
      const yearTo = query.year ?? query.yearTo;
      const results = await searchCatalog(query.q ?? "", {
        limit: query.limit ?? 40,
        yearFrom,
        yearTo,
      });
      return { results };
    },
  );
}
