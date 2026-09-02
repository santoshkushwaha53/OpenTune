import { prisma } from "../db/prisma.js";
import {
  persistProviderSearch,
  ensureOpenCatalogArtists,
} from "../catalog/discover.js";

export async function listOnboardingArtists(query?: string) {
  const q = query?.trim() ?? "";
  if (q.length > 0) {
    await persistProviderSearch(q, { limit: 20 });
  } else {
    await ensureOpenCatalogArtists();
  }

  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const artists = await prisma.artist.findMany({
    where,
    orderBy: { name: "asc" },
    take: 80,
    include: {
      _count: { select: { trackArtists: true } },
    },
  });

  return {
    disclaimer:
      "Artists shown here appear in supported open-licensed catalogs. OpenTune does not host commercial recordings.",
    artists: artists
      .filter((artist) => artist._count.trackArtists > 0)
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        artworkUrl: artist.artworkUrl,
      })),
  };
}
