import { HealthStatus, type PrismaClient } from "../src/generated/prisma/index.js";

import {
  JAMENDO_CAPABILITIES,
  JAMENDO_PROVIDER_SLUG,
  SEED_LICENSES,
} from "./seed-data.js";

export async function seedCatalog(client: PrismaClient): Promise<void> {
  for (const license of SEED_LICENSES) {
    await client.license.upsert({
      where: { spdxId: license.spdxId },
      create: license,
      update: {
        name: license.name,
        url: license.url,
        allowsStreaming: license.allowsStreaming,
        allowsDownload: license.allowsDownload,
        requiresAttribution: license.requiresAttribution,
        allowsRedistribution: license.allowsRedistribution,
      },
    });
  }

  await client.provider.upsert({
    where: { slug: JAMENDO_PROVIDER_SLUG },
    create: {
      slug: JAMENDO_PROVIDER_SLUG,
      name: "Jamendo",
      isEnabled: false,
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.jamendo.com/v3.0",
      healthStatus: HealthStatus.unknown,
    },
    update: {
      name: "Jamendo",
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.jamendo.com/v3.0",
    },
  });
}
