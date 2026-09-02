import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { YoutubeProvider } from "../src/providers/youtube/YoutubeProvider.js";
import { youtubeWatchUrl } from "../src/providers/youtube/licenses.js";

const searchFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/youtube-search.json"), "utf8"),
) as { items: unknown[] };

const videosFixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures/youtube-videos.json"), "utf8"),
) as { items: Array<{ id: string }> };

function fixtureFetch(): typeof fetch {
  return async (input, init) => {
    expect(init?.redirect).toBe("error");
    const url = new URL(String(input));
    if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com") {
      throw new Error(`unexpected YouTube request ${url}`);
    }
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(String(url)).not.toMatch(/googlevideo\.com/);
    expect(String(url)).not.toMatch(/\/watch\?v=/);
    if (url.pathname.endsWith("/search")) {
      expect(url.searchParams.get("type")).toBe("video");
      expect(url.searchParams.get("videoEmbeddable")).toBe("true");
      return new Response(JSON.stringify(searchFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname.endsWith("/videos")) {
      const ids = (url.searchParams.get("id") ?? "").split(",");
      const items = videosFixture.items.filter((item) => ids.includes(item.id));
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected YouTube path ${url.pathname}`);
  };
}

describe("youtube connector", () => {
  it("maps embeddable videos and never invents a download", async () => {
    const provider = new YoutubeProvider("test-key", fixtureFetch());
    const results = await provider.search("pulse");
    expect(results.map((track) => track.title)).toEqual([
      "Open Pulse (Official Audio)",
    ]);
    expect(results[0]?.license.spdxId).toBe("LicenseRef-YouTube-ToS");
    expect(results[0]?.capabilities.supportsDownload).toBe(false);
    expect(results[0]?.durationMs).toBe(180_000);
    expect(await provider.getDownloadSource("OpenPulse11")).toBeNull();
    expect(await provider.getPlaybackSource("OpenPulse11")).toEqual({
      url: "https://www.youtube.com/watch?v=OpenPulse11",
      mimeType: "text/html",
    });
    expect(await provider.getPlaybackSource("ClosedCut11")).toBeNull();
  });

  it("does not fetch media bytes", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      return fixtureFetch()(input, init);
    };
    await new YoutubeProvider("test-key", fetchImpl).search("hindi");
    expect(seen.join(" ")).toContain("/youtube/v3/search");
    expect(seen.join(" ")).toContain("/youtube/v3/videos");
    expect(seen.join(" ")).not.toMatch(/googlevideo/);
    expect(seen.join(" ")).not.toMatch(/\/watch\?v=/);
  });

  it("stays empty without an API key", async () => {
    const provider = new YoutubeProvider("");
    expect(await provider.search("bollywood")).toEqual([]);
    expect((await provider.healthCheck()).message).toMatch(/YOUTUBE_API_KEY/);
  });

  it("builds watch URLs only for 11-character video ids", () => {
    expect(youtubeWatchUrl("OpenPulse11")).toBe(
      "https://www.youtube.com/watch?v=OpenPulse11",
    );
    expect(youtubeWatchUrl("../etc/passwd")).toBeNull();
  });
});
