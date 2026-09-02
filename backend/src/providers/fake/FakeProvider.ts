import type {
  MusicProvider,
  ProviderAlbum,
  ProviderArtist,
  ProviderCapabilities,
  ProviderHealth,
  ProviderLicense,
  ProviderMediaSource,
  ProviderSearchOptions,
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

type FakeTrack = ProviderTrack & { tags: string[] };

const TRACKS: FakeTrack[] = [
  makeTrack(
    "fake-1",
    "Open Horizon",
    "Northwind",
    "fake-artist-1",
    "Public Skies",
    true,
    ["ambient", "acoustic"],
  ),
  makeTrack(
    "fake-2",
    "Harbor Lights",
    "Northwind",
    "fake-artist-1",
    "Public Skies",
    false,
    ["ambient"],
  ),
  makeTrack(
    "fake-3",
    "Morning Light",
    "Cedar Room",
    "fake-artist-2",
    "Daybreak",
    true,
    ["acoustic", "morning", "indie"],
  ),
  makeTrack("fake-4", "Sunset Drive", "Lumen Park", "fake-artist-3", "Highways", true, [
    "electronic",
    "driving",
    "travel",
  ]),
  makeTrack("fake-5", "Quiet Study", "Kite Lantern", "fake-artist-4", "Pages", true, [
    "lofi",
    "study",
    "focus",
  ]),
  makeTrack("fake-6", "River Atlas", "Glass Haven", "fake-artist-5", "Maps", true, [
    "folk",
    "world",
    "acoustic",
  ]),
  makeTrack(
    "fake-7",
    "Temple Bells",
    "Saffron Line",
    "fake-artist-6",
    "Dusk Raga",
    true,
    ["indian pop", "hindi", "devotional"],
  ),
  makeTrack(
    "fake-8",
    "Neon Courtyard",
    "Indigo Current",
    "fake-artist-7",
    "After Hours",
    true,
    ["electronic", "party", "night"],
  ),
  makeTrack("fake-9", "Paper Kite", "Willow Circuit", "fake-artist-8", "Drafts", true, [
    "indie",
    "relax",
    "english vocal",
  ]),
  makeTrack("fake-10", "Coastal Jazz", "Blue Veranda", "fake-artist-9", "Porch", true, [
    "jazz",
    "relax",
    "instrumental",
  ]),
  makeTrack("fake-11", "Steel Pulse", "Iron Orchard", "fake-artist-10", "Forge", true, [
    "rock",
    "workout",
  ]),
  makeTrack(
    "fake-12",
    "Midnight Echo",
    "Soft Antenna",
    "fake-artist-11",
    "Signals",
    true,
    ["ambient", "meditation", "night"],
  ),
  makeTrack(
    "fake-13",
    "Canvas Folk",
    "Meadow Static",
    "fake-artist-12",
    "Fields",
    true,
    ["folk", "acoustic", "english vocal"],
  ),
];

function makeTrack(
  externalId: string,
  title: string,
  artistName: string,
  artistExternalId: string,
  albumTitle: string,
  download: boolean,
  tags: string[],
): ProviderTrack & { tags: string[] } {
  const n = Number(externalId.replace("fake-", ""));
  const durationMs =
    externalId === "fake-1"
      ? 180_000
      : externalId === "fake-2"
        ? 210_000
        : 180_000 + n * 5_000;
  return {
    externalId,
    title,
    durationMs,
    artistName,
    artistExternalId,
    albumTitle,
    albumExternalId: `fake-album-${artistExternalId}`,
    artworkUrl: `https://example.invalid/art/${externalId}.jpg`,
    releasedYear: 2017 + n,
    license: CC_BY,
    attributionText: `"${title}" by ${artistName}. CC BY 4.0.`,
    capabilities: { supportsStreaming: true, supportsDownload: download },
    tags,
  };
}

function matchesQuery(track: (typeof TRACKS)[number], q: string): boolean {
  if (!q || q === "*") {
    return true;
  }
  const haystack = [
    track.title,
    track.artistName,
    track.albumTitle ?? "",
    String(track.releasedYear ?? ""),
    ...track.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q) || track.tags.some((tag) => tag === q);
}

const ALBUM: ProviderAlbum = {
  externalId: "fake-album-1",
  title: "Public Skies",
  artistName: "Northwind",
  artworkUrl: "https://example.invalid/art/public-skies.jpg",
  trackExternalIds: ["fake-1", "fake-2"],
};

/**
 * In-memory catalog for tests. Not registered outside NODE_ENV=test.
 * Includes downloadable tracks plus one stream-only Harbor Lights row.
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
    options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    const q = query.trim().toLowerCase();
    const matches = TRACKS.filter((track) => {
      if (!matchesQuery(track, q)) {
        return false;
      }
      const year = track.releasedYear;
      if (options?.yearFrom != null && (year == null || year < options.yearFrom)) {
        return false;
      }
      if (options?.yearTo != null && (year == null || year > options.yearTo)) {
        return false;
      }
      return true;
    });
    return matches.slice(0, options?.limit ?? 20);
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    return TRACKS.find((track) => track.externalId === externalId) ?? null;
  }

  async getAlbum(externalId: string): Promise<ProviderAlbum | null> {
    return ALBUM.externalId === externalId ? ALBUM : null;
  }

  async getArtist(externalId: string): Promise<ProviderArtist | null> {
    const track = TRACKS.find((item) => item.artistExternalId === externalId);
    if (!track) {
      return null;
    }
    return {
      externalId: track.artistExternalId,
      name: track.artistName,
      artworkUrl: track.artworkUrl,
    };
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
    _options?: ProviderSearchOptions,
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
