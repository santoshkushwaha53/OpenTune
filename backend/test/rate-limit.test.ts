import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { ErrorCodes } from "../src/http/errors.js";

import type { FastifyInstance } from "fastify";

describe("rate limit", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ RATE_LIMIT_MAX: 2, RATE_LIMIT_WINDOW_MS: 60_000 });
  });

  afterAll(async () => {
    await app.close();
  });

  it("does not rate-limit health", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
    }
  });

  it("returns RATE_LIMITED after the max for other routes", async () => {
    const hit = () =>
      app.inject({
        method: "GET",
        url: "/api/v1/does-not-exist",
        remoteAddress: "203.0.113.10",
      });

    expect((await hit()).statusCode).toBe(404);
    expect((await hit()).statusCode).toBe(404);
    const limited = await hit();

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe(ErrorCodes.RATE_LIMITED);
    expect(limited.headers["x-ratelimit-limit"]).toBeDefined();
  });
});
