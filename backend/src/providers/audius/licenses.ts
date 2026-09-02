import type { ProviderLicense } from "../core/types.js";
import { assertSafeProviderUrl } from "../../security/url-allowlist.js";

const LICENSES: Record<string, ProviderLicense> = {
  "CC0-1.0": {
    spdxId: "CC0-1.0",
    name: "Creative Commons Zero v1.0 Universal",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    requiresAttribution: false,
    allowsStreaming: true,
    allowsDownload: true,
  },
  "CC-BY-4.0": {
    spdxId: "CC-BY-4.0",
    name: "Creative Commons Attribution 4.0 International",
    url: "https://creativecommons.org/licenses/by/4.0/",
    requiresAttribution: true,
    allowsStreaming: true,
    allowsDownload: true,
  },
  "CC-BY-SA-4.0": {
    spdxId: "CC-BY-SA-4.0",
    name: "Creative Commons Attribution-ShareAlike 4.0 International",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    requiresAttribution: true,
    allowsStreaming: true,
    allowsDownload: true,
  },
};

/**
 * Map Audius license strings to open CC licenses. ARR, NC, and ND are dropped.
 */
export function licenseFromAudius(
  value: string | undefined | null,
): ProviderLicense | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (
    raw.includes("all rights reserved") ||
    raw.includes("noncommercial") ||
    raw.includes("non-commercial") ||
    raw.includes("no deriv") ||
    /\bnc\b/.test(raw) ||
    /\bnd\b/.test(raw)
  ) {
    return null;
  }
  if (
    raw.includes("cc0") ||
    raw.includes("public domain") ||
    raw.includes("no rights reserved") ||
    raw.includes("zero")
  ) {
    return LICENSES["CC0-1.0"] ?? null;
  }
  if (
    raw.includes("sharealike") ||
    raw.includes("share alike") ||
    raw.includes("by-sa")
  ) {
    return LICENSES["CC-BY-SA-4.0"] ?? null;
  }
  if (raw.includes("attribution") || raw === "by" || raw.includes("cc-by")) {
    return LICENSES["CC-BY-4.0"] ?? null;
  }
  return null;
}

export const AUDIUS_HOST_ALLOWLIST = ["audius.co", "api.audius.co"];

export function isAllowedAudiusUrl(urlString: string): boolean {
  try {
    assertSafeProviderUrl(urlString, AUDIUS_HOST_ALLOWLIST);
    return true;
  } catch {
    return false;
  }
}
