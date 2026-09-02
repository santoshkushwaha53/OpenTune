import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

describe("openapi", () => {
  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves OpenAPI JSON that documents health and forbids media proxying", async () => {
    const response = await app.inject({ method: "GET", url: "/docs/json" });

    expect(response.statusCode).toBe(200);
    const spec = response.json() as {
      info: { title: string; description: string };
      paths: Record<string, unknown>;
    };
    expect(spec.info.title).toBe("OpenTune API");
    expect(spec.info.description).toMatch(/never proxies/i);
    expect(spec.info.description).not.toMatch(/transcode audio for clients/i);
    expect(spec.paths["/health"]).toBeDefined();
    expect(spec.paths["/api/v1/health"]).toBeDefined();
  });

  it("serves Swagger UI", async () => {
    const response = await app.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"])).toMatch(/html/);
  });
});
