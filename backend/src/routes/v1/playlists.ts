import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { parseWith } from "../../http/validate.js";
import {
  addPlaylistTrack,
  createPlaylist,
  deletePlaylist,
  forkPlaylist,
  forkPlaylistFromShareToken,
  getPlaylist,
  getPlaylistByShareToken,
  listPlaylists,
  removePlaylistTrack,
  reorderPlaylistTracks,
  revokePlaylistShares,
  sharePlaylist,
  updatePlaylist,
} from "../../library/playlists.js";

const createBody = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
});
const idParam = z.object({ id: z.string().uuid() });
const addTrackBody = z.object({ trackId: z.string().uuid() });
const reorderBody = z.object({
  trackIds: z.array(z.string().uuid()).max(500),
});
const trackInPlaylist = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
});
const updateBody = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
});
const shareTokenParam = z.object({
  token: z
    .string()
    .min(32)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export async function playlistsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/playlists",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const body = parseWith(createBody, request.body, "body");
      const playlist = await createPlaylist(currentUser(request).id, body);
      return reply.status(201).send(playlist);
    },
  );

  app.get(
    "/playlists",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => ({
      playlists: await listPlaylists(currentUser(request).id),
    }),
  );

  app.get(
    "/playlists/shared/:token",
    { schema: { tags: ["playlists"] } },
    async (request) => {
      const params = parseWith(shareTokenParam, request.params, "params");
      return getPlaylistByShareToken(params.token);
    },
  );

  app.post(
    "/playlists/shared/:token/fork",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(shareTokenParam, request.params, "params");
      const fork = await forkPlaylistFromShareToken(
        currentUser(request).id,
        params.token,
      );
      return reply.status(201).send(fork);
    },
  );

  app.get("/playlists/:id", { schema: { tags: ["playlists"] } }, async (request) => {
    const params = parseWith(idParam, request.params, "params");
    let userId: string | undefined;
    try {
      await requireAuth(request, undefined as never);
      userId = request.authUser?.id;
    } catch {
      userId = undefined;
    }
    return getPlaylist(params.id, userId);
  });

  app.patch(
    "/playlists/:id",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      const body = parseWith(updateBody, request.body, "body");
      return updatePlaylist(currentUser(request).id, params.id, body);
    },
  );

  app.delete(
    "/playlists/:id",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(idParam, request.params, "params");
      await deletePlaylist(currentUser(request).id, params.id);
      return reply.status(204).send();
    },
  );

  app.post(
    "/playlists/:id/tracks",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      const body = parseWith(addTrackBody, request.body, "body");
      return addPlaylistTrack(currentUser(request).id, params.id, body.trackId);
    },
  );

  app.patch(
    "/playlists/:id/tracks",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      const body = parseWith(reorderBody, request.body, "body");
      return reorderPlaylistTracks(currentUser(request).id, params.id, body.trackIds);
    },
  );

  app.delete(
    "/playlists/:id/tracks/:trackId",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(trackInPlaylist, request.params, "params");
      await removePlaylistTrack(currentUser(request).id, params.id, params.trackId);
      return reply.status(204).send();
    },
  );

  app.post(
    "/playlists/:id/share",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request) => {
      const params = parseWith(idParam, request.params, "params");
      return sharePlaylist(currentUser(request).id, params.id);
    },
  );

  app.delete(
    "/playlists/:id/shares",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(idParam, request.params, "params");
      await revokePlaylistShares(currentUser(request).id, params.id);
      return reply.status(204).send();
    },
  );

  app.post(
    "/playlists/:id/fork",
    {
      schema: { tags: ["playlists"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const params = parseWith(idParam, request.params, "params");
      const fork = await forkPlaylist(currentUser(request).id, params.id);
      return reply.status(201).send(fork);
    },
  );
}
