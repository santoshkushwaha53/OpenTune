import { prisma } from "../db/prisma.js";
import { persistProviderTrack } from "../catalog/persist.js";
import { providerRegistry } from "../providers/core/registry.js";

import { ARTIST_DISCOVERY_SEEDS } from "./catalog.js";

export async function listOnboardingArtists(query?: string) {
  const q = query?.trim() ?? "";
  if (q.length > 0) {
    await discoverFromProviders(q, 20);
  } else {
    const existing = await prisma.artist.count();
    if (existing < 8) {
      for (const seed of ARTIST_DISCOVERY_SEEDS) {
        await discoverFromProviders(seed, 5);
      }
    }
  }

  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const artists = await prisma.artist.findMany({
    where,
    orderBy: { name: "asc" },
    take: 48,
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

async function discoverFromProviders(query: string, limit: number) {
  const enabled = await prisma.provider.findMany({ where: { isEnabled: true } });
  for (const row of enabled) {
    const provider = providerRegistry.get(row.slug);
    if (!provider) {
      continue;
    }
    const hits = await provider.search(query, { limit });
    for (const hit of hits) {
      await persistProviderTrack(row.slug, hit);
    }
  }
}
