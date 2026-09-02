import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";
import {
  permittedDownloadSource,
  permittedPlaybackSource,
} from "../providers/core/capabilities.js";
import { providerRegistry } from "../providers/core/registry.js";
import type { ProviderMediaSource } from "../providers/core/types.js";

import { sanitizeProviderMediaUrl } from "./hosts.js";

/**
 * Track → Source Resolver → enabled providers → permitted playback/download URLs.
 * Resolves at request time. Does not persist audio URLs or fetch media bytes.
 */
export async function resolveTrackSources(trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, deletedAt: null },
    include: {
      trackSources: { include: { license: true, provider: true } },
    },
  });
  if (!track) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Track not found");
  }

  const sources = [];
  for (const row of track.trackSources) {
    const provider = providerRegistry.get(row.provider.slug);
    if (!provider || !row.provider.isEnabled) {
      sources.push(decorateSource(row, null, null));
      continue;
    }
    const flags = {
      supportsStreaming: row.supportsStreaming,
      supportsDownload: row.supportsDownload,
    };
    const playback = sanitizeMedia(
      row.provider.slug,
      await permittedPlaybackSource(provider, row.externalTrackId, flags),
    );
    const download = sanitizeMedia(
      row.provider.slug,
      await permittedDownloadSource(provider, row.externalTrackId, flags),
    );
    sources.push(decorateSource(row, playback, download));
  }

  return { trackId: track.id, sources };
}

function sanitizeMedia(
  slug: string,
  source: ProviderMediaSource | null,
): ProviderMediaSource | null {
  if (!source) {
    return null;
  }
  const url = sanitizeProviderMediaUrl(slug, source.url);
  if (!url) {
    return null;
  }
  return { ...source, url };
}

function decorateSource(
  row: {
    id: string;
    externalTrackId: string;
    attributionText: string;
    supportsStreaming: boolean;
    supportsDownload: boolean;
    provider: { slug: string; name: string };
    license: {
      spdxId: string;
      name: string;
      url: string;
      requiresAttribution: boolean;
    };
  },
  playback: ProviderMediaSource | null,
  download: ProviderMediaSource | null,
) {
  return {
    id: row.id,
    provider: row.provider.slug,
    providerName: row.provider.name,
    externalTrackId: row.externalTrackId,
    attributionText: row.attributionText,
    supportsStreaming: row.supportsStreaming && playback !== null,
    supportsDownload: row.supportsDownload && download !== null,
    license: {
      spdxId: row.license.spdxId,
      name: row.license.name,
      url: row.license.url,
      requiresAttribution: row.license.requiresAttribution,
    },
    playbackUrl: playback?.url ?? null,
    downloadUrl: download?.url ?? null,
    playbackExpiresAt: playback?.expiresAt ?? null,
    downloadExpiresAt: download?.expiresAt ?? null,
  };
}
