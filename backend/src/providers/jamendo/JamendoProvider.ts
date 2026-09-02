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
import { isAllowedJamendoUrl, licenseFromJamendoUrl } from "./licenses.js";
import { jamendoFuzzyTags, jamendoHasTagAlias } from "./tags.js";

export type JamendoTrackPayload = {
  id?: string;
  name?: string;
  duration?: number;
  artist_id?: string;
  artist_name?: string;
  album_name?: string;
  album_id?: string;
  image?: string;
  album_image?: string;
  releasedate?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
};

type FetchLike = typeof fetch;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
};

/**
 * Official Jamendo API connector (https://developer.jamendo.com/v3.0).
 * Requests metadata JSON only. Playback/download URLs are returned to the
 * client; this class never downloads audio bytes.
 */
export class JamendoProvider implements MusicProvider {
  readonly id = "jamendo";
  readonly name = "Jamendo";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private readonly clientId: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://api.jamendo.com/v3.0",
  ) {}

  async search(
    query: string,
    options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const params: Record<string, string> = {
      limit: String(limit),
      include: "licenses",
      audioformat: "mp32",
    };
    const between = jamendoDateBetween(options?.yearFrom, options?.yearTo);
    if (between) {
      params.datebetween = between;
    }

    const q = query.trim();
    const rows: JamendoTrackPayload[] = [];
    const seen = new Set<string>();
    const ingest = (batch?: JamendoTrackPayload[]) => {
      for (const row of batch ?? []) {
        const id = row.id;
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        rows.push(row);
        if (rows.length >= limit) {
          return;
        }
      }
    };

    if (q && !jamendoHasTagAlias(q)) {
      ingest((await this.request("tracks", { ...params, search: q })).results);
    } else if (!q) {
      ingest((await this.request("tracks", params)).results);
    }

    const tags = jamendoFuzzyTags(q, rows.length);
    if (rows.length < limit && tags.length > 0) {
      ingest(
        (
          await this.request("tracks", {
            ...params,
            fuzzytags: tags.join(" "),
            boost: "popularity_month",
          })
        ).results,
      );
    }

    return rows
      .map((row) => this.mapTrack(row))
      .filter((track): track is ProviderTrack => track !== null)
      .slice(0, limit);
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    const row = await this.loadRow(externalId);
    return row ? this.mapTrack(row) : null;
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    const row = await this.loadRow(externalId);
    if (!row || !licenseFromJamendoUrl(row.license_ccurl)) {
      return null;
    }
    if (!row.audio || !isAllowedJamendoUrl(row.audio)) {
      return null;
    }
    return { url: row.audio, mimeType: "audio/mpeg" };
  }

  async getDownloadSource(externalId: string): Promise<ProviderMediaSource | null> {
    const row = await this.loadRow(externalId);
    if (!row || !licenseFromJamendoUrl(row.license_ccurl)) {
      return null;
    }
    // Never fall back to the streaming `audio` field.
    if (!row.audiodownload_allowed || !row.audiodownload) {
      return null;
    }
    if (!isAllowedJamendoUrl(row.audiodownload)) {
      return null;
    }
    return { url: row.audiodownload, mimeType: "audio/mpeg" };
  }

  async getLicense(externalId: string): Promise<ProviderLicense | null> {
    return (await this.getTrack(externalId))?.license ?? null;
  }

  async getAttribution(externalId: string): Promise<string | null> {
    return (await this.getTrack(externalId))?.attributionText ?? null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.clientId) {
      return {
        ok: false,
        latencyMs: 0,
        message: "JAMENDO_CLIENT_ID is not configured",
      };
    }
    const started = Date.now();
    try {
      await this.request("tracks", { limit: "1" });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  }

  private async loadRow(externalId: string): Promise<JamendoTrackPayload | null> {
    const data = await this.request("tracks", {
      id: externalId,
      include: "licenses",
      audioformat: "mp32",
    });
    return data.results?.[0] ?? null;
  }

  private mapTrack(row: JamendoTrackPayload): ProviderTrack | null {
    const license = licenseFromJamendoUrl(row.license_ccurl);
    if (!license || !row.id || !row.name || !row.artist_name) {
      return null;
    }
    const durationMs = Math.max(0, Math.round((row.duration ?? 0) * 1000));
    const download = Boolean(
      row.audiodownload_allowed &&
      row.audiodownload &&
      isAllowedJamendoUrl(row.audiodownload),
    );
    const artwork = [row.image, row.album_image].find(
      (url) => url && isAllowedJamendoUrl(url),
    );
    const releasedYear = parseReleasedYear(row.releasedate);
    return {
      externalId: String(row.id),
      title: row.name,
      durationMs,
      artistName: row.artist_name,
      artistExternalId: String(row.artist_id ?? row.artist_name),
      albumTitle: row.album_name,
      albumExternalId: row.album_id ? String(row.album_id) : undefined,
      artworkUrl: artwork,
      releasedYear,
      license,
      attributionText: `"${row.name}" by ${row.artist_name}. ${license.spdxId}. Source: Jamendo.`,
      capabilities: {
        supportsStreaming: true,
        supportsDownload: download,
      },
    };
  }

  private async request(
    resource: string,
    params: Record<string, string>,
  ): Promise<{ results?: JamendoTrackPayload[] }> {
    if (!this.clientId) {
      throw new ProviderError("Jamendo client id is not configured", this.id);
    }
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${resource}/`);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (!isAllowedJamendoUrl(url.toString())) {
      throw new ProviderError(
        "Refusing to call a non-allowlisted Jamendo URL",
        this.id,
      );
    }
    const response = await this.fetchImpl(url, { method: "GET", redirect: "error" });
    if (!response.ok) {
      throw new ProviderError(`Jamendo HTTP ${response.status}`, this.id);
    }
    return (await response.json()) as { results?: JamendoTrackPayload[] };
  }
}

function jamendoDateBetween(yearFrom?: number, yearTo?: number) {
  if (yearFrom == null && yearTo == null) {
    return undefined;
  }
  const start = yearFrom ?? yearTo!;
  const end = yearTo ?? yearFrom!;
  return `${start}-01-01_${end}-12-31`;
}

function parseReleasedYear(value?: string) {
  if (!value) {
    return undefined;
  }
  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) && year >= 1950 && year <= 2030 ? year : undefined;
}
