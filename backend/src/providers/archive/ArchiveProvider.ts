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
import { isAllowedArchiveUrl, licenseFromArchiveUrl } from "./licenses.js";
import { archiveSearchQueries } from "./queries.js";

export type ArchiveSearchDoc = {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string | number | string[];
  licenseurl?: string | string[];
};

export type ArchiveFile = {
  name?: string;
  format?: string;
  length?: string | number;
  size?: string | number;
};

export type ArchiveMetadataPayload = {
  metadata?: {
    identifier?: string;
    title?: string | string[];
    creator?: string | string[];
    year?: string | number | string[];
    licenseurl?: string | string[];
    "access-restricted"?: string;
  };
  files?: ArchiveFile[];
};

type FetchLike = typeof fetch;

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
};

const SEARCH_FIELDS = ["identifier", "title", "creator", "year", "licenseurl"];
const OPEN_LICENSE_CLAUSE =
  "(licenseurl:*creativecommons.org/licenses/by* OR licenseurl:*creativecommons.org/publicdomain* OR licenseurl:*creativecommons.org/licenses/zero* OR licenseurl:*creativecommons.org/licenses/CC0*) AND NOT licenseurl:*nc* AND NOT licenseurl:*nd*";
const AUDIO_FORMATS = [
  "VBR MP3",
  "128Kbps MP3",
  "64Kbps MP3",
  "MP3",
  "Ogg Vorbis",
  "Ogg",
];

/**
 * Official Internet Archive JSON APIs only
 * (https://archive.org/developers/search.html, /metadata/{id}).
 * Metadata JSON only. Playback/download URLs are returned to the client.
 */
