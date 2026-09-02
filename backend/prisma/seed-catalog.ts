import { HealthStatus, type PrismaClient } from "../src/generated/prisma/index.js";

import {
  AUDIUS_PROVIDER_SLUG,
  FMA_CAPABILITIES,
  FMA_PROVIDER_SLUG,
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
    where: { slug: AUDIUS_PROVIDER_SLUG },
    create: {
      slug: AUDIUS_PROVIDER_SLUG,
      name: "Audius",
      isEnabled: false,
      priority: 1,
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.audius.co/v1",
      healthStatus: HealthStatus.unknown,
    },
    update: {
      name: "Audius",
      priority: 1,
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.audius.co/v1",
    },
  });

  await client.provider.upsert({
    where: { slug: JAMENDO_PROVIDER_SLUG },
    create: {
      slug: JAMENDO_PROVIDER_SLUG,
      name: "Jamendo",
      isEnabled: false,
      priority: 2,
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.jamendo.com/v3.0",
      healthStatus: HealthStatus.unknown,
    },
    update: {
      name: "Jamendo",
      priority: 2,
      capabilities: JAMENDO_CAPABILITIES,
      baseUrl: "https://api.jamendo.com/v3.0",
    },
  });

  await client.provider.upsert({
    where: { slug: FMA_PROVIDER_SLUG },
    create: {
      slug: FMA_PROVIDER_SLUG,
      name: "Free Music Archive",
      isEnabled: false,
      priority: 3,
      capabilities: FMA_CAPABILITIES,
      baseUrl: "https://freemusicarchive.org",
      healthStatus: HealthStatus.unknown,
    },
    update: {
      name: "Free Music Archive",
      isEnabled: false,
      priority: 3,
      capabilities: FMA_CAPABILITIES,
      baseUrl: "https://freemusicarchive.org",
    },
  });
}
