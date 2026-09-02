import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

import { buildApp } from "./app.js";
import { getEnv } from "./config/env.js";

loadDotenv({ path: resolve(import.meta.dirname, "../../.env") });
loadDotenv({ path: resolve(import.meta.dirname, "../.env") });

async function main(): Promise<void> {
  const env = getEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
