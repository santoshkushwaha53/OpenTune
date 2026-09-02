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
 * Map Internet Archive `licenseurl` values. NC/ND and missing licenses are dropped.
 */
export function licenseFromArchiveUrl(
  value: string | undefined | null,
): ProviderLicense | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (
    raw.includes("by-nc") ||
    raw.includes("by-nd") ||
    raw.includes("noncommercial") ||
    raw.includes("no-deriv") ||
    raw.includes("/nc") ||
    raw.includes("/nd")
  ) {
    return null;
  }
  if (
    raw.includes("/zero/") ||
    raw.includes("cc0") ||
    raw.includes("/publicdomain/") ||
    raw.includes("public domain")
  ) {
    return LICENSES["CC0-1.0"] ?? null;
  }
  if (raw.includes("by-sa") || raw.includes("sharealike")) {
    return LICENSES["CC-BY-SA-4.0"] ?? null;
  }
  if (raw.includes("/by") || raw.includes("attribution")) {
    return LICENSES["CC-BY-4.0"] ?? null;
  }
  return null;
}

export const ARCHIVE_HOST_ALLOWLIST = ["archive.org", "us.archive.org"];

export function isAllowedArchiveUrl(urlString: string): boolean {
  try {
    assertSafeProviderUrl(urlString, ARCHIVE_HOST_ALLOWLIST);
    return true;
  } catch {
    return false;
  }
}
