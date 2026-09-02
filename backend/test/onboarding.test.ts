import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

function suffix(): string {
  return randomBytes(4).toString("hex");
}

describe("onboarding and starter pack", () => {
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

  it("personalizes a new user, ranks downloadable tracks, and skips returning onboarding", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = suffix();
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `onboard-${tag}@example.com`,
        username: `onboard_${tag}`,
        password: "correct-horse-battery",
        displayName: "Santosh",
      },
    });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().user.onboardingCompleted).toBe(false);
    const token = registered.json().tokens.accessToken as string;
    const auth = { authorization: `Bearer ${token}` };

    const catalogs = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/onboarding/artists" }),
      app.inject({ method: "GET", url: "/api/v1/onboarding/categories?more=true" }),
      app.inject({ method: "GET", url: "/api/v1/onboarding/languages" }),
      app.inject({ method: "GET", url: "/api/v1/onboarding/moods" }),
    ]);
    for (const response of catalogs) {
      expect(response.statusCode).toBe(200);
    }
    const artists = catalogs[0].json().artists as { id: string; name: string }[];
    expect(artists.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(catalogs[0].json())).not.toMatch(/Arijit Singh|The Weeknd/);
    expect(catalogs[0].json().disclaimer).toMatch(/open-licensed/);

    const northwind = artists
      .filter((artist) => artist.name === "Northwind")
      .slice(0, 1);
    const others = artists.filter((artist) => artist.name !== "Northwind").slice(0, 2);
    const artistIds = [...northwind, ...others].map((artist) => artist.id);
    expect(artistIds.length).toBeGreaterThanOrEqual(3);

    const saved = await app.inject({
      method: "PUT",
      url: "/api/v1/users/me/preferences",
      headers: auth,
      payload: {
        artistIds,
        categorySlugs: ["acoustic", "indie", "lofi"],
        languageCodes: ["en", "hi"],
        moodSlugs: ["relax", "focus"],
        languageMode: "prefer",
        wifiOnlyDownloads: true,
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().favoriteCategories).toHaveLength(3);

    const pack = await app.inject({
      method: "POST",
      url: "/api/v1/recommendations/starter-pack",
      headers: auth,
    });
    expect(pack.statusCode).toBe(200);
    const body = pack.json() as {
      found: number;
      downloadableCount: number;
      tracks: { id: string; title: string; availability: { download: boolean } }[];
    };
    expect(body.found).toBe(body.tracks.length);
    expect(body.tracks.length).toBeGreaterThanOrEqual(1);
    expect(body.tracks.length).toBeLessThanOrEqual(10);
    expect(body.tracks.every((track) => track.availability.download)).toBe(true);
    expect(body.tracks.some((track) => track.title === "Harbor Lights")).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(
      /playbackUrl|downloadUrl|\/api\/v1\/audio/,
    );

    const completed = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding/complete",
      headers: auth,
      payload: {},
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().onboardingCompleted).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: auth,
    });
    expect(me.json().onboardingCompleted).toBe(true);

    const home = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/home",
      headers: auth,
    });
    expect(home.statusCode).toBe(200);
    expect(home.json().personalized).toBe(true);
    expect(home.json().greeting).toMatch(/Santosh/);
    expect(home.json().firstCollection.length).toBeGreaterThan(0);
    expect(JSON.stringify(home.json())).not.toMatch(
      /playbackUrl|downloadUrl|\/api\/v1\/audio/,
    );

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: `onboard-${tag}@example.com`,
        password: "correct-horse-battery",
      },
    });
    expect(login.json().user.onboardingCompleted).toBe(true);
  });

  it("skip completes onboarding without inventing tracks", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = suffix();
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `skip-${tag}@example.com`,
        username: `skip_${tag}`,
        password: "correct-horse-battery",
        displayName: "Skipper",
      },
    });
    const token = registered.json().tokens.accessToken as string;
    const skipped = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding/complete",
      headers: { authorization: `Bearer ${token}` },
      payload: { skip: true },
    });
    expect(skipped.statusCode).toBe(200);
    expect(skipped.json().onboardingCompleted).toBe(true);
    expect(skipped.json().favoriteArtists).toEqual([]);
  });
});
