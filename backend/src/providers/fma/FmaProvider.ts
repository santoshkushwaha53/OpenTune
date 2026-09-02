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

const CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: false,
  supportsDownload: false,
  supportsOffline: false,
  supportsRedistribution: false,
  requiresAttribution: true,
};

const RETIRED =
  "Free Music Archive retired its public API. OpenTune does not scrape FMA or hotlink FMA audio.";

/**
 * Priority-4 slot in the Sohum source router.
 * FMA forbids scraping and hotlinking; this connector stays disabled.
 */
export class FmaProvider implements MusicProvider {
  readonly id = "fma";
  readonly name = "Free Music Archive";
  readonly capabilities = CAPABILITIES;

  async search(
    _query: string,
    _options?: ProviderSearchOptions,
  ): Promise<ProviderSearchResult[]> {
    return [];
  }

  async getTrack(_externalId: string): Promise<ProviderTrack | null> {
    return null;
  }

  async getPlaybackSource(_externalId: string): Promise<ProviderMediaSource | null> {
    return null;
  }

  async getDownloadSource(_externalId: string): Promise<ProviderMediaSource | null> {
    return null;
  }

  async getLicense(_externalId: string): Promise<ProviderLicense | null> {
    return null;
  }

  async getAttribution(_externalId: string): Promise<string | null> {
    return null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: false, latencyMs: 0, message: RETIRED };
  }
}
