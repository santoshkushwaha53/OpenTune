import type {
  MusicProvider,
  ProviderAlbum,
  ProviderArtist,
  ProviderCapabilities,
  ProviderHealth,
  ProviderLicense,
  ProviderMediaSource,
  ProviderSearchResult,
  ProviderTrack,
} from "../core/types.js";

const CC_BY: ProviderLicense = {
  spdxId: "CC-BY-4.0",
  name: "Creative Commons Attribution 4.0 International",
  url: "https://creativecommons.org/licenses/by/4.0/",
  requiresAttribution: true,
  allowsStreaming: true,
  allowsDownload: true,
};

const TRACKS: ProviderTrack[] = [
  {
    externalId: "fake-1",
    title: "Open Horizon",
    durationMs: 180_000,
    artistName: "Northwind",
    artistExternalId: "fake-artist-1",
    albumTitle: "Public Skies",
    albumExternalId: "fake-album-1",
    artworkUrl: "https://example.invalid/art/open-horizon.jpg",
    license: CC_BY,
    attributionText: '"Open Horizon" by Northwind. CC BY 4.0.',
    capabilities: { supportsStreaming: true, supportsDownload: true },
  },
  {
    externalId: "fake-2",
    title: "Harbor Lights",
    durationMs: 210_000,
    artistName: "Northwind",
    artistExternalId: "fake-artist-1",
    albumTitle: "Public Skies",
    albumExternalId: "fake-album-1",
    artworkUrl: "https://example.invalid/art/harbor-lights.jpg",
    license: CC_BY,
    attributionText: '"Harbor Lights" by Northwind. CC BY 4.0.',
    capabilities: { supportsStreaming: true, supportsDownload: false },
  },
];

const ALBUM: ProviderAlbum = {
  externalId: "fake-album-1",
  title: "Public Skies",
  artistName: "Northwind",
  artworkUrl: "https://example.invalid/art/public-skies.jpg",
  trackExternalIds: ["fake-1", "fake-2"],
};

const ARTIST: ProviderArtist = {
  externalId: "fake-artist-1",
  name: "Northwind",
  artworkUrl: "https://example.invalid/art/northwind.jpg",
};

/**
 * In-memory catalog for tests. Not registered outside NODE_ENV=test.
 * Includes one downloadable track and one stream-only track.
 */
export class FakeProvider implements MusicProvider {
  readonly id: string = "fake";
  readonly name: string = "Fake Open Catalog";
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsDownload: true,
    supportsOffline: true,
    supportsRedistribution: false,
    requiresAttribution: true,
  };

  async search(
    query: string,
    options?: { limit?: number },
  ): Promise<ProviderSearchResult[]> {
    const q = query.trim().toLowerCase();
    const matches = TRACKS.filter(
      (track) =>
        track.title.toLowerCase().includes(q) ||
        track.artistName.toLowerCase().includes(q) ||
        q === "*" ||
        q.length === 0,
    );
    return matches.slice(0, options?.limit ?? 20);
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    return TRACKS.find((track) => track.externalId === externalId) ?? null;
  }

  async getAlbum(externalId: string): Promise<ProviderAlbum | null> {
    return ALBUM.externalId === externalId ? ALBUM : null;
  }

  async getArtist(externalId: string): Promise<ProviderArtist | null> {
    return ARTIST.externalId === externalId ? ARTIST : null;
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    const track = await this.getTrack(externalId);
    if (!track?.capabilities.supportsStreaming) {
      return null;
    }
    return {
      url: `https://example.invalid/stream/${externalId}.mp3`,
      mimeType: "audio/mpeg",
    };
  }

  async getDownloadSource(externalId: string): Promise<ProviderMediaSource | null> {
    const track = await this.getTrack(externalId);
    if (!track?.capabilities.supportsDownload) {
      return null;
    }
    return {
      url: `https://example.invalid/download/${externalId}.mp3`,
      mimeType: "audio/mpeg",
    };
  }

  async getLicense(externalId: string): Promise<ProviderLicense | null> {
    return (await this.getTrack(externalId))?.license ?? null;
  }

  async getAttribution(externalId: string): Promise<string | null> {
    return (await this.getTrack(externalId))?.attributionText ?? null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, latencyMs: 1 };
  }
}

/**
 * Test-only connector whose healthCheck result can be flipped.
 * Search stays empty so an enabled instance does not duplicate catalog hits.
 */
export class ControllableHealthFakeProvider extends FakeProvider {
  readonly id = "fake-health";
  readonly name = "Fake Health Catalog";
  healthy = false;

  async search(
    _query: string,
    _options?: { limit?: number },
  ): Promise<ProviderSearchResult[]> {
    return [];
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.healthy) {
      return { ok: false, latencyMs: 2, message: "forced down" };
    }
    return { ok: true, latencyMs: 1 };
  }
}

/** Provider-level stream-only connector. getDownloadSource must stay unused. */
export class StreamOnlyFakeProvider implements MusicProvider {
  readonly id = "fake-stream";
  readonly name = "Fake Stream Catalog";
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsDownload: false,
    supportsOffline: false,
    supportsRedistribution: false,
    requiresAttribution: true,
  };

  async search(query: string): Promise<ProviderSearchResult[]> {
    const q = query.trim().toLowerCase();
    return TRACKS.filter(
      (track) =>
        track.title.toLowerCase().includes(q) ||
        track.artistName.toLowerCase().includes(q),
    ).map((track) => ({
      ...track,
      capabilities: { supportsStreaming: true, supportsDownload: false },
    }));
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    const track = TRACKS.find((item) => item.externalId === externalId);
    if (!track) {
      return null;
    }
    return {
      ...track,
      capabilities: { supportsStreaming: true, supportsDownload: false },
    };
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    const track = await this.getTrack(externalId);
    if (!track) {
      return null;
    }
    return {
      url: `https://example.invalid/stream/${externalId}.mp3`,
      mimeType: "audio/mpeg",
    };
  }

  async getDownloadSource(_externalId: string): Promise<ProviderMediaSource | null> {
    return null;
  }

  async getLicense(externalId: string): Promise<ProviderLicense | null> {
    return (await this.getTrack(externalId))?.license ?? null;
  }

  async getAttribution(externalId: string): Promise<string | null> {
    return (await this.getTrack(externalId))?.attributionText ?? null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, latencyMs: 1 };
  }
}
