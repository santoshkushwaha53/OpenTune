import { prisma } from "../db/prisma.js";
import type { ProviderTrack } from "../providers/core/types.js";
import { canonicalKey, slugify } from "./canonical.js";

export async function persistProviderTrack(providerSlug: string, track: ProviderTrack) {
  const provider = await prisma.provider.findUnique({ where: { slug: providerSlug } });
  if (!provider) {
    throw new Error(`Unknown provider ${providerSlug}`);
  }

  const license = await prisma.license.upsert({
    where: { spdxId: track.license.spdxId },
    create: {
      spdxId: track.license.spdxId,
      name: track.license.name,
      url: track.license.url,
      allowsStreaming: track.license.allowsStreaming,
      allowsDownload: track.license.allowsDownload,
      requiresAttribution: track.license.requiresAttribution,
      allowsRedistribution: true,
    },
    update: {},
  });

  const artistSlug =
    `${slugify(track.artistName)}-${slugify(track.artistExternalId)}`.slice(0, 100);
  const artist = await prisma.artist.upsert({
    where: { slug: artistSlug },
    create: { name: track.artistName, slug: artistSlug, artworkUrl: track.artworkUrl },
    update: { name: track.artistName },
  });

  let albumId: string | undefined;
  if (track.albumTitle) {
    const existingAlbum = await prisma.album.findFirst({
      where: {
        title: track.albumTitle,
        albumArtists: { some: { artistId: artist.id } },
      },
    });
    if (existingAlbum) {
      albumId = existingAlbum.id;
    } else {
      const album = await prisma.album.create({
        data: {
          title: track.albumTitle,
          artworkUrl: track.artworkUrl,
          albumArtists: {
            create: { artistId: artist.id, role: "primary", position: 0 },
          },
        },
      });
      albumId = album.id;
    }
  }

  const key = canonicalKey(track.title, track.artistName, track.durationMs);
  const existing = await prisma.track.findFirst({
    where: { canonicalKey: key, deletedAt: null },
    include: { trackSources: true },
  });

  const trackRow =
    existing ??
    (await prisma.track.create({
      data: {
        title: track.title,
        durationMs: track.durationMs,
        albumId,
        artworkUrl: track.artworkUrl,
        canonicalKey: key,
        trackArtists: {
          create: { artistId: artist.id, role: "primary", position: 0 },
        },
      },
      include: { trackSources: true },
    }));

  const source = await prisma.trackSource.upsert({
    where: {
      providerId_externalTrackId: {
        providerId: provider.id,
        externalTrackId: track.externalId,
      },
    },
    create: {
      trackId: trackRow.id,
      providerId: provider.id,
      externalTrackId: track.externalId,
      licenseId: license.id,
      attributionText: track.attributionText,
      supportsStreaming: track.capabilities.supportsStreaming,
      supportsDownload: track.capabilities.supportsDownload,
    },
    update: {
      licenseId: license.id,
      attributionText: track.attributionText,
      supportsStreaming: track.capabilities.supportsStreaming,
      supportsDownload: track.capabilities.supportsDownload,
    },
    include: { license: true, provider: true },
  });

  return { track: trackRow, source, artist };
}
