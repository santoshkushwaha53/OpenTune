import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

loadDotenv({ path: resolve(import.meta.dirname, "../.env") });
loadDotenv({ path: resolve(import.meta.dirname, ".env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://opentune:opentune@localhost:5432/opentune?schema=public";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
