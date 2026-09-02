import type { Env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { ArchiveProvider } from "../providers/archive/ArchiveProvider.js";
import { AudiusProvider } from "../providers/audius/AudiusProvider.js";
import { FakeProvider } from "../providers/fake/FakeProvider.js";
import { FmaProvider } from "../providers/fma/FmaProvider.js";
import { JamendoProvider } from "../providers/jamendo/JamendoProvider.js";
import { YoutubeProvider } from "../providers/youtube/YoutubeProvider.js";
import { providerRegistry } from "../providers/core/registry.js";

const openCatalogCapabilities = {
  supportsStreaming: true,
  supportsDownload: true,
  supportsOffline: true,
  supportsRedistribution: false,
  requiresAttribution: true,
};

const fmaCapabilities = {
  supportsStreaming: false,
  supportsDownload: false,
  supportsOffline: false,
  supportsRedistribution: false,
  requiresAttribution: true,
};

const youtubeCapabilities = {
  supportsStreaming: true,
  supportsDownload: false,
  supportsOffline: false,
  supportsRedistribution: false,
  requiresAttribution: true,
};

function testOnlyArchiveFetch(): typeof fetch {
  return async () => {
    throw new Error("Internet Archive is not called in automated tests");
  };
}

export async function bootstrapProviders(env: Env): Promise<void> {
  if (env.NODE_ENV === "test") {
    providerRegistry.register(new FakeProvider());
  }
  providerRegistry.register(new YoutubeProvider(env.YOUTUBE_API_KEY ?? ""));
  providerRegistry.register(new AudiusProvider(env.AUDIUS_API_KEY ?? ""));
  providerRegistry.register(new JamendoProvider(env.JAMENDO_CLIENT_ID ?? ""));
  providerRegistry.register(
    new ArchiveProvider(env.NODE_ENV === "test" ? testOnlyArchiveFetch() : fetch),
  );
  providerRegistry.register(new FmaProvider());

  if (env.NODE_ENV === "test") {
    await prisma.provider.upsert({
      where: { slug: "fake" },
      create: {
        slug: "fake",
        name: "Fake Open Catalog",
        isEnabled: true,
        priority: 0,
        capabilities: openCatalogCapabilities,
        baseUrl: "https://example.invalid",
      },
      update: { isEnabled: true, priority: 0 },
    });
  }

  await prisma.provider.upsert({
    where: { slug: "youtube" },
    create: {
      slug: "youtube",
      name: "YouTube",
      isEnabled: Boolean(env.YOUTUBE_API_KEY),
      priority: 1,
      capabilities: youtubeCapabilities,
      baseUrl: "https://www.googleapis.com/youtube/v3",
    },
    update: {
      isEnabled: env.YOUTUBE_API_KEY ? true : undefined,
      priority: 1,
      capabilities: youtubeCapabilities,
    },
  });

  await prisma.provider.upsert({
    where: { slug: "audius" },
    create: {
      slug: "audius",
      name: "Audius",
      isEnabled: Boolean(env.AUDIUS_API_KEY),
      priority: 2,
      capabilities: openCatalogCapabilities,
      baseUrl: "https://api.audius.co/v1",
    },
    update: {
      isEnabled: env.AUDIUS_API_KEY ? true : undefined,
      priority: 2,
      capabilities: openCatalogCapabilities,
    },
  });

  await prisma.provider.upsert({
    where: { slug: "jamendo" },
    create: {
      slug: "jamendo",
      name: "Jamendo",
      isEnabled: Boolean(env.JAMENDO_CLIENT_ID),
      priority: 3,
      capabilities: openCatalogCapabilities,
      baseUrl: "https://api.jamendo.com/v3.0",
    },
    update: {
      isEnabled: env.JAMENDO_CLIENT_ID ? true : undefined,
      priority: 3,
      capabilities: openCatalogCapabilities,
    },
  });

  const archiveEnabled =
    env.NODE_ENV !== "test" && env.INTERNET_ARCHIVE_ENABLED !== "false";
  await prisma.provider.upsert({
    where: { slug: "archive" },
    create: {
      slug: "archive",
      name: "Internet Archive",
      isEnabled: archiveEnabled,
      priority: 4,
      capabilities: openCatalogCapabilities,
      baseUrl: "https://archive.org",
    },
    update: {
      isEnabled: archiveEnabled,
      priority: 4,
      capabilities: openCatalogCapabilities,
    },
  });

  await prisma.provider.upsert({
    where: { slug: "fma" },
    create: {
      slug: "fma",
      name: "Free Music Archive",
      isEnabled: false,
      priority: 5,
      capabilities: fmaCapabilities,
      baseUrl: "https://freemusicarchive.org",
    },
    update: {
      isEnabled: false,
      priority: 5,
      capabilities: fmaCapabilities,
    },
  });
}

export async function listProviders() {
  return prisma.provider.findMany({
    orderBy: { priority: "asc" },
    select: {
      slug: true,
      name: true,
      isEnabled: true,
      priority: true,
      capabilities: true,
      healthStatus: true,
      lastHealthCheckAt: true,
    },
  });
}
