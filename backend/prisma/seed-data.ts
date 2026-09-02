export type SeedLicense = {
  spdxId: string;
  name: string;
  url: string;
  allowsStreaming: boolean;
  allowsDownload: boolean;
  requiresAttribution: boolean;
  allowsRedistribution: boolean;
};

export const SEED_LICENSES: readonly SeedLicense[] = [
  {
    spdxId: "CC0-1.0",
    name: "Creative Commons Zero v1.0 Universal",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    allowsStreaming: true,
    allowsDownload: true,
    requiresAttribution: false,
    allowsRedistribution: true,
  },
  {
    spdxId: "CC-BY-4.0",
    name: "Creative Commons Attribution 4.0 International",
    url: "https://creativecommons.org/licenses/by/4.0/",
    allowsStreaming: true,
    allowsDownload: true,
    requiresAttribution: true,
    allowsRedistribution: true,
  },
  {
    spdxId: "CC-BY-SA-4.0",
    name: "Creative Commons Attribution-ShareAlike 4.0 International",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    allowsStreaming: true,
    allowsDownload: true,
    requiresAttribution: true,
    allowsRedistribution: true,
  },
];

export const JAMENDO_PROVIDER_SLUG = "jamendo";
export const AUDIUS_PROVIDER_SLUG = "audius";
export const FMA_PROVIDER_SLUG = "fma";

export const JAMENDO_CAPABILITIES = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
} as const;

export const FMA_CAPABILITIES = {
  supportsStreaming: false,
  supportsDownload: false,
  supportsOffline: false,
  supportsRedistribution: false,
  requiresAttribution: true,
} as const;
