import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { persistProviderTrack } from "../src/catalog/persist.js";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { FakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

describe("abuse reports", () => {
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

  it("requires auth and stores a report against an existing track", async () => {
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      payload: {
        entityType: "track",
        entityId: "11111111-1111-1111-1111-111111111111",
        reason: "This listing looks scraped.",
      },
    });
    expect(anonymous.statusCode).toBe(401);

    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = randomBytes(3).toString("hex");
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `rep-${tag}@example.com`,
        username: `rep_${tag}`,
        password: "correct-horse-battery",
        displayName: "Reporter",
      },
    });
    const auth = {
      authorization: `Bearer ${registered.json().tokens.accessToken as string}`,
    };
    const horizon = await persistProviderTrack(
      "fake",
      (await new FakeProvider().getTrack("fake-1"))!,
    );

    const urlReason = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      headers: auth,
      payload: {
        entityType: "track",
        entityId: horizon.track.id,
        reason: "https://evil.example/fetch-this",
      },
    });
    expect(urlReason.statusCode).toBe(400);

    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      headers: auth,
      payload: {
        entityType: "track",
        entityId: "00000000-0000-4000-8000-000000000000",
        reason: "Unknown catalog row.",
      },
    });
    expect(missing.statusCode).toBe(404);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      headers: auth,
      payload: {
        entityType: "track",
        entityId: horizon.track.id,
        reason: "License or attribution looks wrong.",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe("open");
    expect(created.json().entityId).toBe(horizon.track.id);
    expect(JSON.stringify(created.json())).not.toMatch(/playbackUrl|\.mp3/);
  });
});
