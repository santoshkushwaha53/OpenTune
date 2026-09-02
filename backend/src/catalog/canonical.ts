export function normalizeCatalogText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function durationBucketSeconds(durationMs: number): number {
  return Math.round(Math.max(0, durationMs) / 5000) * 5;
}

export function canonicalKey(
  title: string,
  artistName: string,
  durationMs: number,
): string {
  return `${normalizeCatalogText(title)}|${normalizeCatalogText(artistName)}|${durationBucketSeconds(durationMs)}`;
}

export function slugify(value: string): string {
  const slug = normalizeCatalogText(value).replace(/\s+/g, "-").slice(0, 80);
  return slug.length > 0 ? slug : "item";
}
