import type { ProviderLicense } from "../core/types.js";
import { assertSafeProviderUrl } from "../../security/url-allowlist.js";

/** YouTube ToS stream-only. Not an SPDX Creative Commons license. */
export const YOUTUBE_STREAM_LICENSE: ProviderLicense = {
  spdxId: "LicenseRef-YouTube-ToS",
  name: "YouTube Terms of Service (stream in official player)",
  url: "https://www.youtube.com/t/terms",
  requiresAttribution: true,
  allowsStreaming: true,
  allowsDownload: false,
};

export const YOUTUBE_HOST_ALLOWLIST = [
  "www.googleapis.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "i.ytimg.com",
  "ytimg.com",
  "img.youtube.com",
];

export function isAllowedYoutubeUrl(urlString: string): boolean {
  try {
    assertSafeProviderUrl(urlString, YOUTUBE_HOST_ALLOWLIST);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeYoutubeVideoId(
  value: string | undefined | null,
): string | null {
  const id = (value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return null;
  }
  return id;
}

export function youtubeWatchUrl(videoId: string): string | null {
  const id = sanitizeYoutubeVideoId(videoId);
  if (!id) {
    return null;
  }
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  return isAllowedYoutubeUrl(url) ? url : null;
}
