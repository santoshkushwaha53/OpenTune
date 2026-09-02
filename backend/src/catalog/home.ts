import { prisma } from "../db/prisma.js";

import { rankDiscoveryShelves } from "./ranking.js";
import { serializeTrack } from "./search.js";

async function serializeIds(ids: string[]) {
  return Promise.all(ids.map((id) => serializeTrack(id)));
}

export async function getHomeShelves(userId?: string) {
  const tracks = await prisma.track.findMany({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const pool = tracks.map((track) => track.id);
  const shelves = await rankDiscoveryShelves(pool, userId);

  const [recommended, trending, newOpenReleases, catalog] = await Promise.all([
    serializeIds(shelves.forYou.slice(0, 8)),
    serializeIds(shelves.trending.slice(0, 8)),
    serializeIds(shelves.fresh.slice(0, 8)),
    serializeIds(shelves.catalog.slice(0, 8)),
  ]);

  let recentlyPlayed: Awaited<ReturnType<typeof serializeTrack>>[] = [];
  if (userId) {
    const recents = await prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: 40,
    });
    const seen = new Set<string>();
    const recentIds: string[] = [];
    for (const row of recents) {
      if (seen.has(row.trackId)) {
        continue;
      }
      seen.add(row.trackId);
      recentIds.push(row.trackId);
      if (recentIds.length >= 8) {
        break;
      }
    }
    recentlyPlayed = await serializeIds(recentIds);
  }

  const genres = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    take: 20,
  });
  const playlists = await prisma.playlist.findMany({
    where: { visibility: "public", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, description: true },
  });

  const downloadable = catalog.filter((track) => track.availability.download);

  return {
    greeting: "Discover open music",
    recentlyPlayed,
    continueListening: recentlyPlayed.slice(0, 4),
    recommended,
    newOpenReleases,
    trending,
    downloadable,
    genres,
    communityPlaylists: playlists,
  };
}
