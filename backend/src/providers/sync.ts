import { prisma } from "../db/prisma.js";
import {
  isWildcardCatalogQuery,
  persistProviderSearch,
  seedOpenCatalogArtists,
} from "../catalog/discover.js";
import { AppError, ErrorCodes } from "../http/errors.js";

import { providerRegistry } from "./core/registry.js";
import type { MusicProvider, ProviderHealth } from "./core/types.js";

const CONSECUTIVE_FAILURES_TO_DISABLE = 3;

export type HealthInspection = {
  slug: string;
  ok: boolean;
  latencyMs: number;
  message?: string;
  disabled: boolean;
  isEnabled: boolean;
};

/**
 * Search the connector and persist catalog metadata only.
 * Never calls playback/download source methods and never stores audio URLs.
 */
export async function syncProviderCatalog(slug: string, query = "*") {
  const row = await prisma.provider.findUnique({ where: { slug } });
  const provider = providerRegistry.get(slug);
  if (!row || !provider) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Provider not found");
  }
  if (!row.isEnabled) {
    throw new AppError(409, ErrorCodes.CONFLICT, "Provider is disabled");
  }

  const log = await prisma.providerSyncLog.create({
    data: {
      providerId: row.id,
      startedAt: new Date(),
      status: "running",
    },
  });

  try {
    const result = isWildcardCatalogQuery(query)
      ? await seedOpenCatalogArtists({
          limitPerQuery: 20,
          maxQueries: 40,
          providerSlug: slug,
        })
      : {
          queries: 1,
          recordsSynced: await persistProviderSearch(query, {
            limit: 20,
            providerSlug: slug,
          }),
        };
    await prisma.providerSyncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        recordsSynced: result.recordsSynced,
      },
    });
    return { slug, recordsSynced: result.recordsSynced, status: "success" as const };
  } catch (error) {
    await prisma.providerSyncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        error: error instanceof Error ? error.message : "sync failed",
      },
    });
    throw error;
  }
}

export async function listProviderSyncLogs(slug: string) {
  const row = await prisma.provider.findUnique({ where: { slug } });
  if (!row) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Provider not found");
  }
  const logs = await prisma.providerSyncLog.findMany({
    where: { providerId: row.id },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      startedAt: true,
      finishedAt: true,
      status: true,
      recordsSynced: true,
      error: true,
    },
  });
  return { slug, logs };
}

export async function inspectProviderHealth(slug: string): Promise<HealthInspection> {
  const row = await prisma.provider.findUnique({ where: { slug } });
  const provider = providerRegistry.get(slug);
  if (!row || !provider) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Provider not found");
  }
  return recordProviderHealth(row, provider);
}

export async function sweepProviderHealth() {
  const rows = await prisma.provider.findMany();
  const results: HealthInspection[] = [];

  for (const row of rows) {
    const provider = providerRegistry.get(row.slug);
    if (!provider) {
      continue;
    }
    results.push(await recordProviderHealth(row, provider));
  }

  return { results };
}

async function recordProviderHealth(
  row: { id: string; slug: string; isEnabled: boolean },
  provider: MusicProvider,
): Promise<HealthInspection> {
  const started = Date.now();
  let health: ProviderHealth;
  try {
    health = await provider.healthCheck();
  } catch (error) {
    health = {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "health check failed",
    };
  }
  return applyHealthResult(row, health);
}

async function applyHealthResult(
  row: { id: string; slug: string; isEnabled: boolean },
  health: ProviderHealth,
): Promise<HealthInspection> {
  const { ok, latencyMs, message } = health;

  await prisma.providerHealthCheck.create({
    data: {
      providerId: row.id,
      status: ok ? "healthy" : "down",
      latencyMs,
      error: ok ? null : (message ?? "unhealthy"),
    },
  });

  const recent = await prisma.providerHealthCheck.findMany({
    where: { providerId: row.id },
    orderBy: { checkedAt: "desc" },
    take: CONSECUTIVE_FAILURES_TO_DISABLE,
  });
  const consecutiveDown =
    recent.length >= CONSECUTIVE_FAILURES_TO_DISABLE &&
    recent.every((check) => check.status === "down");
  const isEnabled = consecutiveDown ? false : ok ? true : row.isEnabled;

  await prisma.provider.update({
    where: { id: row.id },
    data: {
      healthStatus: ok ? "healthy" : "down",
      lastHealthCheckAt: new Date(),
      isEnabled,
    },
  });

  return {
    slug: row.slug,
    ok,
    latencyMs,
    message,
    disabled: consecutiveDown,
    isEnabled,
  };
}
