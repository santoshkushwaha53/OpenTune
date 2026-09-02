import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AudiusProvider } from "../src/providers/audius/AudiusProvider.js";
import { licenseFromAudius } from "../src/providers/audius/licenses.js";
import { archiveSearchQueries } from "../src/providers/archive/queries.js";
import { audiusSearchQueries } from "../src/providers/audius/queries.js";
import { FmaProvider } from "../src/providers/fma/FmaProvider.js";
import {
  downloadAllowed,
  partitionByDownloadRights,
  SOURCE_ROUTER_PRIORITY,
} from "../src/catalog/source-router.js";

type FixtureTrack = {
  id: string;
  title: string;
  is_downloadable?: boolean;
  license?: string;
};

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/audius-tracks.json"), "utf8"),
) as { data: FixtureTrack[] };

function fixtureFetch(): typeof fetch {
  return async (input, init) => {
    expect(init?.redirect).toBe("error");
    const url = new URL(String(input));
    if (url.protocol !== "https:" || !url.hostname.endsWith("audius.co")) {
      throw new Error(`unexpected Audius request ${url}`);
    }
    expect(url.searchParams.get("app_name")).toBe("opentune");
    const path = url.pathname;
    if (path.includes("/tracks/") && !path.includes("search")) {
      const id = path.split("/").filter(Boolean).at(-1);
      const row = fixture.data.find((item) => item.id === id);
      return new Response(JSON.stringify({ data: row ?? null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: fixture.data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("audius connector", () => {
  it("maps downloadable CC tracks and drops ARR", async () => {
    const provider = new AudiusProvider("test-key", fixtureFetch());
    const results = await provider.search("hindi");
    expect(results.map((track) => track.title)).toEqual(["Open Pulse", "Hindi Stream"]);
    expect(results[0]?.capabilities.supportsDownload).toBe(true);
    expect(results[0]?.license.spdxId).toBe("CC-BY-4.0");
    const streamOnly = results.find((track) => track.title === "Hindi Stream");
    expect(streamOnly?.capabilities.supportsDownload).toBe(false);
    expect(results.find((track) => track.title === "Closed Cut")).toBeUndefined();
  });

  it("never invents a download from a stream-only Audius track", async () => {
    const provider = new AudiusProvider("test-key", fixtureFetch());
    expect(await provider.getDownloadSource("STR33")).toBeNull();
    expect(await provider.getPlaybackSource("STR33")).toBeTruthy();
    expect(await provider.getDownloadSource("D7KyD")).toMatchObject({
      url: "https://api.audius.co/v1/tracks/D7KyD/download?app_name=opentune",
    });
  });

  it("does not fetch audio bytes", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      return fixtureFetch()(input, init);
    };
    const provider = new AudiusProvider("test-key", fetchImpl);
    await provider.search("english");
    expect(seen.join(" ")).toContain("query=english");
    expect(seen.join(" ")).not.toContain("only_downloadable=");
    expect(seen.join(" ")).not.toMatch(/\/stream\//);
  });
});

describe("fma connector", () => {
  it("stays empty because FMA retired its API", async () => {
    const provider = new FmaProvider();
    expect(await provider.search("hindi")).toEqual([]);
    expect(await provider.getDownloadSource("any")).toBeNull();
    expect((await provider.healthCheck()).ok).toBe(false);
    expect((await provider.healthCheck()).message).toMatch(/retired/i);
  });
});

describe("sohum source router", () => {
  it("orders YouTube, then Audius, Jamendo, Internet Archive, and FMA", () => {
    expect(SOURCE_ROUTER_PRIORITY.youtube).toBe(1);
    expect(SOURCE_ROUTER_PRIORITY.audius).toBe(2);
    expect(SOURCE_ROUTER_PRIORITY.jamendo).toBe(3);
    expect(SOURCE_ROUTER_PRIORITY.archive).toBe(4);
    expect(SOURCE_ROUTER_PRIORITY.fma).toBe(5);
  });

  it("prefers downloadable hits and skips listen-only to the next source", () => {
    const { downloadable, listenOnly } = partitionByDownloadRights([
      {
        externalId: "a",
        title: "DL",
        durationMs: 1,
        artistName: "A",
        artistExternalId: "a",
        license: {
          spdxId: "CC-BY-4.0",
          name: "BY",
          url: "https://creativecommons.org/licenses/by/4.0/",
          requiresAttribution: true,
          allowsStreaming: true,
          allowsDownload: true,
        },
        attributionText: "x",
        capabilities: { supportsStreaming: true, supportsDownload: true },
      },
      {
        externalId: "b",
        title: "Stream",
        durationMs: 1,
        artistName: "B",
        artistExternalId: "b",
        license: {
          spdxId: "CC-BY-4.0",
          name: "BY",
          url: "https://creativecommons.org/licenses/by/4.0/",
          requiresAttribution: true,
          allowsStreaming: true,
          allowsDownload: true,
        },
        attributionText: "x",
        capabilities: { supportsStreaming: true, supportsDownload: false },
      },
    ]);
    expect(downloadable.map((item) => item.title)).toEqual(["DL"]);
    expect(listenOnly.map((item) => item.title)).toEqual(["Stream"]);
    expect(downloadAllowed(listenOnly[0]!)).toBe(false);
  });

  it("expands Bollywood-style queries across licensed catalog terms", () => {
    expect(audiusSearchQueries("bollywood")).toEqual([
      "bollywood",
      "hindi",
      "indian",
      "bhangra",
      "sitar",
      "raga",
      "tabla",
    ]);
    expect(audiusSearchQueries("piano")).toEqual(["piano"]);
    expect(archiveSearchQueries("bollywood")).toEqual([
      "bollywood",
      "hindi",
      "indian",
      "bhangra",
      "sitar",
      "raga",
    ]);
    expect(archiveSearchQueries("piano")).toEqual(["piano"]);
  });

  it("maps Audius license strings", () => {
    expect(licenseFromAudius("Attribution")?.spdxId).toBe("CC-BY-4.0");
    expect(licenseFromAudius("All Rights Reserved")).toBeNull();
    expect(licenseFromAudius("Attribution Noncommercial")).toBeNull();
  });
});
