import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistProviderTrack } from "../src/catalog/persist.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { FakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

describe("search and discovery", () => {
  let app: FastifyInstance;
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
    } catch (error) {
      if (requireDb) {
        throw error;
      }
    }
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a search query", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/search" });
    expect(response.statusCode).toBe(400);
  });

  it("aggregates search, dedupes, and resolves sources without API audio bytes", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const original = await new FakeProvider().getTrack("fake-1");
    expect(original).toBeTruthy();
    const harborTrack = await new FakeProvider().getTrack("fake-2");
    expect(harborTrack).toBeTruthy();
    await persistProviderTrack("fake", harborTrack!);
    const duplicate = await persistProviderTrack("fake", {
      ...original!,
      externalId: "fake-1-dup",
      title: "Open Horizon!",
    });
    const first = await persistProviderTrack("fake", original!);
    expect(duplicate.track.id).toBe(first.track.id);

    const search = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=horizon",
    });
    expect(search.statusCode).toBe(200);
    const results = search.json().results as Array<{
      id: string;
      title: string;
      availability: { download: boolean };
      source: { provider: string };
    }>;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("Open Horizon");
    expect(results[0]?.source.provider).toBe("fake");
    expect(JSON.stringify(search.json())).not.toMatch(/example\.invalid\/stream/);

    const id = first.track.id;
    const meta = await app.inject({ method: "GET", url: `/api/v1/tracks/${id}` });
    expect(meta.statusCode).toBe(200);
    expect(meta.json().license.spdxId).toBe("CC-BY-4.0");
    expect(meta.json().artist.name).toBe("Northwind");

    const artistId = meta.json().artist.id as string;
    const artist = await app.inject({
      method: "GET",
      url: `/api/v1/artists/${artistId}`,
    });
    expect(artist.statusCode).toBe(200);
    expect(artist.json().tracks.length).toBeGreaterThan(0);

    const albumId = meta.json().album.id as string;
    const album = await app.inject({ method: "GET", url: `/api/v1/albums/${albumId}` });
    expect(album.statusCode).toBe(200);

    const sources = await app.inject({
      method: "GET",
      url: `/api/v1/tracks/${id}/sources`,
    });
    expect(sources.statusCode).toBe(200);
    const body = sources.json() as {
      sources: Array<{
        provider: string;
        externalTrackId: string;
        playbackUrl: string | null;
        downloadUrl: string | null;
      }>;
    };
    const fakeSource = body.sources.find(
      (source) => source.externalTrackId === "fake-1",
    );
    expect(fakeSource?.playbackUrl).toMatch(/^https:\/\/example\.invalid\//);
    expect(fakeSource?.downloadUrl).toMatch(/^https:\/\/example\.invalid\/download\//);
    expect(JSON.stringify(body)).not.toContain("/api/v1/audio");

    const downloadSource = await app.inject({
      method: "GET",
      url: `/api/v1/downloads/${id}/source`,
    });
    expect(downloadSource.statusCode).toBe(200);
    expect(downloadSource.json().downloadUrl).toMatch(
      /^https:\/\/example\.invalid\/download\//,
    );

    const harbor = await app.inject({ method: "GET", url: "/api/v1/search?q=harbor" });
    const harborId = harbor.json().results[0].id as string;
    const harborSources = await app.inject({
      method: "GET",
      url: `/api/v1/tracks/${harborId}/sources`,
    });
    const harborFake = (
      harborSources.json() as {
        sources: Array<{
          provider: string;
          externalTrackId: string;
          playbackUrl: string | null;
          downloadUrl: string | null;
        }>;
      }
    ).sources.find((source) => source.externalTrackId === "fake-2");
    expect(harborFake?.playbackUrl).toBeTruthy();
    expect(harborFake?.downloadUrl).toBeNull();

    const harborDownload = await app.inject({
      method: "GET",
      url: `/api/v1/downloads/${harborId}/source`,
    });
    expect(harborDownload.statusCode).toBe(404);

    const home = await app.inject({ method: "GET", url: "/api/v1/discovery/home" });
    expect(home.statusCode).toBe(200);
    expect(home.json().greeting).toMatch(/open|Good /);

    const trending = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/trending",
    });
    expect(trending.statusCode).toBe(200);

    const licenses = await app.inject({ method: "GET", url: "/api/v1/licenses" });
    expect(licenses.statusCode).toBe(200);
    const by = await app.inject({ method: "GET", url: "/api/v1/licenses/CC-BY-4.0" });
    expect(by.statusCode).toBe(200);
    expect(by.json().spdxId).toBe("CC-BY-4.0");

    const byYear = await app.inject({
      method: "GET",
      url: "/api/v1/search?year=2018",
    });
    expect(byYear.statusCode).toBe(200);
    const yearHits = byYear.json().results as Array<{ title: string; year?: number }>;
    expect(yearHits.some((track) => track.title === "Open Horizon")).toBe(true);
    expect(yearHits.every((track) => track.year === 2018 || track.year == null)).toBe(
      true,
    );

    const singers = await app.inject({
      method: "GET",
      url: "/api/v1/search/artists?q=northwind",
    });
    expect(singers.statusCode).toBe(200);
    const singerRows = singers.json().artists as Array<{ name: string }>;
    expect(singerRows.some((artist) => artist.name === "Northwind")).toBe(true);
    expect(JSON.stringify(singers.json())).not.toMatch(/playbackUrl|\/stream\//);
    expect(singers.json().disclaimer).toMatch(/open catalogs/i);

    const scenes = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/scenes",
    });
    expect(scenes.statusCode).toBe(200);
    expect(JSON.stringify(scenes.json())).toMatch(/Bollywood/);
    expect(JSON.stringify(scenes.json())).not.toMatch(/\/stream\//);
  });
});
