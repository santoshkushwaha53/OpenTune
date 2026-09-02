import type { ProviderTrack } from "../providers/core/types.js";

/** Sohum discovery: YouTube (stream) → Audius → Jamendo → Internet Archive → FMA. */
export const SOURCE_ROUTER_PRIORITY: Record<string, number> = {
  fake: 0,
  youtube: 1,
  audius: 2,
  jamendo: 3,
  archive: 4,
  fma: 5,
};

export function downloadAllowed(
  track: Pick<ProviderTrack, "capabilities" | "license">,
): boolean {
  return track.capabilities.supportsDownload && track.license.allowsDownload;
}

export function partitionByDownloadRights(hits: ProviderTrack[]): {
  downloadable: ProviderTrack[];
  listenOnly: ProviderTrack[];
} {
  const downloadable: ProviderTrack[] = [];
  const listenOnly: ProviderTrack[] = [];
  for (const hit of hits) {
    if (downloadAllowed(hit)) {
      downloadable.push(hit);
    } else {
      listenOnly.push(hit);
    }
  }
  return { downloadable, listenOnly };
}

export function sortProvidersByRouter<T extends { slug: string; priority: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const left = a.priority ?? SOURCE_ROUTER_PRIORITY[a.slug] ?? 100;
    const right = b.priority ?? SOURCE_ROUTER_PRIORITY[b.slug] ?? 100;
    return left - right;
  });
}
