import { createHash, randomBytes } from "node:crypto";

import { serializeTrack } from "../catalog/search.js";
import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function requireOwnedPlaylist(userId: string, playlistId: string) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, userId, deletedAt: null },
  });
  if (!playlist) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Playlist not found");
  }
  return playlist;
}

async function requireTrack(trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, deletedAt: null },
  });
  if (!track) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Track not found");
  }
  return track;
}

async function serializePlaylistRecord(playlistId: string) {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, deletedAt: null },
    include: {
      tracks: { orderBy: { position: "asc" } },
      owner: { select: { id: true, username: true, displayName: true } },
    },
  });
  if (!playlist) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Playlist not found");
  }
  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    visibility: playlist.visibility,
    forkOfPlaylistId: playlist.forkOfPlaylistId,
    owner: playlist.owner,
    tracks: await Promise.all(
      playlist.tracks.map(async (row) => ({
        trackId: row.trackId,
        position: row.position,
        track: await serializeTrack(row.trackId),
      })),
    ),
  };
}

async function serializeFavorite(trackId: string, createdAt: Date) {
  return {
    trackId,
    createdAt,
    track: await serializeTrack(trackId),
  };
}

export async function createPlaylist(
  userId: string,
  input: {
    title: string;
    description?: string;
    visibility?: "private" | "unlisted" | "public";
  },
) {
  return prisma.playlist.create({
    data: {
      userId,
      title: input.title.trim(),
      description: input.description,
      visibility: input.visibility ?? "private",
    },
  });
}

export async function listPlaylists(userId: string) {
  return prisma.playlist.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPlaylist(id: string, userId?: string) {
  const playlist = await prisma.playlist.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, visibility: true },
  });
  if (!playlist) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Playlist not found");
  }
  if (playlist.visibility !== "public" && playlist.userId !== userId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Playlist not found");
  }
  return serializePlaylistRecord(playlist.id);
}

export async function addPlaylistTrack(
  userId: string,
  playlistId: string,
  trackId: string,
) {
  await requireOwnedPlaylist(userId, playlistId);
  await requireTrack(trackId);
  const existing = await prisma.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId, trackId } },
  });
  if (existing) {
    return existing;
  }
  const last = await prisma.playlistTrack.aggregate({
    where: { playlistId },
    _max: { position: true },
  });
  try {
    return await prisma.playlistTrack.create({
      data: {
        playlistId,
        trackId,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.playlistTrack.findUnique({
        where: { playlistId_trackId: { playlistId, trackId } },
      });
      if (again) {
        return again;
      }
    }
    throw error;
  }
}

export async function removePlaylistTrack(
  userId: string,
  playlistId: string,
  trackId: string,
) {
  await requireOwnedPlaylist(userId, playlistId);
  const deleted = await prisma.playlistTrack.deleteMany({
    where: { playlistId, trackId },
  });
  if (deleted.count === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Track not in playlist");
  }
  const remaining = await prisma.playlistTrack.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
  });
  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((row, index) =>
        prisma.playlistTrack.update({
          where: { playlistId_trackId: { playlistId, trackId: row.trackId } },
          data: { position: index },
        }),
      ),
    );
  }
}

export async function reorderPlaylistTracks(
  userId: string,
  playlistId: string,
  trackIds: string[],
) {
  await requireOwnedPlaylist(userId, playlistId);
  const current = await prisma.playlistTrack.findMany({
    where: { playlistId },
  });
  if (current.length !== trackIds.length) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      "trackIds must list every track in the playlist",
    );
  }
  const currentSet = new Set(current.map((row) => row.trackId));
  if (
    new Set(trackIds).size !== trackIds.length ||
    trackIds.some((id) => !currentSet.has(id))
  ) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      "trackIds must be a permutation of the playlist",
    );
  }
  if (trackIds.length > 0) {
    await prisma.$transaction(
      trackIds.map((id, index) =>
        prisma.playlistTrack.update({
          where: { playlistId_trackId: { playlistId, trackId: id } },
          data: { position: index },
        }),
      ),
    );
  }
  return serializePlaylistRecord(playlistId);
}

export async function sharePlaylist(userId: string, playlistId: string) {
  const playlist = await requireOwnedPlaylist(userId, playlistId);
  const token = randomBytes(32).toString("base64url");
  await prisma.playlistShare.create({
    data: {
      playlistId,
      createdByUserId: userId,
      tokenHash: hashToken(token),
    },
  });
  if (playlist.visibility === "private") {
    await prisma.playlist.update({
      where: { id: playlistId },
      data: { visibility: "unlisted" },
    });
  }
  return { token, path: `/playlists/shared/${token}` };
}

export async function revokePlaylistShares(userId: string, playlistId: string) {
  await requireOwnedPlaylist(userId, playlistId);
  await prisma.playlistShare.updateMany({
    where: { playlistId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getPlaylistByShareToken(token: string) {
  const share = await prisma.playlistShare.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (
    !share ||
    share.revokedAt ||
    (share.expiresAt && share.expiresAt.getTime() < Date.now())
  ) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Share not found");
  }
  return getPlaylist(share.playlistId, share.createdByUserId);
}

export async function forkPlaylist(userId: string, playlistId: string) {
  const source = await getPlaylist(playlistId, userId);
  return copyPlaylistRefs(userId, source);
}

export async function forkPlaylistFromShareToken(userId: string, token: string) {
  const source = await getPlaylistByShareToken(token);
  return copyPlaylistRefs(userId, source);
}

async function copyPlaylistRefs(
  userId: string,
  source: Awaited<ReturnType<typeof getPlaylist>>,
) {
  const fork = await prisma.playlist.create({
    data: {
      userId,
      title: `${source.title} (fork)`,
      description: source.description,
      visibility: "private",
      forkOfPlaylistId: source.id,
    },
  });
  if (source.tracks.length > 0) {
    await prisma.playlistTrack.createMany({
      data: source.tracks.map((item) => ({
        playlistId: fork.id,
        trackId: item.trackId,
        position: item.position,
      })),
    });
  }
  return serializePlaylistRecord(fork.id);
}

export async function setFavorite(userId: string, trackId: string, favorite: boolean) {
  await requireTrack(trackId);
  if (favorite) {
    await prisma.favorite.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId },
      update: {},
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, trackId } });
  }
}

export async function getLibrary(userId: string) {
  const [favoriteRows, playlists, recents] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.playlist.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.playHistory.findMany({
      where: { userId },
      include: { track: true },
      orderBy: { playedAt: "desc" },
      take: 30,
    }),
  ]);
  const favorites = await Promise.all(
    favoriteRows.map((row) => serializeFavorite(row.trackId, row.createdAt)),
  );
  return { favorites, playlists, recents };
}

export async function updatePlaylist(
  userId: string,
  playlistId: string,
  input: {
    title?: string;
    description?: string;
    visibility?: "private" | "unlisted" | "public";
  },
) {
  await requireOwnedPlaylist(userId, playlistId);
  return prisma.playlist.update({
    where: { id: playlistId },
    data: {
      title: input.title?.trim(),
      description: input.description,
      visibility: input.visibility,
    },
  });
}

export async function deletePlaylist(userId: string, playlistId: string) {
  await requireOwnedPlaylist(userId, playlistId);
  await prisma.playlist.update({
    where: { id: playlistId },
    data: { deletedAt: new Date() },
  });
}

export async function listFavorites(userId: string) {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Promise.all(rows.map((row) => serializeFavorite(row.trackId, row.createdAt)));
}
