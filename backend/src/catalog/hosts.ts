import { ARCHIVE_HOST_ALLOWLIST } from "../providers/archive/licenses.js";
import { AUDIUS_HOST_ALLOWLIST } from "../providers/audius/licenses.js";
import { JAMENDO_HOST_ALLOWLIST } from "../providers/jamendo/licenses.js";
import { YOUTUBE_HOST_ALLOWLIST } from "../providers/youtube/licenses.js";
import { assertSafeProviderUrl } from "../security/url-allowlist.js";

const EXTRA_HOSTS: Record<string, string[]> = {
  fake: ["example.invalid"],
};

export function hostAllowlistForProvider(slug: string): string[] {
  if (slug === "jamendo") {
    return JAMENDO_HOST_ALLOWLIST;
  }
  if (slug === "audius") {
    return AUDIUS_HOST_ALLOWLIST;
  }
  if (slug === "archive") {
    return ARCHIVE_HOST_ALLOWLIST;
  }
  if (slug === "youtube") {
    return YOUTUBE_HOST_ALLOWLIST;
  }
  return EXTRA_HOSTS[slug] ?? [];
}

export function sanitizeProviderMediaUrl(
  providerSlug: string,
  url: string | undefined | null,
): string | null {
  if (!url) {
    return null;
  }
  try {
    return assertSafeProviderUrl(url, hostAllowlistForProvider(providerSlug)).href;
  } catch {
    return null;
  }
}
