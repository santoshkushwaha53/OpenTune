import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { resolveTrackSources } from "../../catalog/resolver.js";
import { serializeTrack } from "../../catalog/search.js";
import { parseWith } from "../../http/validate.js";

const idParam = z.object({ id: z.string().uuid() });

export async function tracksRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/tracks/:id",
    {
      schema: {
        tags: ["tracks"],
        summary: "Track metadata and license summary",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return serializeTrack(params.id);
    },
  );

  app.get(
    "/tracks/:id/sources",
    {
      schema: {
        tags: ["tracks"],
        summary: "Resolved playback/download sources (URLs are provider-hosted)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return resolveTrackSources(params.id);
    },
  );
}
