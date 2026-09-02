import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { JamendoProvider } from "../src/providers/jamendo/JamendoProvider.js";
import { licenseFromJamendoUrl } from "../src/providers/jamendo/licenses.js";

type FixtureTrack = {
  id: string;
  name: string;
  audiodownload_allowed?: boolean;
  audiodownload?: string;
  audio?: string;
  license_ccurl?: string;
};

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/jamendo-tracks.json"), "utf8"),
) as { results: FixtureTrack[] };

function fixtureFetch(): typeof fetch {
  return async (input, init) => {
    expect(init?.redirect).toBe("error");
    const url = new URL(String(input));
    if (url.protocol !== "https:" || url.hostname !== "api.jamendo.com") {
      throw new Error(`unexpected Jamendo request ${url}`);
    }
    expect(url.searchParams.get("client_id")).toBe("test-client");
    const id = url.searchParams.get("id");
    const results = id
      ? fixture.results.filter((row) => row.id === id)
      : fixture.results;
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("jamendo connector", () => {
  it("maps official API fixtures, drops NC/ND, and never invents downloads", async () => {
    const provider = new JamendoProvider("test-client", fixtureFetch());
    const results = await provider.search("tomorrow");
    expect(results.map((track) => track.title)).toEqual([
      "Make Tomorrow",
      "Night Harbor",
      "Off Host",
    ]);
    expect(results.find((track) => track.title === "Restricted Cut")).toBeUndefined();

    const downloadable = results.find((track) => track.externalId === "1123596");
    expect(downloadable?.license.spdxId).toBe("CC-BY-4.0");
    expect(downloadable?.capabilities.supportsDownload).toBe(true);
    expect(downloadable?.attributionText).toContain("Open Ensemble");

    const streamOnly = results.find((track) => track.externalId === "1123597");
    expect(streamOnly?.capabilities.supportsDownload).toBe(false);

    const offHost = results.find((track) => track.externalId === "1123599");
    expect(offHost?.capabilities.supportsDownload).toBe(false);
    expect(offHost?.artworkUrl).toBeUndefined();
  });

  it("resolves playback and download URLs from allowlisted Jamendo hosts only", async () => {
    const provider = new JamendoProvider("test-client", fixtureFetch());

    const playback = await provider.getPlaybackSource("1123596");
    expect(playback?.url.startsWith("https://prod-1.storage.jamendo.com/")).toBe(true);

    const download = await provider.getDownloadSource("1123596");
    expect(download?.url).toBe(
      "https://prod-1.storage.jamendo.com/download/track/1123596/mp32/",
    );

    expect(await provider.getDownloadSource("1123597")).toBeNull();
    expect(await provider.getDownloadSource("1123598")).toBeNull();
    expect(await provider.getPlaybackSource("1123598")).toBeNull();
    expect(await provider.getDownloadSource("1123599")).toBeNull();
  });

  it("does not call the network when the client id is missing", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network should not be used");
    };
    const provider = new JamendoProvider("", fetchImpl);
    expect((await provider.healthCheck()).ok).toBe(false);
    await expect(provider.search("tomorrow")).rejects.toThrow(/client id/i);
  });

  it("maps open Creative Commons licenses and rejects the rest", () => {
    expect(
      licenseFromJamendoUrl("http://creativecommons.org/licenses/by/4.0/")?.spdxId,
    ).toBe("CC-BY-4.0");
    expect(
      licenseFromJamendoUrl("https://creativecommons.org/licenses/by-sa/4.0/")?.spdxId,
    ).toBe("CC-BY-SA-4.0");
    expect(
      licenseFromJamendoUrl("https://creativecommons.org/publicdomain/zero/1.0/")
        ?.spdxId,
    ).toBe("CC0-1.0");
    expect(
      licenseFromJamendoUrl("http://creativecommons.org/licenses/by-nc-nd/3.0/"),
    ).toBeNull();
    expect(
      licenseFromJamendoUrl("http://creativecommons.org/licenses/by-nd/4.0/"),
    ).toBeNull();
    expect(
      licenseFromJamendoUrl("http://creativecommons.org/licenses/by-nc-sa/3.0/"),
    ).toBeNull();
  });
});
