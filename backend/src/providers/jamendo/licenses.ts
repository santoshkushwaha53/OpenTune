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

export function licenseFromJamendoUrl(
  ccurl: string | undefined,
): ProviderLicense | null {
  const value = (ccurl ?? "").toLowerCase();
  if (!value) {
    return null;
  }
  if (value.includes("/publicdomain/") || value.includes("/zero/")) {
    return LICENSES["CC0-1.0"] ?? null;
  }
  if (value.includes("/by-sa")) {
    return LICENSES["CC-BY-SA-4.0"] ?? null;
  }
  if (
    value.includes("/by-nc") ||
    value.includes("/by-nd") ||
    value.includes("sampling")
  ) {
    return null;
  }
  if (value.includes("/by")) {
    return LICENSES["CC-BY-4.0"] ?? null;
  }
  return null;
}

export const JAMENDO_HOST_ALLOWLIST = [
  "api.jamendo.com",
  "www.jamendo.com",
  "jamendo.com",
  "usercontent.jamendo.com",
  "prod-1.storage.jamendo.com",
  "mp3l.jamendo.com",
  "mp3d.jamendo.com",
  "storage.jamendo.com",
];

export function isAllowedJamendoUrl(urlString: string): boolean {
  try {
    assertSafeProviderUrl(urlString, JAMENDO_HOST_ALLOWLIST);
    return true;
  } catch {
    return false;
  }
}
