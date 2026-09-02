import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../src/generated/prisma/index.js";
import { seedCatalog } from "../prisma/seed-catalog.js";
import {
  ARCHIVE_PROVIDER_SLUG,
  JAMENDO_PROVIDER_SLUG,
  SEED_LICENSES,
} from "../prisma/seed-data.js";

const prisma = new PrismaClient();
const requireDb = process.env.CI === "true" || process.env.REQUIRE_DB === "true";

let dbAvailable = false;

describe("database seed", () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
      await seedCatalog(prisma);
    } catch (error) {
      if (requireDb) {
        throw error;
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("inserts SPDX licenses and a disabled jamendo provider", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    const licenses = await prisma.license.findMany({
      orderBy: { spdxId: "asc" },
    });
    const spdxIds = licenses.map((license) => license.spdxId);
    for (const expected of SEED_LICENSES) {
      expect(spdxIds).toContain(expected.spdxId);
    }

    const jamendo = await prisma.provider.findUnique({
      where: { slug: JAMENDO_PROVIDER_SLUG },
    });
    expect(jamendo).not.toBeNull();
    expect(jamendo?.isEnabled).toBe(false);
    expect(jamendo?.baseUrl).toBe("https://api.jamendo.com/v3.0");

    const archive = await prisma.provider.findUnique({
      where: { slug: ARCHIVE_PROVIDER_SLUG },
    });
    expect(archive).not.toBeNull();
    expect(archive?.isEnabled).toBe(false);
    expect(archive?.priority).toBe(3);
    expect(archive?.baseUrl).toBe("https://archive.org");
  });

  it("does not re-enable jamendo on reseed", async () => {
    if (!dbAvailable) {
      expect(requireDb).toBe(false);
      return;
    }

    await prisma.provider.update({
      where: { slug: JAMENDO_PROVIDER_SLUG },
      data: { isEnabled: false },
    });
    await seedCatalog(prisma);
    const jamendo = await prisma.provider.findUnique({
      where: { slug: JAMENDO_PROVIDER_SLUG },
    });
    expect(jamendo?.isEnabled).toBe(false);
  });
});
