import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getAlbum, getAlbumTracks } from "../../catalog/search.js";
import { parseWith } from "../../http/validate.js";

const idParam = z.object({ id: z.string().uuid() });

export async function albumsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/albums/:id",
    {
      schema: {
        tags: ["albums"],
        summary: "Album metadata",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return getAlbum(params.id);
    },
  );

  app.get(
    "/albums/:id/tracks",
    {
      schema: { tags: ["albums"], summary: "Album tracks" },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return getAlbumTracks(params.id);
    },
  );
}
