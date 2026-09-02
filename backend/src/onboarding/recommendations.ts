import { prisma } from "../db/prisma.js";
import { persistProviderTrack } from "../catalog/persist.js";
import { serializeTrack } from "../catalog/search.js";
import { permittedDownloadSource } from "../providers/core/capabilities.js";
import { providerRegistry } from "../providers/core/registry.js";

import { categoryBySlug, languageByCode, moodBySlug } from "./catalog.js";
import { getPreferenceView, setStarterTrackIds } from "./preferences.js";

const STARTER_LIMIT = 10;
const MIN_DURATION_MS = 30_000;
const MAX_DURATION_MS = 15 * 60 * 1000;

type Scored = {
  id: string;
  canonicalKey: string;
  score: number;
};

/**
 * Weighted ranking for a first listening set.
 * Artist 40 / category 25 / language 20 / mood 10 / popularity 5.
 * Only tracks with a live permitted download URL are returned.
 */
export async function buildStarterPack(
  userId: string,
  options: { persist?: boolean } = {},
) {
  const prefs = await getPreferenceView(userId);
  const artistNames = prefs.favoriteArtists.map((artist) => artist.name);
  const artistIds = new Set(prefs.favoriteArtists.map((artist) => artist.id));
  const categoryQueries = prefs.favoriteCategories
    .map((item) => categoryBySlug.get(item.slug)?.searchQuery)
    .filter((value): value is string => Boolean(value));
  const languageQueries = prefs.preferredLanguages
    .map((item) => languageByCode.get(item.code)?.searchQuery)
    .filter((value): value is string => Boolean(value));
  const moodQueries = prefs.preferredMoods
    .map((item) => moodBySlug.get(item.slug)?.searchQuery)
    .filter((value): value is string => Boolean(value));

  const languageHits = new Set<string>();
  const categoryHits = new Set<string>();
  const moodHits = new Set<string>();
  const artistHits = new Set<string>();

  await collect(artistNames, 8, artistHits);
  await collect(categoryQueries, 8, categoryHits);
  await collect(languageQueries, 6, languageHits);
  await collect(moodQueries, 5, moodHits);

  const pool = new Set<string>([
    ...artistHits,
    ...categoryHits,
    ...languageHits,
    ...moodHits,
  ]);

  if (pool.size < STARTER_LIMIT) {
    const extra = await prisma.track.findMany({
      where: {
        deletedAt: null,
        trackSources: { some: { supportsDownload: true } },
      },
      select: { id: true },
      take: 80,
      orderBy: { createdAt: "desc" },
    });
    for (const row of extra) {
      pool.add(row.id);
    }
  }

  const tracks = await prisma.track.findMany({
    where: { id: { in: [...pool] }, deletedAt: null },
    include: {
      trackSources: { include: { license: true, provider: true } },
      trackArtists: { select: { artistId: true, artist: { select: { name: true } } } },
      trackGenres: { include: { genre: true } },
    },
  });

  const playCounts = await prisma.playHistory.groupBy({
    by: ["trackId"],
    where: { trackId: { in: tracks.map((track) => track.id) } },
    _count: { _all: true },
  });
  const plays = new Map(playCounts.map((row) => [row.trackId, row._count._all]));

  const languageOnly = prefs.languageMode === "only" && languageQueries.length > 0;

  const ranked: Scored[] = [];
  for (const track of tracks) {
    if (track.durationMs < MIN_DURATION_MS || track.durationMs > MAX_DURATION_MS) {
      continue;
    }
    const downloadable = track.trackSources.some(
      (source) =>
        source.supportsDownload &&
        source.license.allowsDownload &&
        source.provider.isEnabled,
    );
    if (!downloadable) {
      continue;
    }
    if (languageOnly && !languageHits.has(track.id)) {
      continue;
    }

    const artistMatch = track.trackArtists.some((credit) =>
      artistIds.has(credit.artistId),
    )
      ? 1
      : 0;
    const categoryMatch = categoryHits.has(track.id) ? 1 : 0;
    const languageMatch = languageHits.has(track.id) ? 1 : 0;
    const moodMatch = moodHits.has(track.id) ? 1 : 0;
    const popularity = Math.min(plays.get(track.id) ?? 0, 8) / 8;

    const score =
      artistMatch * 0.4 +
      categoryMatch * 0.25 +
      languageMatch * 0.2 +
      moodMatch * 0.1 +
      popularity * 0.05;

    ranked.push({ id: track.id, canonicalKey: track.canonicalKey, score });
  }

  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const seenKeys = new Set<string>();
  const eligible: string[] = [];
  for (const item of ranked) {
    if (seenKeys.has(item.canonicalKey)) {
      continue;
    }
    const verified = await verifyDownloadable(item.id);
    if (!verified) {
      continue;
    }
    seenKeys.add(item.canonicalKey);
    eligible.push(item.id);
    if (eligible.length >= STARTER_LIMIT) {
      break;
    }
  }

  if (options.persist !== false) {
    await setStarterTrackIds(userId, eligible);
  }

  const tracksOut = await Promise.all(eligible.map((id) => serializeTrack(id)));
  const requested = STARTER_LIMIT;
  return {
    requested,
    found: tracksOut.length,
    downloadableCount: tracksOut.length,
    estimatedBytes: estimateBytes(tracksOut.map((track) => track.durationMs)),
    honestLabel:
      tracksOut.length >= requested
        ? `${requested} tracks available for offline listening`
        : `We found ${tracksOut.length} tracks available for offline listening.`,
    tracks: tracksOut,
  };
}

async function collect(queries: string[], limit: number, into: Set<string>) {
  const enabled = await prisma.provider.findMany({ where: { isEnabled: true } });
  for (const query of queries) {
    for (const row of enabled) {
      const provider = providerRegistry.get(row.slug);
      if (!provider) {
        continue;
      }
      const hits = await provider.search(query, { limit });
      for (const hit of hits) {
        const persisted = await persistProviderTrack(row.slug, hit);
        into.add(persisted.track.id);
      }
    }
  }
}

async function verifyDownloadable(trackId: string): Promise<boolean> {
  const sources = await prisma.trackSource.findMany({
    where: { trackId, supportsDownload: true },
    include: { provider: true, license: true },
  });
  for (const row of sources) {
    if (!row.provider.isEnabled || !row.license.allowsDownload) {
      continue;
    }
    const provider = providerRegistry.get(row.provider.slug);
    if (!provider) {
      continue;
    }
    const download = await permittedDownloadSource(provider, row.externalTrackId, {
      supportsStreaming: row.supportsStreaming,
      supportsDownload: row.supportsDownload,
    });
    if (download) {
      return true;
    }
  }
  return false;
}

function estimateBytes(durationsMs: number[]): number {
  // ~128 kbps MP3 ≈ 1 MB per minute. Estimate only — not a stored file size.
  return durationsMs.reduce(
    (sum, ms) => sum + Math.round((ms / 60_000) * 1_000_000),
    0,
  );
}
