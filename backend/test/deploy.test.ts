import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { corsOrigins, loadEnv, resetEnvCache } from "../src/config/env.js";
import { ErrorCodes } from "../src/http/errors.js";

const root = resolve(import.meta.dirname, "../..");

function readRoot(name: string): string {
  return readFileSync(resolve(root, name), "utf8");
}

const validProduction = {
  NODE_ENV: "production",
  PORT: "3000",
  HOST: "0.0.0.0",
  LOG_LEVEL: "info",
  DATABASE_URL: "postgresql://opentune:strong-db-pass@postgres:5432/opentune",
  JWT_ACCESS_SECRET: "a-production-access-secret-at-least-32-chars",
  JWT_REFRESH_SECRET: "a-production-refresh-secret-at-least-32-ch",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "14d",
  CORS_ORIGIN: "",
  RATE_LIMIT_MAX: "120",
  RATE_LIMIT_WINDOW_MS: "60000",
  OPERATOR_TOKEN: "",
};

describe("production environment", () => {
  it("rejects placeholder JWT secrets in production", () => {
    expect(() =>
      loadEnv({
        ...validProduction,
        JWT_ACCESS_SECRET: "change-me-in-production-access-32chars!",
      }),
    ).toThrow(/placeholder/i);
  });

  it("rejects identical JWT secrets in production", () => {
    expect(() =>
      loadEnv({
        ...validProduction,
        JWT_ACCESS_SECRET: "a-production-access-secret-at-least-32-chars",
        JWT_REFRESH_SECRET: "a-production-access-secret-at-least-32-chars",
      }),
    ).toThrow(/must differ/);
  });

  it("loads distinct non-placeholder production secrets", () => {
    const env = loadEnv(validProduction);
    expect(env.NODE_ENV).toBe("production");
    expect(corsOrigins(env)).toBe(false);
  });
});

describe("production compose", () => {
  const prod = readRoot("docker-compose.prod.yml");
  const local = readRoot("docker-compose.yml");

  it("ships API and PostgreSQL only — no audio object storage", () => {
    expect(prod).toMatch(/^ {2}postgres:/m);
    expect(prod).toMatch(/^ {2}api:/m);
    expect(prod).not.toMatch(/^ {2}minio:/m);
    expect(prod).not.toMatch(/^ {2}redis:/m);
    expect(prod).not.toMatch(/image:\s*minio/i);
    expect(prod).not.toMatch(/opentune_audio|audio_data/);
    expect(prod).toContain("NODE_ENV: production");
    expect(local).toMatch(/^ {2}postgres:/m);
    expect(local).toMatch(/^ {2}api:/m);
  });

  it("does not publish PostgreSQL to the host", () => {
    expect(prod).not.toMatch(/5432:5432/);
    expect(prod).toMatch(/\$\{API_PORT:-3000}:3000/);
  });
});

describe("OSS release docs", () => {
  const security = readRoot("SECURITY.md");
  const api = readRoot("API.md");

  it("SECURITY.md publishes a contact and supported versions", () => {
    expect(security).toContain("security@opentune.dev");
    expect(security).not.toMatch(/replace this address/i);
    expect(security).toMatch(/Supported versions/i);
    expect(security).toMatch(/0\.1/i);
  });

  it("API.md documents every error code", () => {
    for (const code of Object.values(ErrorCodes)) {
      expect(api).toContain(code);
    }
    expect(api).toMatch(/\/api\/v1/);
    expect(api).not.toMatch(/\/api\/v1\/audio/);
  });
});

describe("env cache isolation", () => {
  it("does not leak a failed production parse into getEnv", () => {
    resetEnvCache();
    expect(() =>
      loadEnv({
        ...validProduction,
        JWT_ACCESS_SECRET: "change-me-short",
      }),
    ).toThrow();
  });
});
