import type { Env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { FakeProvider } from "../providers/fake/FakeProvider.js";
import { JamendoProvider } from "../providers/jamendo/JamendoProvider.js";
import { providerRegistry } from "../providers/core/registry.js";

const jamendoCapabilities = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
};

export async function bootstrapProviders(env: Env): Promise<void> {
  if (env.NODE_ENV === "test") {
    providerRegistry.register(new FakeProvider());
  }
  providerRegistry.register(new JamendoProvider(env.JAMENDO_CLIENT_ID ?? ""));

  await prisma.provider.upsert({
    where: { slug: "jamendo" },
    create: {
      slug: "jamendo",
      name: "Jamendo",
      isEnabled: Boolean(env.JAMENDO_CLIENT_ID),
      capabilities: jamendoCapabilities,
      baseUrl: "https://api.jamendo.com/v3.0",
    },
    update: {
      isEnabled: env.JAMENDO_CLIENT_ID ? true : undefined,
      capabilities: jamendoCapabilities,
    },
  });

  if (env.NODE_ENV === "test") {
    await prisma.provider.upsert({
      where: { slug: "fake" },
      create: {
        slug: "fake",
        name: "Fake Open Catalog",
        isEnabled: true,
        capabilities: {
          supportsStreaming: true,
          supportsDownload: true,
          supportsOffline: true,
          supportsRedistribution: false,
          requiresAttribution: true,
        },
        baseUrl: "https://example.invalid",
      },
      update: { isEnabled: true },
    });
  }
}

export async function listProviders() {
  return prisma.provider.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      name: true,
      isEnabled: true,
      capabilities: true,
      healthStatus: true,
      lastHealthCheckAt: true,
    },
  });
}