export class ArchiveProvider implements MusicProvider {
  readonly id = "archive";
  readonly name = "Internet Archive";
  readonly capabilities = DEFAULT_CAPABILITIES;

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://archive.org",
  ) {}

  async search(
    query: string,
    options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const q = query.trim();
    if (!q || q === "*") {
      return [];
    }
    const docs = await this.searchDocs(q, options, limit);
    const tracks: ProviderTrack[] = [];
    const seen = new Set<string>();
    for (const doc of docs) {
      if (tracks.length >= limit) {
        break;
      }
      const identifier = sanitizeIdentifier(doc.identifier);
      if (!identifier || seen.has(identifier)) {
        continue;
      }
      try {
        const track = await this.loadTrack(identifier);
        if (!track) {
          continue;
        }
        if (!yearInRange(track.releasedYear, options)) {
          continue;
        }
        seen.add(identifier);
        tracks.push(track);
      } catch {
        continue;
      }
    }
    return tracks;
  }

  async getTrack(externalId: string): Promise<ProviderTrack | null> {
    const identifier = sanitizeIdentifier(externalId);
    return identifier ? this.loadTrack(identifier) : null;
  }

  async getPlaybackSource(externalId: string): Promise<ProviderMediaSource | null> {
    return this.mediaSource(externalId);
  }

  async getDownloadSource(externalId: string): Promise<ProviderMediaSource | null> {
    return this.mediaSource(externalId);
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
      await this.searchDocs("piano", undefined, 1);
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "health check failed",
      };
    }
  }

  private async mediaSource(externalId: string): Promise<ProviderMediaSource | null> {
    const identifier = sanitizeIdentifier(externalId);
    if (!identifier) {
      return null;
    }
    const payload = await this.loadMetadata(identifier);
    const mapped = this.mapPayload(payload);
    if (!mapped) {
      return null;
    }
    const file = pickAudioFile(payload.files ?? []);
    if (!file?.name) {
      return null;
    }
    const url = this.fileUrl(identifier, file.name);
    if (!isAllowedArchiveUrl(url)) {
      return null;
    }
    return { url, mimeType: mimeForFile(file) };
  }

  private async loadTrack(identifier: string): Promise<ProviderTrack | null> {
    return this.mapPayload(await this.loadMetadata(identifier));
  }

  private mapPayload(payload: ArchiveMetadataPayload): ProviderTrack | null {
    const meta = payload.metadata ?? {};
    if (meta["access-restricted"] === "true") {
      return null;
    }
    const identifier = sanitizeIdentifier(meta.identifier);
    const title = firstString(meta.title);
    const artistName = firstString(meta.creator) || "Various Artists";
    const license = licenseFromArchiveUrl(firstString(meta.licenseurl));
    const file = pickAudioFile(payload.files ?? []);
    if (!identifier || !title || !license || !file?.name) {
      return null;
    }
    const artwork = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
    return {
      externalId: identifier,
      title,
      durationMs: durationMsFromFile(file),
      artistName,
      artistExternalId: slugify(artistName),
      artworkUrl: isAllowedArchiveUrl(artwork) ? artwork : undefined,
      releasedYear: parseReleasedYear(firstString(meta.year)),
      license,
      attributionText: `"${title}" by ${artistName}. ${license.spdxId}. Source: Internet Archive.`,
      capabilities: {
        supportsStreaming: true,
        supportsDownload: true,
      },
    };
  }

  private async searchDocs(
    query: string,
    options: ProviderSearchOptions | undefined,
    rows: number,
  ): Promise<ArchiveSearchDoc[]> {
    const phrases = archiveSearchQueries(query);
    if (phrases.length === 0) {
      return [];
    }
    const textClause = phrases
      .flatMap((phrase) => {
        const quoted = lucenePhrase(phrase);
        return [`title:${quoted}`, `creator:${quoted}`, `description:${quoted}`];
      })
      .join(" OR ");
    const lucene = ["mediatype:audio", OPEN_LICENSE_CLAUSE, `(${textClause})`];
    if (options?.yearFrom != null || options?.yearTo != null) {
      const start = options.yearFrom ?? options.yearTo!;
      const end = options.yearTo ?? options.yearFrom!;
      lucene.push(`year:[${start} TO ${end}]`);
    }
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/advancedsearch.php`);
    url.searchParams.set("q", lucene.join(" AND "));
    url.searchParams.set("rows", String(rows));
    url.searchParams.set("page", "1");
    url.searchParams.set("output", "json");
    url.searchParams.set("sort[]", "downloads desc");
    for (const field of SEARCH_FIELDS) {
      url.searchParams.append("fl[]", field);
    }
    if (!isAllowedArchiveUrl(url.toString())) {
      throw new ProviderError(
        "Refusing to call a non-allowlisted Archive URL",
        this.id,
      );
    }
    const payload = (await this.requestJson(url)) as {
      response?: { docs?: ArchiveSearchDoc[] };
    };
    return Array.isArray(payload.response?.docs) ? payload.response.docs : [];
  }

  private async loadMetadata(identifier: string): Promise<ArchiveMetadataPayload> {
    const url = new URL(
      `${this.baseUrl.replace(/\/$/, "")}/metadata/${encodeURIComponent(identifier)}`,
    );
    if (!isAllowedArchiveUrl(url.toString())) {
      throw new ProviderError(
        "Refusing to call a non-allowlisted Archive URL",
        this.id,
      );
    }
    return (await this.requestJson(url)) as ArchiveMetadataPayload;
  }

  private fileUrl(identifier: string, fileName: string): string {
    const root = this.baseUrl.replace(/\/$/, "");
    return `${root}/download/${encodeURIComponent(identifier)}/${encodeURIComponent(fileName)}`;
  }

  private async requestJson(url: URL): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        "user-agent":
          "OpenTune/0.1.0 (metadata mediator; +https://github.com/santoshkushwaha53/OpenTune)",
      },
    });
    if (!response.ok) {
      throw new ProviderError(`Internet Archive HTTP ${response.status}`, this.id);
    }
    return response.json();
  }
}

function pickAudioFile(files: ArchiveFile[]): ArchiveFile | null {
  for (const format of AUDIO_FORMATS) {
    const match = files.find(
      (file) =>
        file.format === format &&
        Boolean(file.name) &&
        !String(file.name).toLowerCase().endsWith(".zip"),
    );
    if (match) {
      return match;
    }
  }
  return null;
}

function mimeForFile(file: ArchiveFile): string {
  const format = (file.format ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  if (format.includes("ogg") || name.endsWith(".ogg") || name.endsWith(".oga")) {
    return "audio/ogg";
  }
  return "audio/mpeg";
}

function durationMsFromFile(file: ArchiveFile): number {
  const seconds = Number(file.length);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.round(seconds * 1000);
}

function lucenePhrase(query: string): string {
  const cleaned = query.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `"${cleaned}"`;
}

function firstString(
  value: string | number | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value
      .find((item) => String(item).trim())
      ?.toString()
      .trim();
  }
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function sanitizeIdentifier(value: string | undefined): string | null {
  const id = (value ?? "").trim();
  if (!id || id.length > 100) {
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id)) {
    return null;
  }
  return id;
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
