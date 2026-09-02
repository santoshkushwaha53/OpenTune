import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  JAMENDO_CAPABILITIES,
  JAMENDO_PROVIDER_SLUG,
  SEED_LICENSES,
} from "../prisma/seed-data.js";

const schemaPath = resolve(import.meta.dirname, "../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

describe("prisma schema", () => {
  it("does not persist audio, stream, or download URL columns", () => {
    const forbidden = [
      /\baudioUrl\b/,
      /\baudio_url\b/,
      /\bstreamUrl\b/,
      /\bstream_url\b/,
      /\bdownloadUrl\b/,
      /\bdownload_url\b/,
      /\baudioPath\b/,
      /\baudio_path\b/,
      /\bfilePath\b/,
      /\bfile_path\b/,
    ];

    for (const pattern of forbidden) {
      expect(schema, `schema must not include ${pattern}`).not.toMatch(pattern);
    }
  });

  it("defines required provenance and identity tables", () => {
    for (const table of [
      '@@map("users")',
      '@@map("user_sessions")',
      '@@map("licenses")',
      '@@map("providers")',
      '@@map("tracks")',
      '@@map("track_sources")',
      '@@map("playlists")',
      '@@map("playlist_tracks")',
      '@@map("playlist_shares")',
      '@@map("user_preferences")',
      '@@map("user_favorite_artists")',
    ]) {
      expect(schema).toContain(table);
    }
  });

  it("uniquely identifies a provider track", () => {
    expect(schema).toContain("@@unique([providerId, externalTrackId])");
  });

  it("indexes metadata query paths from the Phase 19 review", () => {
    expect(schema).toContain("@@index([canonicalKey])");
    expect(schema).toContain("@@index([deletedAt, createdAt(sort: Desc)])");
    expect(schema).toContain("@@index([isEnabled])");
    expect(schema).toContain("@@index([isEnabled, priority])");
    expect(schema).toContain("@@index([visibility, deletedAt])");
    expect(schema).toContain("@@index([userId, playedAt(sort: Desc)])");
    expect(schema).not.toMatch(/pg_trgm/);
  });
});

describe("seed data", () => {
  it("includes CC0, CC BY, and CC BY-SA", () => {
    expect(SEED_LICENSES.map((license) => license.spdxId)).toEqual([
      "CC0-1.0",
      "CC-BY-4.0",
      "CC-BY-SA-4.0",
    ]);
  });

  it("marks Jamendo disabled with attribution and no redistribution via OpenTune", () => {
    expect(JAMENDO_PROVIDER_SLUG).toBe("jamendo");
    expect(JAMENDO_CAPABILITIES.requiresAttribution).toBe(true);
    expect(JAMENDO_CAPABILITIES.supportsRedistribution).toBe(false);
    expect(JAMENDO_CAPABILITIES.supportsStreaming).toBe(true);
    expect(JAMENDO_CAPABILITIES.supportsDownload).toBe(true);
  });
});
