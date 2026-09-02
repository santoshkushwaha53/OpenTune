import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildApp } from "../src/app.js";
import { AppError, ErrorCodes } from "../src/http/errors.js";
import { parseWith } from "../src/http/validate.js";

import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

describe("error envelope", () => {
  beforeAll(async () => {
    app = await buildApp();
    app.get("/__test/error", async () => {
      throw new AppError(409, "CONFLICT", "already exists");
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns NOT_FOUND with request id for unknown routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(body.error.message).toContain("GET");
    expect(body.error.requestId).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).toBe(body.error.requestId);
  });

  it("honors a safe incoming x-request-id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "client-req-12345" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("client-req-12345");
  });

  it("ignores malformed incoming request ids", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "no spaces allowed here!!!" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).not.toBe("no spaces allowed here!!!");
    expect(String(response.headers["x-request-id"]).length).toBeGreaterThan(8);
  });

  it("serializes AppError", async () => {
    const response = await app.inject({ method: "GET", url: "/__test/error" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: "CONFLICT", message: "already exists" },
    });
  });
});

describe("parseWith", () => {
  it("returns parsed data", () => {
    const schema = z.object({ q: z.string().min(1) });
    expect(parseWith(schema, { q: "ambient" }, "query")).toEqual({ q: "ambient" });
  });

  it("throws VALIDATION_ERROR for invalid input", () => {
    const schema = z.object({ q: z.string().min(1) });
    try {
      parseWith(schema, { q: "" }, "query");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
  });
});
