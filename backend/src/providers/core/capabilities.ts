import type {
  MusicProvider,
  ProviderMediaSource,
  TrackMediaCapabilities,
} from "./types.js";

/**
 * Never invent a download from a stream-only provider or track.
 * The source resolver and connectors must go through this helper.
 */
export function allowsDownload(
  provider: Pick<MusicProvider, "capabilities">,
  track?: TrackMediaCapabilities,
): boolean {
  if (!provider.capabilities.supportsDownload) {
    return false;
  }
  if (track && !track.supportsDownload) {
    return false;
  }
  return true;
}

export function allowsStreaming(
  provider: Pick<MusicProvider, "capabilities">,
  track?: TrackMediaCapabilities,
): boolean {
  if (!provider.capabilities.supportsStreaming) {
    return false;
  }
  if (track && !track.supportsStreaming) {
    return false;
  }
  return true;
}

export async function permittedPlaybackSource(
  provider: MusicProvider,
  externalId: string,
  track?: TrackMediaCapabilities,
): Promise<ProviderMediaSource | null> {
  if (!allowsStreaming(provider, track)) {
    return null;
  }
  return provider.getPlaybackSource(externalId);
}

export async function permittedDownloadSource(
  provider: MusicProvider,
  externalId: string,
  track?: TrackMediaCapabilities,
): Promise<ProviderMediaSource | null> {
  if (!allowsDownload(provider, track)) {
    return null;
  }
  return provider.getDownloadSource(externalId);
}
