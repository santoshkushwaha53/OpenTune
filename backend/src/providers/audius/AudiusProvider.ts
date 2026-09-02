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
import { isAllowedAudiusUrl, licenseFromAudius } from "./licenses.js";
import { audiusSearchQueries } from "./queries.js";

export type AudiusTrackPayload = {
  id?: string;
  title?: string;
  duration?: number;
  is_downloadable?: boolean;
  license?: string;
  created_at?: string;
  artwork?: Record<string, string | undefined>;
  user?: { id?: string; name?: string; handle?: string };
};

type FetchLike = typeof fetch;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
};

const APP_NAME = "opentune";

/**
 * Official Audius API connector (https://docs.audius.co/api).
 * Metadata JSON only. Playback/download URLs are returned to the client.
 */
export class AudiusProvider implements MusicProvider {
  readonly id = "audius";
  readonly name = "Audius";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://api.audius.co/v1",
  ) {}

  async search(
    query: string,
    options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const queries = audiusSearchQueries(query);
    if (queries.length === 0) {
      return [];
    }
    const mapped: ProviderTrack[] = [];
    const seen = new Set<string>();
    for (const q of queries) {
      if (mapped.length >= limit) {
        break;
      }
      let payload: { data?: AudiusTrackPayload[] | AudiusTrackPayload };
      try {
        payload = await this.request("tracks/search", {
          query: q,
          limit: String(limit),
        });
      } catch {
        continue;
      }
      const rows = Array.isArray(payload.data)
        ? payload.data
        : payload.data
          ? [payload.data]
          : [];
      for (const row of rows) {
        const track = this.mapTrack(row);
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
    }
    return mapped;
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    const row = await this.loadRow(externalId);
    return row ? this.mapTrack(row) : null;
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    const row = await this.loadRow(externalId);
    if (!row || !licenseFromAudius(row.license)) {
      return null;
    }
    const url = this.mediaUrl(externalId, "stream");
    if (!isAllowedAudiusUrl(url)) {
      return null;
    }
    return { url, mimeType: "audio/mpeg" };
  }

  async getDownloadSource(externalId: string): Promise<ProviderMediaSource | null> {
    const row = await this.loadRow(externalId);
    if (!row || !licenseFromAudius(row.license) || !row.is_downloadable) {
      return null;
    }
    const url = this.mediaUrl(externalId, "download");
    if (!isAllowedAudiusUrl(url)) {
      return null;
    }
    return { url, mimeType: "audio/mpeg" };
  }

  async getLicense(externalId: string): Promise<ProviderLicense | null> {
    return (await this.getTrack(externalId))?.license ?? null;
  }

  async getAttribution(externalId: string): Promise<string | null> {
    return (await this.getTrack(externalId))?.attributionText ?? null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await this.request("tracks/search", { query: "piano", limit: "1" });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  }

  private async loadRow(externalId: string): Promise<AudiusTrackPayload | null> {
    const data = await this.request(`tracks/${encodeURIComponent(externalId)}`, {});
    if (Array.isArray(data.data)) {
      return data.data[0] ?? null;
    }
    return data.data ?? null;
  }

  private mapTrack(row: AudiusTrackPayload): ProviderTrack | null {
    const license = licenseFromAudius(row.license);
    if (!license || !row.id || !row.title || !row.user?.name) {
      return null;
    }
    const artwork = Object.values(row.artwork ?? {}).find(
      (url) => url && isAllowedAudiusUrl(url),
    );
    const durationMs = Math.max(0, Math.round((row.duration ?? 0) * 1000));
    const download = Boolean(row.is_downloadable);
    return {
      externalId: String(row.id),
      title: row.title,
      durationMs,
      artistName: row.user.name,
      artistExternalId: String(row.user.id ?? row.user.handle ?? row.user.name),
      artworkUrl: artwork,
      releasedYear: parseReleasedYear(row.created_at),
      license,
      attributionText: `"${row.title}" by ${row.user.name}. ${license.spdxId}. Source: Audius.`,
      capabilities: {
        supportsStreaming: true,
        supportsDownload: download,
      },
    };
  }

  private mediaUrl(externalId: string, kind: "stream" | "download"): string {
    const root = this.baseUrl.replace(/\/$/, "");
    return `${root}/tracks/${encodeURIComponent(externalId)}/${kind}?app_name=${APP_NAME}`;
  }

  private async request(
    resource: string,
    params: Record<string, string>,
  ): Promise<{ data?: AudiusTrackPayload[] | AudiusTrackPayload }> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${resource}`);
    url.searchParams.set("app_name", APP_NAME);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (!isAllowedAudiusUrl(url.toString())) {
      throw new ProviderError("Refusing to call a non-allowlisted Audius URL", this.id);
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    const response = await this.fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers,
    });
    if (!response.ok) {
      throw new ProviderError(`Audius HTTP ${response.status}`, this.id);
    }
    return (await response.json()) as {
      data?: AudiusTrackPayload[] | AudiusTrackPayload;
    };
  }
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
