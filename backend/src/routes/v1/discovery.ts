import type { FastifyInstance } from "fastify";

import { optionalAuth } from "../../auth/hooks.js";
import { getHomeShelves } from "../../catalog/home.js";
import { prisma } from "../../db/prisma.js";
import { publicDiscoverScenes } from "../../onboarding/catalog.js";
import { serializeTrack } from "../../catalog/search.js";
import { rankTrackIds } from "../../catalog/ranking.js";

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/discovery/home",
    {
      schema: { tags: ["discovery"], summary: "Home shelves" },
    },
    async (request) => {
      await optionalAuth(request);
      return getHomeShelves(request.authUser?.id);
    },
  );

  app.get("/discovery/trending", async () => {
    const tracks = await prisma.track.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    const ranked = await rankTrackIds(
      tracks.map((track) => track.id),
      { mode: "trending" },
    );
    return {
      results: await Promise.all(ranked.slice(0, 20).map((id) => serializeTrack(id))),
    };
  });

  app.get("/discovery/genres", async () => ({
    genres: await prisma.genre.findMany({ orderBy: { name: "asc" } }),
  }));

  app.get("/discovery/scenes", async () => publicDiscoverScenes());
}
