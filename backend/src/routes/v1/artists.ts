import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getArtist, getArtistAlbums, getArtistTracks } from "../../catalog/search.js";
import { parseWith } from "../../http/validate.js";

const idParam = z.object({ id: z.string().uuid() });

export async function artistsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/artists/:id",
    {
      schema: {
        tags: ["artists"],
        summary: "Artist metadata",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return getArtist(params.id);
    },
  );

  app.get(
    "/artists/:id/albums",
    {
      schema: { tags: ["artists"], summary: "Artist albums" },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return getArtistAlbums(params.id);
    },
  );

  app.get(
    "/artists/:id/tracks",
    {
      schema: { tags: ["artists"], summary: "Artist tracks" },
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return getArtistTracks(params.id);
    },
  );
}
