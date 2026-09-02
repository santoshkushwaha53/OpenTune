import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { ErrorCodes } from "../src/http/errors.js";
import { prisma } from "../src/db/prisma.js";

import type { FastifyInstance } from "fastify";

const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

function suffix(): string {
  return randomBytes(4).toString("hex");
}

describe("auth", () => {
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

  it("registers, reads me, refreshes, and logs out", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const tag = suffix();
    const email = `user-${tag}@example.com`;
    const password = "correct-horse-battery";

    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        username: `user_${tag}`,
        password,
        displayName: "Ada",
      },
    });
    expect(registered.statusCode).toBe(201);
    const created = registered.json();
    expect(created.user.email).toBe(email);
    expect(created.tokens.accessToken).toBeTruthy();
    expect(created.tokens.refreshToken).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${created.tokens.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe(`user_${tag}`);

    const publicProfile = await app.inject({
      method: "GET",
      url: `/api/v1/users/${created.user.id}`,
    });
    expect(publicProfile.statusCode).toBe(200);
    expect(publicProfile.json().email).toBeUndefined();

    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: created.tokens.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refreshToken).not.toBe(created.tokens.refreshToken);

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: created.tokens.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    const loggedOut = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: { refreshToken: refreshed.json().refreshToken },
    });
    expect(loggedOut.statusCode).toBe(204);
  });

  it("rejects invalid credentials and unauthenticated me", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@example.com", password: "not-the-password" },
    });
    expect(login.statusCode).toBe(401);
    expect(login.json().error.code).toBe(ErrorCodes.UNAUTHORIZED);

    const me = await app.inject({ method: "GET", url: "/api/v1/users/me" });
    expect(me.statusCode).toBe(401);
  });
});
