import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { parseWith } from "../../http/validate.js";
import { recordPlay } from "../../catalog/plays.js";
import { getLibrary, listFavorites, setFavorite } from "../../library/playlists.js";

const trackParam = z.object({ trackId: z.string().uuid() });
const playBody = z.object({
  trackId: z.string().uuid(),
  durationPlayedMs: z.number().int().min(0).max(86_400_000),
  context: z.enum(["queue", "playlist", "album", "search", "other"]).optional(),
  contextId: z.string().uuid().optional(),
});

export async function libraryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/library",
    {
      schema: { tags: ["library"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => getLibrary(currentUser(request).id),
  );

  app.get(
    "/library/favorites",
    {
      schema: { tags: ["library"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => ({
      favorites: await listFavorites(currentUser(request).id),
    }),
  );

  app.post(
    "/library/plays",
    {
      schema: { tags: ["library"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const body = parseWith(playBody, request.body, "body");
      const play = await recordPlay(currentUser(request).id, body);
      return reply.status(201).send({ id: play.id });
    },
  );

  app.put(
    "/library/favorites/:trackId",
    {
      schema: { tags: ["library"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(trackParam, request.params, "params");
      await setFavorite(currentUser(request).id, params.trackId, true);
      return reply.status(204).send();
    },
  );

  app.delete(
    "/library/favorites/:trackId",
    {
      schema: { tags: ["library"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(trackParam, request.params, "params");
      await setFavorite(currentUser(request).id, params.trackId, false);
      return reply.status(204).send();
    },
  );
}
