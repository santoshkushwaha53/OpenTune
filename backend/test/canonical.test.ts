import { describe, expect, it } from "vitest";

import {
  canonicalKey,
  durationBucketSeconds,
  normalizeCatalogText,
} from "../src/catalog/canonical.js";
import { sanitizeProviderMediaUrl } from "../src/catalog/hosts.js";

describe("catalog canonical keys", () => {
  it("normalizes title/artist and buckets duration", () => {
    expect(normalizeCatalogText("  Open  Horizon!")).toBe("open horizon");
    expect(durationBucketSeconds(182_000)).toBe(durationBucketSeconds(180_000));
    expect(canonicalKey("Open Horizon", "Northwind", 180_000)).toBe(
      canonicalKey("open horizon!", "NORTHWIND", 182_000),
    );
  });
});

describe("provider media URL sanitizer", () => {
  it("allows fake and Jamendo https hosts and rejects others", () => {
    expect(
      sanitizeProviderMediaUrl("fake", "https://example.invalid/stream/fake-1.mp3"),
    ).toContain("example.invalid");
    expect(
      sanitizeProviderMediaUrl(
        "jamendo",
        "https://prod-1.storage.jamendo.com/?trackid=1",
      ),
    ).toContain("jamendo.com");
    expect(
      sanitizeProviderMediaUrl(
        "archive",
        "https://archive.org/download/open-pulse/open-pulse.mp3",
      ),
    ).toContain("archive.org");
    expect(sanitizeProviderMediaUrl("fake", "https://evil.example/a.mp3")).toBeNull();
    expect(
      sanitizeProviderMediaUrl("jamendo", "http://api.jamendo.com/v3.0/tracks"),
    ).toBeNull();
  });
});
