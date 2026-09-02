import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ArchiveProvider } from "../src/providers/archive/ArchiveProvider.js";
import { licenseFromArchiveUrl } from "../src/providers/archive/licenses.js";
import { archiveSearchQueries } from "../src/providers/archive/queries.js";

type MetadataMap = Record<
  string,
  {
    metadata: Record<string, string>;
    files: Array<{ name: string; format: string; length?: string }>;
  }
>;

const searchFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/archive-search.json"), "utf8"),
) as { response: { docs: unknown[] } };

const metadataFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/archive-metadata.json"), "utf8"),
) as MetadataMap;

function fixtureFetch(): typeof fetch {
  return async (input, init) => {
    expect(init?.redirect).toBe("error");
    const url = new URL(String(input));
    if (url.protocol !== "https:" || url.hostname !== "archive.org") {
      throw new Error(`unexpected Archive request ${url}`);
    }
    expect(String(url)).not.toMatch(/\/download\//);
    if (url.pathname === "/advancedsearch.php") {
      expect(url.searchParams.get("q") ?? "").toMatch(/licenseurl/);
      expect(url.searchParams.get("q") ?? "").toMatch(/mediatype:audio/);
      expect(url.searchParams.get("q") ?? "").not.toMatch(/download/);
      return new Response(JSON.stringify(searchFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const match = url.pathname.match(/^\/metadata\/([^/]+)$/);
    if (match?.[1]) {
      const payload = metadataFixture[match[1]];
      return new Response(JSON.stringify(payload ?? {}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected Archive path ${url.pathname}`);
  };
}

describe("internet archive connector", () => {
  it("maps licensed audio and drops NC", async () => {
    const provider = new ArchiveProvider(fixtureFetch());
    const results = await provider.search("pulse");
    expect(results.map((track) => track.title)).toEqual(["Open Pulse"]);
    expect(results[0]?.license.spdxId).toBe("CC-BY-4.0");
    expect(results[0]?.capabilities.supportsDownload).toBe(true);
    expect(results.find((track) => track.title === "Closed Cut")).toBeUndefined();
  });

  it("resolves playback and download from archive.org download URLs", async () => {
    const provider = new ArchiveProvider(fixtureFetch());
    const playback = await provider.getPlaybackSource("open-pulse");
    expect(playback).toEqual({
      url: "https://archive.org/download/open-pulse/open-pulse.mp3",
      mimeType: "audio/mpeg",
    });
    expect(await provider.getDownloadSource("open-pulse")).toEqual(playback);
    expect(await provider.getPlaybackSource("closed-cut")).toBeNull();
  });

  it("does not fetch audio bytes", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      return fixtureFetch()(input, init);
    };
    const provider = new ArchiveProvider(fetchImpl);
    await provider.search("jazz");
    expect(seen.join(" ")).toContain("advancedsearch.php");
    expect(seen.join(" ")).toContain("/metadata/open-pulse");
    expect(seen.join(" ")).not.toMatch(/\/download\//);
    expect(seen.join(" ")).not.toMatch(/\/stream\//);
  });

  it("expands Bollywood-style queries in one Archive search", async () => {
    expect(archiveSearchQueries("bollywood")).toContain("sitar");
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      return fixtureFetch()(input, init);
    };
    await new ArchiveProvider(fetchImpl).search("bollywood");
    const query = decodeURIComponent(seen[0] ?? "");
    expect(query).toMatch(/title:"bollywood"/);
    expect(query).toMatch(/title:"sitar"/);
    expect(seen.filter((url) => url.includes("advancedsearch.php"))).toHaveLength(1);
  });

  it("maps Archive license URLs and rejects NC/ND", () => {
    expect(
      licenseFromArchiveUrl("https://creativecommons.org/licenses/by/3.0/")?.spdxId,
    ).toBe("CC-BY-4.0");
    expect(
      licenseFromArchiveUrl("https://creativecommons.org/publicdomain/zero/1.0/")
        ?.spdxId,
    ).toBe("CC0-1.0");
    expect(
      licenseFromArchiveUrl("https://creativecommons.org/licenses/by-nc/4.0/"),
    ).toBeNull();
    expect(licenseFromArchiveUrl("")).toBeNull();
  });
});
