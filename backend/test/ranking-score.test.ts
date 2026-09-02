import { describe, expect, it } from "vitest";

import { discoveryScore } from "../src/catalog/ranking.js";

const downloadable = {
  supportsDownload: true,
  supportsStreaming: true,
  requiresAttribution: true,
  playCount: 0,
  ageDays: 0,
};

const streamOnly = {
  ...downloadable,
  supportsDownload: false,
};

describe("discoveryScore", () => {
  it("ranks permitted downloads above stream-only tracks in catalog and forYou", () => {
    const catalogDownload = discoveryScore(downloadable, "catalog");
    const catalogStream = discoveryScore(streamOnly, "catalog");
    expect(catalogDownload).toBeGreaterThan(catalogStream);

    const forYouDownload = discoveryScore(downloadable, "forYou");
    const forYouStream = discoveryScore(
      { ...streamOnly, sameArtistAsListener: true },
      "forYou",
    );
    expect(forYouDownload).toBeGreaterThan(forYouStream);
  });

  it("lets play count dominate trending while downloads still win catalog", () => {
    const hotStream = discoveryScore({ ...streamOnly, playCount: 20 }, "trending");
    const quietDownload = discoveryScore(downloadable, "trending");
    expect(hotStream).toBeGreaterThan(quietDownload);
    expect(discoveryScore(downloadable, "catalog")).toBeGreaterThan(
      discoveryScore({ ...streamOnly, playCount: 20 }, "catalog"),
    );
  });

  it("boosts recency for the fresh shelf", () => {
    const newTrack = discoveryScore(downloadable, "fresh");
    const oldTrack = discoveryScore({ ...downloadable, ageDays: 30 }, "fresh");
    expect(newTrack).toBeGreaterThan(oldTrack);
  });
});
