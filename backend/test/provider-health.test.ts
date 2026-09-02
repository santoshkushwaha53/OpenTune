import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { providerRegistry } from "../src/providers/core/registry.js";
import { ControllableHealthFakeProvider } from "../src/providers/fake/FakeProvider.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";
const operatorHeaders = {
  "x-opentune-operator": "test-operator-token-not-for-production",
};

describe("provider health and catalog sync", () => {
  let app: FastifyInstance;
  let dbAvailable = false;
  const probe = new ControllableHealthFakeProvider();

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
    providerRegistry.register(probe);
    if (dbAvailable) {
      await prisma.provider.upsert({
        where: { slug: "fake-health" },
        create: {
          slug: "fake-health",
          name: "Fake Health Catalog",
          isEnabled: true,
          capabilities: probe.capabilities,
          baseUrl: "https://example.invalid",
        },
        update: { isEnabled: true, name: "Fake Health Catalog" },
      });
      await prisma.providerHealthCheck.deleteMany({
        where: { provider: { slug: "fake-health" } },
      });
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await prisma.provider.updateMany({
        where: { slug: "fake-health" },
        data: { isEnabled: false },
      });
    }
    await app.close();
  });

  it("records a health check for the fake provider", async () => {
    if (!providerRegistry.get("fake") || !dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }
    const before = await prisma.providerHealthCheck.count({
      where: { provider: { slug: "fake" } },
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/providers/fake/health",
      headers: operatorHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      ok: boolean;
      isEnabled: boolean;
      disabled: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.isEnabled).toBe(true);
    expect(body.disabled).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/playbackUrl|downloadUrl|\.mp3/);

    const after = await prisma.providerHealthCheck.count({
      where: { provider: { slug: "fake" } },
    });
    expect(after).toBe(before + 1);

    const row = await prisma.provider.findUnique({ where: { slug: "fake" } });
    expect(row?.healthStatus).toBe("healthy");
    expect(row?.lastHealthCheckAt).toBeTruthy();
  });

  it("rejects unauthenticated provider sync and health writes", async () => {
    const sync = await app.inject({
      method: "POST",
      url: "/api/v1/providers/fake/sync",
      payload: { query: "*" },
    });
    expect(sync.statusCode).toBe(401);

    const health = await app.inject({
      method: "GET",
      url: "/api/v1/providers/fake/health",
    });
    expect(health.statusCode).toBe(401);

    const listed = await app.inject({ method: "GET", url: "/api/v1/providers" });
    expect(listed.statusCode).toBe(200);
  });

  it("returns 404 for an unknown provider slug", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/providers/no-such-provider/health",
      headers: operatorHeaders,
    });
    expect(response.statusCode).toBe(404);
  });

  it("rejects an invalid provider slug", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/providers/Not_Valid/health",
      headers: operatorHeaders,
    });
    expect(response.statusCode).toBe(400);
  });

  it("syncs fake provider metadata without storing audio URLs", async () => {
    if (!dbAvailable || !providerRegistry.get("fake")) {
      expect(requireDb).toBe(false);
      return;
    }
    const sync = await app.inject({
      method: "POST",
      url: "/api/v1/providers/fake/sync",
      headers: operatorHeaders,
      payload: { query: "*" },
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().recordsSynced).toBeGreaterThan(0);
    expect(JSON.stringify(sync.json())).not.toMatch(
      /example\.invalid\/stream|playbackUrl|downloadUrl|\.mp3/,
    );

    const sources = await prisma.trackSource.findMany({
      where: { provider: { slug: "fake" } },
    });
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(JSON.stringify(source)).not.toMatch(/\.mp3|playbackUrl|downloadUrl/);
      expect(source.urlExpiresAt).toBeNull();
    }

    const logs = await app.inject({
      method: "GET",
      url: "/api/v1/providers/fake/sync-logs",
      headers: operatorHeaders,
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().logs[0].status).toBe("success");
    expect(logs.json().logs[0].recordsSynced).toBeGreaterThan(0);
    expect(JSON.stringify(logs.json())).not.toMatch(/\.mp3|playbackUrl/);
  });

  it("disables a provider after three consecutive failures and re-enables on recovery", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }
    probe.healthy = false;
    await prisma.provider.update({
      where: { slug: "fake-health" },
      data: { isEnabled: true },
    });
    await prisma.providerHealthCheck.deleteMany({
      where: { provider: { slug: "fake-health" } },
    });

    for (let i = 0; i < 3; i += 1) {
      const sweep = await app.inject({
        method: "POST",
        url: "/api/v1/providers/health-sweep",
        headers: operatorHeaders,
      });
      expect(sweep.statusCode).toBe(200);
      const row = (
        sweep.json().results as Array<{
          slug: string;
          disabled: boolean;
          isEnabled: boolean;
          ok: boolean;
        }>
      ).find((item) => item.slug === "fake-health");
      expect(row?.ok).toBe(false);
      if (i < 2) {
        expect(row?.disabled).toBe(false);
        expect(row?.isEnabled).toBe(true);
      } else {
        expect(row?.disabled).toBe(true);
        expect(row?.isEnabled).toBe(false);
      }
    }

    const stored = await prisma.provider.findUnique({
      where: { slug: "fake-health" },
    });
    expect(stored?.isEnabled).toBe(false);
    expect(stored?.healthStatus).toBe("down");

    const blocked = await app.inject({
      method: "POST",
      url: "/api/v1/providers/fake-health/sync",
      headers: operatorHeaders,
      payload: { query: "*" },
    });
    expect(blocked.statusCode).toBe(409);

    probe.healthy = true;
    const recovered = await app.inject({
      method: "POST",
      url: "/api/v1/providers/health-sweep",
      headers: operatorHeaders,
    });
    const healthy = (
      recovered.json().results as Array<{
        slug: string;
        ok: boolean;
        isEnabled: boolean;
        disabled: boolean;
      }>
    ).find((item) => item.slug === "fake-health");
    expect(healthy?.ok).toBe(true);
    expect(healthy?.disabled).toBe(false);
    expect(healthy?.isEnabled).toBe(true);

    const restored = await prisma.provider.findUnique({
      where: { slug: "fake-health" },
    });
    expect(restored?.isEnabled).toBe(true);
    expect(restored?.healthStatus).toBe("healthy");

    const listed = await app.inject({ method: "GET", url: "/api/v1/providers" });
    expect(listed.statusCode).toBe(200);
    const fakeHealth = (
      listed.json().providers as Array<{
        slug: string;
        healthStatus: string;
        lastHealthCheckAt: string | null;
      }>
    ).find((item) => item.slug === "fake-health");
    expect(fakeHealth?.healthStatus).toBe("healthy");
    expect(fakeHealth?.lastHealthCheckAt).toBeTruthy();
    expect(JSON.stringify(listed.json())).not.toMatch(/playbackUrl|\.mp3/);
  });
});
