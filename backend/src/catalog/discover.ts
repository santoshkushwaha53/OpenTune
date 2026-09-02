import { prisma } from "../db/prisma.js";
import { persistProviderTrack } from "./persist.js";
import { catalogArtistSeedQueries } from "../onboarding/catalog.js";
import { providerRegistry } from "../providers/core/registry.js";

const ONBOARDING_SEED_ARTIST_FLOOR = 8;
const ONBOARDING_QUICK_SEEDS = [
  "piano",
  "guitar",
  "ambient",
  "acoustic",
  "electronic",
  "folk",
  "jazz",
  "vocal",
] as const;

export function isWildcardCatalogQuery(query: string): boolean {
  const q = query.trim();
  return q.length === 0 || q === "*";
}

export async function persistProviderSearch(
  query: string,
  options?: { limit?: number; providerSlug?: string },
): Promise<number> {
  const q = query.trim();
  if (!q || q === "*") {
    return 0;
  }
  const limit = options?.limit ?? 20;
  const enabled = await prisma.provider.findMany({
    where: {
      isEnabled: true,
      ...(options?.providerSlug ? { slug: options.providerSlug } : {}),
    },
    orderBy: { priority: "asc" },
  });
  let persisted = 0;
  for (const row of enabled) {
    const provider = providerRegistry.get(row.slug);
    if (!provider) {
      continue;
    }
    let hits;
    try {
      hits = await provider.search(q, { limit });
    } catch {
      continue;
    }
    for (const hit of hits) {
      try {
        await persistProviderTrack(row.slug, hit);
        persisted += 1;
      } catch {
        continue;
      }
    }
  }
  return persisted;
}

export async function seedOpenCatalogArtists(options?: {
  limitPerQuery?: number;
  maxQueries?: number;
  providerSlug?: string;
}): Promise<{ queries: number; recordsSynced: number }> {
  const queries = catalogArtistSeedQueries().slice(0, options?.maxQueries ?? 40);
  const limit = options?.limitPerQuery ?? 12;
  let recordsSynced = 0;
  for (const query of queries) {
    recordsSynced += await persistProviderSearch(query, {
      limit,
      providerSlug: options?.providerSlug,
    });
  }
  return { queries: queries.length, recordsSynced };
}

export async function ensureOpenCatalogArtists(): Promise<void> {
  const existing = await prisma.artist.count();
  if (existing >= ONBOARDING_SEED_ARTIST_FLOOR) {
    return;
  }
  const testOnly = process.env.NODE_ENV === "test";
  const seeds = testOnly ? (["ambient"] as const) : ONBOARDING_QUICK_SEEDS;
  for (const query of seeds) {
    await persistProviderSearch(query, {
      limit: 5,
      providerSlug: testOnly ? "fake" : undefined,
    });
  }
}
