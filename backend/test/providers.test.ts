import { describe, expect, it } from "vitest";

import {
  allowsDownload,
  permittedDownloadSource,
  permittedPlaybackSource,
} from "../src/providers/core/capabilities.js";
import { ProviderCapabilityError } from "../src/providers/core/errors.js";
import { ProviderRegistry } from "../src/providers/core/registry.js";
import {
  FakeProvider,
  StreamOnlyFakeProvider,
} from "../src/providers/fake/FakeProvider.js";

describe("MusicProvider abstraction", () => {
  it("registers capability-aware providers", async () => {
    const registry = new ProviderRegistry();
    const fake = new FakeProvider();
    registry.register(fake);
    expect(registry.list().map((provider) => provider.id)).toEqual(["fake"]);
    expect(registry.get("fake")?.capabilities.supportsStreaming).toBe(true);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("searches, loads track metadata, and maps license/attribution", async () => {
    const fake = new FakeProvider();
    const results = await fake.search("horizon");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Open Horizon");
    expect(results[0]?.license.spdxId).toBe("CC-BY-4.0");
    expect(results[0]?.capabilities.supportsDownload).toBe(true);

    const track = await fake.getTrack("fake-1");
    expect(track?.artistName).toBe("Northwind");
    expect(await fake.getLicense("fake-1")).toMatchObject({ spdxId: "CC-BY-4.0" });
    expect(await fake.getAttribution("fake-1")).toContain("Northwind");
    expect((await fake.healthCheck()).ok).toBe(true);
  });

  it("exposes optional album/artist methods and omits playlists", async () => {
    const fake = new FakeProvider();
    expect(await fake.getAlbum("fake-album-1")).toMatchObject({
      title: "Public Skies",
    });
    expect(await fake.getArtist("fake-artist-1")).toMatchObject({ name: "Northwind" });
    expect(fake.getPlaylist).toBeUndefined();
  });

  it("never invents a download from a stream-only track", async () => {
    const fake = new FakeProvider();
    expect(await fake.getPlaybackSource("fake-2")).toMatchObject({
      url: "https://example.invalid/stream/fake-2.mp3",
    });
    expect(await fake.getDownloadSource("fake-2")).toBeNull();
    expect(await fake.getDownloadSource("fake-1")).toBeTruthy();

    const streamOnly = await fake.getTrack("fake-2");
    expect(allowsDownload(fake, streamOnly?.capabilities)).toBe(false);
    expect(
      await permittedDownloadSource(fake, "fake-2", streamOnly?.capabilities),
    ).toBeNull();
    expect(
      await permittedPlaybackSource(fake, "fake-2", streamOnly?.capabilities),
    ).toBeTruthy();
  });

  it("never invents a download from a stream-only provider", async () => {
    const provider = new StreamOnlyFakeProvider();
    expect(provider.capabilities.supportsDownload).toBe(false);
    expect(allowsDownload(provider)).toBe(false);
    expect(await provider.getDownloadSource("fake-1")).toBeNull();
    expect(await permittedDownloadSource(provider, "fake-1")).toBeNull();
    expect(await permittedPlaybackSource(provider, "fake-1")).toBeTruthy();
  });

  it("names capability errors for unsupported features", () => {
    const error = new ProviderCapabilityError("fake", "getPlaylist");
    expect(error.providerId).toBe("fake");
    expect(error.capability).toBe("getPlaylist");
  });
});
