import { prisma } from "../db/prisma.js";

export type RankingMode = "catalog" | "forYou" | "trending" | "fresh";

export type RankingSignals = {
  supportsDownload: boolean;
  supportsStreaming: boolean;
  requiresAttribution: boolean;
  playCount: number;
  ageDays: number;
  sameArtistAsListener?: boolean;
  sameGenreAsListener?: boolean;
  playedRecently?: boolean;
};

export type RankOptions = {
  userId?: string;
  mode?: RankingMode;
};

/**
 * Deterministic discovery score. Higher is better.
 * Favors permitted downloads and open licenses. Paywalled / NC / ND catalogs never persist.
 */
export function discoveryScore(
  signals: RankingSignals,
  mode: RankingMode = "catalog",
): number {
  const download = signals.supportsDownload ? 1 : 0;
  const stream = signals.supportsStreaming ? 1 : 0;
  const openLicense = signals.requiresAttribution ? 0 : 1;
  const plays = Math.min(signals.playCount, mode === "trending" ? 25 : 8);
  const recency = Math.max(0, 10 - signals.ageDays);
  const artist = signals.sameArtistAsListener ? 1 : 0;
  const genre = signals.sameGenreAsListener ? 1 : 0;
  const recent = signals.playedRecently ? 1 : 0;

  switch (mode) {
    case "trending":
      return plays * 4 + recency + download * 2 + stream;
    case "fresh":
      return recency * 3 + download * 2 + stream + openLicense;
    case "forYou":
      return (
        download * 8 +
        stream * 2 +
        openLicense * 3 +
        plays +
        recency +
        artist * 4 +
        genre * 2 -
        recent * 2
      );
    default:
      return download * 10 + stream * 2 + openLicense * 3 + plays + recency;
  }
}

type RankedTrack = {
  id: string;
  score: number;
};

async function listenerAffinity(userId: string) {
  const [plays, favorites] = await Promise.all([
    prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: 40,
      select: {
        trackId: true,
        track: {
          select: {
            trackArtists: { select: { artistId: true } },
            trackGenres: { select: { genreId: true } },
          },
        },
      },
    }),
    prisma.favorite.findMany({
      where: { userId },
      take: 40,
      select: {
        track: {
          select: {
            trackArtists: { select: { artistId: true } },
            trackGenres: { select: { genreId: true } },
          },
        },
      },
    }),
  ]);

  const artistIds = new Set<string>();
  const genreIds = new Set<string>();
  const recentTrackIds = new Set<string>();
  plays.forEach((row, index) => {
    if (index < 8) {
      recentTrackIds.add(row.trackId);
    }
    for (const credit of row.track.trackArtists) {
      artistIds.add(credit.artistId);
    }
    for (const tag of row.track.trackGenres) {
      genreIds.add(tag.genreId);
    }
  });
  for (const row of favorites) {
    for (const credit of row.track.trackArtists) {
      artistIds.add(credit.artistId);
    }
    for (const tag of row.track.trackGenres) {
      genreIds.add(tag.genreId);
    }
  }
  return { artistIds, genreIds, recentTrackIds };
}

/**
 * Rank catalog tracks for discovery. Does not fetch or score audio bytes.
 */
export async function rankTrackIds(
  ids: string[],
  options: RankOptions = {},
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return [];
  }
  const mode = options.mode ?? "catalog";

  const [tracks, playCounts, affinity] = await Promise.all([
    prisma.track.findMany({
      where: { id: { in: unique }, deletedAt: null },
      include: {
        trackSources: { include: { license: true } },
        trackArtists: { select: { artistId: true } },
        trackGenres: { select: { genreId: true } },
      },
    }),
    prisma.playHistory.groupBy({
      by: ["trackId"],
      where: { trackId: { in: unique } },
      _count: { _all: true },
    }),
    options.userId && mode === "forYou"
      ? listenerAffinity(options.userId)
      : Promise.resolve(null),
  ]);

  const plays = new Map(playCounts.map((row) => [row.trackId, row._count._all]));
  const now = Date.now();

  const ranked: RankedTrack[] = tracks.map((track) => {
    const score = discoveryScore(
      {
        supportsDownload: track.trackSources.some((source) => source.supportsDownload),
        supportsStreaming: track.trackSources.some(
          (source) => source.supportsStreaming,
        ),
        requiresAttribution: track.trackSources.every(
          (source) => source.license.requiresAttribution,
        ),
        playCount: plays.get(track.id) ?? 0,
        ageDays: Math.floor((now - track.createdAt.getTime()) / 86_400_000),
        sameArtistAsListener: track.trackArtists.some((credit) =>
          affinity?.artistIds.has(credit.artistId),
        ),
        sameGenreAsListener: track.trackGenres.some((tag) =>
          affinity?.genreIds.has(tag.genreId),
        ),
        playedRecently: affinity?.recentTrackIds.has(track.id) ?? false,
      },
      mode,
    );
    return { id: track.id, score };
  });

  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.map((item) => item.id);
}

export async function rankDiscoveryShelves(ids: string[], userId?: string) {
  const unique = [...new Set(ids)];
  const empty = {
    forYou: [] as string[],
    trending: [] as string[],
    fresh: [] as string[],
    catalog: [] as string[],
  };
  if (unique.length === 0) {
    return empty;
  }

  const [tracks, playCounts, affinity] = await Promise.all([
    prisma.track.findMany({
      where: { id: { in: unique }, deletedAt: null },
      include: {
        trackSources: { include: { license: true } },
        trackArtists: { select: { artistId: true } },
        trackGenres: { select: { genreId: true } },
      },
    }),
    prisma.playHistory.groupBy({
      by: ["trackId"],
      where: { trackId: { in: unique } },
      _count: { _all: true },
    }),
    userId ? listenerAffinity(userId) : Promise.resolve(null),
  ]);

  const plays = new Map(playCounts.map((row) => [row.trackId, row._count._all]));
  const now = Date.now();

  const signalsFor = (track: (typeof tracks)[number]) => ({
    supportsDownload: track.trackSources.some((source) => source.supportsDownload),
    supportsStreaming: track.trackSources.some((source) => source.supportsStreaming),
    requiresAttribution: track.trackSources.every(
      (source) => source.license.requiresAttribution,
    ),
    playCount: plays.get(track.id) ?? 0,
    ageDays: Math.floor((now - track.createdAt.getTime()) / 86_400_000),
    sameArtistAsListener: track.trackArtists.some((credit) =>
      affinity?.artistIds.has(credit.artistId),
    ),
    sameGenreAsListener: track.trackGenres.some((tag) =>
      affinity?.genreIds.has(tag.genreId),
    ),
    playedRecently: affinity?.recentTrackIds.has(track.id) ?? false,
  });

  const sortMode = (mode: RankingMode) =>
    [...tracks]
      .map((track) => ({
        id: track.id,
        score: discoveryScore(signalsFor(track), mode),
      }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .map((item) => item.id);

  return {
    forYou: sortMode("forYou"),
    trending: sortMode("trending"),
    fresh: sortMode("fresh"),
    catalog: sortMode("catalog"),
  };
}

export function orderByRank<T extends { id: string }>(
  items: T[],
  rankedIds: string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);
}
