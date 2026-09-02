import { ProviderError } from "../core/errors.js";
import type {
  MusicProvider,
  ProviderCapabilities,
  ProviderHealth,
  ProviderLicense,
  ProviderMediaSource,
  ProviderSearchOptions,
  ProviderSearchResult,
  ProviderTrack,
} from "../core/types.js";
import {
  isAllowedYoutubeUrl,
  sanitizeYoutubeVideoId,
  YOUTUBE_STREAM_LICENSE,
  youtubeWatchUrl,
} from "./licenses.js";

export type YoutubeSearchItem = {
  id?: { videoId?: string };
  snippet?: YoutubeSnippet;
};

export type YoutubeVideoItem = {
  id?: string;
  snippet?: YoutubeSnippet;
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
};

type YoutubeSnippet = {
  title?: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
  liveBroadcastContent?: string;
  thumbnails?: Record<string, { url?: string } | undefined>;
};

type FetchLike = typeof fetch;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsDownload: false,
  supportsOffline: false,
  supportsRedistribution: false,
  requiresAttribution: true,
};

/**
 * Official YouTube Data API v3 (https://developers.google.com/youtube/v3).
 * Metadata JSON only. The Flutter app plays videoId in YouTube's official
 * player. This class never fetches audio/video bytes and never invents a download.
 */
export class YoutubeProvider implements MusicProvider {
  readonly id = "youtube";
  readonly name = "YouTube";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://www.googleapis.com/youtube/v3",
  ) {}

  async search(
    query: string,
    options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    if (!this.apiKey) {
      return [];
    }
    const q = query.trim();
    if (!q || q === "*") {
      return [];
    }
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const search = await this.request<{ items?: YoutubeSearchItem[] }>("search", {
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      maxResults: String(limit),
      q,
    });
    const ids = (search.items ?? [])
      .map((item) => sanitizeYoutubeVideoId(item.id?.videoId))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return [];
    }
    const details = await this.request<{ items?: YoutubeVideoItem[] }>("videos", {
      part: "snippet,contentDetails,status",
      id: ids.join(","),
    });
    const mapped: ProviderTrack[] = [];
    const seen = new Set<string>();
    for (const row of details.items ?? []) {
      const track = this.mapVideo(row);
      if (!track || seen.has(track.externalId)) {
        continue;
      }
      if (!yearInRange(track.releasedYear, options)) {
        continue;
      }
      seen.add(track.externalId);
      mapped.push(track);
      if (mapped.length >= limit) {
        break;
      }
    }
    return mapped;
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    return this.mapVideo(await this.loadVideo(externalId));
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    const video = this.mapVideo(await this.loadVideo(externalId));
    if (!video) {
      return null;
    }
    const url = youtubeWatchUrl(video.externalId);
    if (!url) {
      return null;
    }
    return { url, mimeType: "text/html" };
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
    if (!this.apiKey) {
      return {
        ok: false,
        latencyMs: 0,
        message: "YOUTUBE_API_KEY is not configured",
      };
    }
    const started = Date.now();
    try {
      await this.search("piano", { limit: 1 });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  }

  private async loadVideo(externalId: string): Promise<YoutubeVideoItem | null> {
    const id = sanitizeYoutubeVideoId(externalId);
    if (!id || !this.apiKey) {
      return null;
    }
    const payload = await this.request<{ items?: YoutubeVideoItem[] }>("videos", {
      part: "snippet,contentDetails,status",
      id,
    });
    return payload.items?.[0] ?? null;
  }

  private mapVideo(row: YoutubeVideoItem | null): ProviderTrack | null {
    if (!row) {
      return null;
    }
    const id = sanitizeYoutubeVideoId(row.id);
    const snippet = row.snippet;
    const title = snippet?.title?.trim();
    const artistName = snippet?.channelTitle?.trim() || "YouTube";
    if (!id || !title || snippet?.liveBroadcastContent === "live") {
      return null;
    }
    if (row.status?.embeddable === false) {
      return null;
    }
    const artwork = pickArtwork(snippet?.thumbnails);
    return {
      externalId: id,
      title,
      durationMs: parseIsoDurationMs(row.contentDetails?.duration),
      artistName,
      artistExternalId: snippet?.channelId || slugify(artistName),
      artworkUrl: artwork && isAllowedYoutubeUrl(artwork) ? artwork : undefined,
      releasedYear: parseReleasedYear(snippet?.publishedAt),
      license: YOUTUBE_STREAM_LICENSE,
      attributionText: `"${title}" by ${artistName}. Stream on YouTube. Source: YouTube.`,
      capabilities: {
        supportsStreaming: true,
        supportsDownload: false,
      },
    };
  }

  private async request<T>(
    resource: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${resource}`);
    url.searchParams.set("key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (!isAllowedYoutubeUrl(url.toString())) {
      throw new ProviderError(
        "Refusing to call a non-allowlisted YouTube URL",
        this.id,
      );
    }
    const response = await this.fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new ProviderError(`YouTube HTTP ${response.status}`, this.id);
    }
    return (await response.json()) as T;
  }
}

function pickArtwork(
  thumbs: Record<string, { url?: string } | undefined> | undefined,
): string | undefined {
  return thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url;
}

function parseIsoDurationMs(value?: string): number {
  if (!value) {
    return 0;
  }
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function parseReleasedYear(value?: string) {
  if (!value) {
    return undefined;
  }
  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) && year >= 1950 && year <= 2030 ? year : undefined;
}

function yearInRange(
  year: number | undefined,
  options?: ProviderSearchOptions,
): boolean {
  if (options?.yearFrom != null && (year == null || year < options.yearFrom)) {
    return false;
  }
  if (options?.yearTo != null && (year == null || year > options.yearTo)) {
    return false;
  }
  return true;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "artist"
  );
}
