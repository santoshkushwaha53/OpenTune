import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";
import { providerRegistry } from "../providers/core/registry.js";
import { persistProviderTrack } from "./persist.js";
import type { ProviderTrack } from "../providers/core/types.js";
import { jamendoFuzzyTags } from "../providers/jamendo/tags.js";
import { partitionByDownloadRights } from "./source-router.js";
import { orderByRank, rankTrackIds } from "./ranking.js";

export async function searchCatalog(
  query: string,
  options?: { limit?: number; yearFrom?: number; yearTo?: number },
) {
  const q = query.trim();
  const yearFrom = options?.yearFrom;
  const yearTo = options?.yearTo;
  const limit = options?.limit ?? 20;
  if (q.length < 1 && yearFrom == null && yearTo == null) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "q or year is required");
  }

  const enabled = await prisma.provider.findMany({
    where: { isEnabled: true },
    orderBy: { priority: "asc" },
  });
  const seen = new Set<string>();
  const downloadable = [];
  const listenOnly = [];

  for (const row of enabled) {
    const provider = providerRegistry.get(row.slug);
    if (!provider) {
      continue;
    }
    const hits = await provider.search(q, { limit, yearFrom, yearTo });
    const partitioned = partitionByDownloadRights(hits);
    for (const hit of partitioned.downloadable) {
      const serialized = await persistHit(row.slug, hit, seen);
      if (serialized) {
        downloadable.push(serialized);
        if (downloadable.length >= limit) {
          break;
        }
      }
    }
    if (downloadable.length >= limit) {
      break;
    }
    for (const hit of partitioned.listenOnly) {
      const serialized = await persistHit(row.slug, hit, seen);
      if (serialized) {
        listenOnly.push(serialized);
      }
    }
  }

  const results = [...downloadable, ...listenOnly].slice(0, limit);

  if (results.length === 0 && q.length > 0) {
    const local = await searchPersistedCatalog(q, {
      limit,
      yearFrom,
      yearTo,
      excludeIds: [...seen],
    });
    results.push(...local);
  }

  const rankedIds = await rankTrackIds(results.map((item) => item.id));
  return orderByRank(results, rankedIds);
}

async function persistHit(providerSlug: string, hit: ProviderTrack, seen: Set<string>) {
  try {
    const persisted = await persistProviderTrack(providerSlug, hit);
    if (seen.has(persisted.track.id)) {
      return null;
    }
    seen.add(persisted.track.id);
    return serializeTrack(persisted.track.id);
  } catch {
    return null;
  }
}

async function searchPersistedCatalog(
  query: string,
  options: {
    limit: number;
    yearFrom?: number;
    yearTo?: number;
    excludeIds: string[];
  },
) {
  const terms = [
    ...new Set(
      [query.trim(), ...jamendoFuzzyTags(query)]
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 2 && term !== "*"),
    ),
  ];
  if (terms.length === 0 || options.limit < 1) {
    return [];
  }

  const releaseDate: { gte?: Date; lte?: Date } = {};
  if (options.yearFrom != null) {
    releaseDate.gte = new Date(Date.UTC(options.yearFrom, 0, 1));
  }
  if (options.yearTo != null) {
    releaseDate.lte = new Date(Date.UTC(options.yearTo, 11, 31));
  }

  const tracks = await prisma.track.findMany({
    where: {
      deletedAt: null,
      ...(options.excludeIds.length ? { id: { notIn: options.excludeIds } } : {}),
      OR: terms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" } },
        {
          trackArtists: {
            some: { artist: { name: { contains: term, mode: "insensitive" } } },
          },
        },
      ]),
      ...(Object.keys(releaseDate).length ? { album: { is: { releaseDate } } } : {}),
    },
    take: options.limit,
    orderBy: { updatedAt: "desc" },
  });
  return Promise.all(tracks.map((track) => serializeTrack(track.id)));
}

export async function serializeTrack(trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, deletedAt: null },
    include: {
      trackArtists: { include: { artist: true }, orderBy: { position: "asc" } },
      trackSources: { include: { license: true, provider: true } },
      album: true,
    },
  });
  if (!track) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Track not found");
  }
  const primary = track.trackArtists[0]?.artist;
  const source = track.trackSources[0];
  return {
    id: track.id,
    title: track.title,
    durationMs: track.durationMs,
    artworkUrl: track.artworkUrl,
    year: track.album?.releaseDate ? track.album.releaseDate.getUTCFullYear() : null,
    album: track.album ? { id: track.album.id, title: track.album.title } : null,
    artist: primary ? { id: primary.id, name: primary.name } : null,
    license: source
      ? {
          spdxId: source.license.spdxId,
          name: source.license.name,
          url: source.license.url,
          requiresAttribution: source.license.requiresAttribution,
        }
      : null,
    availability: {
      stream: track.trackSources.some((item) => item.supportsStreaming),
      download: track.trackSources.some((item) => item.supportsDownload),
      attributionRequired: track.trackSources.some(
        (item) => item.license.requiresAttribution,
      ),
    },
    source: source
      ? { provider: source.provider.slug, providerName: source.provider.name }
      : null,
  };
}

export async function getArtist(id: string) {
  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      trackArtists: {
        where: { track: { deletedAt: null } },
        include: { track: true },
        orderBy: { track: { title: "asc" } },
        take: 50,
      },
      albumArtists: {
        include: { album: true },
        orderBy: { album: { title: "asc" } },
      },
    },
  });
  if (!artist) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Artist not found");
  }
  const seenAlbums = new Set<string>();
  const albums = [];
  for (const row of artist.albumArtists) {
    if (seenAlbums.has(row.album.id)) {
      continue;
    }
    seenAlbums.add(row.album.id);
    albums.push({
      id: row.album.id,
      title: row.album.title,
      artworkUrl: row.album.artworkUrl,
    });
  }
  return {
    id: artist.id,
    name: artist.name,
    bio: artist.bio,
    artworkUrl: artist.artworkUrl,
    albums,
    tracks: await Promise.all(
      artist.trackArtists.map((item) => serializeTrack(item.track.id)),
    ),
  };
}

export async function getArtistAlbums(id: string) {
  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      albumArtists: { include: { album: true } },
    },
  });
  if (!artist) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Artist not found");
  }
  return {
    artistId: artist.id,
    albums: artist.albumArtists.map((item) => ({
      id: item.album.id,
      title: item.album.title,
      artworkUrl: item.album.artworkUrl,
    })),
  };
}

export async function getArtistTracks(id: string) {
  const artist = await getArtist(id);
  return { artistId: artist.id, tracks: artist.tracks };
}

export async function getAlbum(id: string) {
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      tracks: {
        where: { deletedAt: null },
        orderBy: { title: "asc" },
      },
      albumArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });
  if (!album) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Album not found");
  }
  return {
    id: album.id,
    title: album.title,
    artworkUrl: album.artworkUrl,
    releaseDate: album.releaseDate,
    artists: album.albumArtists.map((item) => ({
      id: item.artist.id,
      name: item.artist.name,
    })),
    tracks: await Promise.all(album.tracks.map((track) => serializeTrack(track.id))),
  };
}

export async function getAlbumTracks(id: string) {
  const album = await getAlbum(id);
  return { albumId: album.id, tracks: album.tracks };
}
