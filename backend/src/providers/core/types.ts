export type ProviderCapabilities = {
  supportsStreaming: boolean;
  supportsDownload: boolean;
  supportsOffline: boolean;
  supportsRedistribution: boolean;
  requiresAttribution: boolean;
};

export type ProviderLicense = {
  spdxId: string;
  name: string;
  url: string;
  requiresAttribution: boolean;
  allowsStreaming: boolean;
  allowsDownload: boolean;
};

export type TrackMediaCapabilities = Pick<
  ProviderCapabilities,
  "supportsStreaming" | "supportsDownload"
>;

export type ProviderTrack = {
  externalId: string;
  title: string;
  durationMs: number;
  artistName: string;
  artistExternalId: string;
  albumTitle?: string;
  albumExternalId?: string;
  artworkUrl?: string;
  license: ProviderLicense;
  attributionText: string;
  capabilities: TrackMediaCapabilities;
};

export type ProviderSearchResult = ProviderTrack;

export type ProviderAlbum = {
  externalId: string;
  title: string;
  artistName: string;
  artworkUrl?: string;
  trackExternalIds: string[];
};

export type ProviderArtist = {
  externalId: string;
  name: string;
  artworkUrl?: string;
};

export type ProviderPlaylist = {
  externalId: string;
  title: string;
  trackExternalIds: string[];
};

export type ProviderMediaSource = {
  url: string;
  mimeType?: string;
  expiresAt?: string;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs: number;
  message?: string;
};

/**
 * Connector contract. Optional methods may be omitted when a catalog does not
 * expose that resource. Callers must check `capabilities` and method presence
 * instead of assuming every provider streams, downloads, or has playlists.
 */
export interface MusicProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  search(query: string, options?: { limit?: number }): Promise<ProviderSearchResult[]>;
  getTrack(externalId: string): Promise<ProviderTrack | null>;
  getAlbum?(externalId: string): Promise<ProviderAlbum | null>;
  getArtist?(externalId: string): Promise<ProviderArtist | null>;
  getPlaylist?(externalId: string): Promise<ProviderPlaylist | null>;
  getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null>;
  getDownloadSource(externalId: string): Promise<ProviderMediaSource | null>;
  getLicense(externalId: string): Promise<ProviderLicense | null>;
  getAttribution(externalId: string): Promise<string | null>;
  healthCheck(): Promise<ProviderHealth>;
}
