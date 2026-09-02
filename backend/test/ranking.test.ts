import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

describe("ranking and plays", () => {
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

  it("records plays and ranks downloadable tracks", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `rank-${tag}@example.com`,
        username: `rank_${tag}`,
        password: "correct-horse-battery",
        displayName: "Ranker",
      },
    });
    const token = registered.json().tokens.accessToken as string;

    const search = await app.inject({ method: "GET", url: "/api/v1/search?q=horizon" });
    expect(search.statusCode).toBe(200);
    const trackId = search.json().results[0].id as string;

    const play = await app.inject({
      method: "POST",
      url: "/api/v1/library/plays",
      headers: { authorization: `Bearer ${token}` },
      payload: { trackId, durationPlayedMs: 12_000, context: "search" },
    });
    expect(play.statusCode).toBe(201);

    const home = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/home",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(home.statusCode).toBe(200);
    const body = home.json();
    expect(body.recentlyPlayed[0].id).toBe(trackId);
    expect(body.recommended[0].availability.download).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(
      /playbackUrl|downloadUrl|\/api\/v1\/audio/,
    );

    const trending = await app.inject({
      method: "GET",
      url: "/api/v1/discovery/trending",
    });
    expect(trending.statusCode).toBe(200);
    expect(trending.json().results.length).toBeGreaterThan(0);
    expect(JSON.stringify(trending.json())).not.toMatch(
      /playbackUrl|downloadUrl|\/api\/v1\/audio/,
    );
  });
});
