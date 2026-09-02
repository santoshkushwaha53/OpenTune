import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

import { PrismaClient } from "../src/generated/prisma/index.js";

import { seedCatalog } from "./seed-catalog.js";

loadDotenv({ path: resolve(import.meta.dirname, "../../.env") });
loadDotenv({ path: resolve(import.meta.dirname, "../.env") });

const prisma = new PrismaClient();

try {
  await seedCatalog(prisma);
} finally {
  await prisma.$disconnect();
}
