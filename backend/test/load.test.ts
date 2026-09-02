import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistProviderTrack } from "../src/catalog/persist.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { FakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";
const CONCURRENCY = 20;

function assertMetadataOnly(body: unknown) {
  const raw = JSON.stringify(body);
  expect(raw).not.toMatch(/\/api\/v1\/audio/);
  expect(Buffer.byteLength(raw)).toBeLessThan(256_000);
}

describe("health load", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves concurrent health checks", async () => {
    const responses = await Promise.all(
      Array.from({ length: 40 }, () => app.inject({ method: "GET", url: "/health" })),
    );
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
  });
});

describe("search and resolve load", () => {
  let app: FastifyInstance;
  let dbAvailable = false;
  let trackId = "";

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
    if (dbAvailable) {
      const persisted = await persistProviderTrack(
        "fake",
        (await new FakeProvider().getTrack("fake-1"))!,
      );
      trackId = persisted.track.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves concurrent search without audio bytes", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }
    const started = Date.now();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        app.inject({ method: "GET", url: "/api/v1/search?q=horizon" }),
      ),
    );
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    for (const response of responses) {
      const body = response.json() as { results: Array<{ id: string }> };
      expect(body.results.length).toBeGreaterThan(0);
      assertMetadataOnly(body);
      expect(JSON.stringify(body)).not.toMatch(/example\.invalid\/stream/);
    }
  });

  it("serves concurrent source resolution without proxying audio", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }
    const started = Date.now();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        app.inject({ method: "GET", url: `/api/v1/tracks/${trackId}/sources` }),
      ),
    );
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    for (const response of responses) {
      const body = response.json() as {
        sources: Array<{ playbackUrl: string | null; downloadUrl: string | null }>;
      };
      assertMetadataOnly(body);
      expect(
        body.sources.some((source) => source.playbackUrl?.startsWith("https://")),
      ).toBe(true);
      expect(JSON.stringify(body)).not.toContain("/api/v1/audio");
    }
  });
});
