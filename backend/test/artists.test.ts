import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistProviderTrack } from "../src/catalog/persist.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { FakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

function expectMetadataOnly(body: unknown) {
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/playbackUrl|downloadUrl|\/api\/v1\/audio/);
}

describe("artist and album pages", () => {
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

  it("returns artist and album metadata with licensed track refs, never audio", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    await persistProviderTrack("fake", (await new FakeProvider().getTrack("fake-1"))!);
    await persistProviderTrack("fake", (await new FakeProvider().getTrack("fake-2"))!);

    const search = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=horizon",
    });
    const track = (
      search.json().results as Array<{
        id: string;
        artist: { id: string };
        album: { id: string };
      }>
    ).find((row) => row.artist?.id && row.album?.id);
    expect(track).toBeTruthy();

    const artist = await app.inject({
      method: "GET",
      url: `/api/v1/artists/${track!.artist.id}`,
    });
    expect(artist.statusCode).toBe(200);
    expect(artist.json().name).toBe("Northwind");
    expect(
      artist
        .json()
        .albums.some((row: { title: string }) => row.title === "Public Skies"),
    ).toBe(true);
    expect(artist.json().tracks.length).toBeGreaterThan(0);
    expect(artist.json().tracks[0].license.spdxId).toBeTruthy();
    expect(artist.json().tracks[0].availability.stream).toBeDefined();
    expectMetadataOnly(artist.json());

    const albums = await app.inject({
      method: "GET",
      url: `/api/v1/artists/${track!.artist.id}/albums`,
    });
    expect(albums.statusCode).toBe(200);
    expect(albums.json().albums.length).toBeGreaterThan(0);

    const album = await app.inject({
      method: "GET",
      url: `/api/v1/albums/${track!.album.id}`,
    });
    expect(album.statusCode).toBe(200);
    expect(album.json().title).toBe("Public Skies");
    expect(album.json().artists[0].name).toBe("Northwind");
    expect(
      album
        .json()
        .tracks.some((row: { title: string }) => row.title === "Open Horizon"),
    ).toBe(true);
    expectMetadataOnly(album.json());

    const albumTracks = await app.inject({
      method: "GET",
      url: `/api/v1/albums/${track!.album.id}/tracks`,
    });
    expect(albumTracks.statusCode).toBe(200);
    expect(albumTracks.json().tracks.length).toBeGreaterThan(0);
    expectMetadataOnly(albumTracks.json());
  });

  it("returns 404 for unknown artist and album ids", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }
    const missing = randomUUID();
    const artist = await app.inject({
      method: "GET",
      url: `/api/v1/artists/${missing}`,
    });
    expect(artist.statusCode).toBe(404);
    const album = await app.inject({ method: "GET", url: `/api/v1/albums/${missing}` });
    expect(album.statusCode).toBe(404);
  });
});
