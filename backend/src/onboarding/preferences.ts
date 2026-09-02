import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";

import {
  categoryBySlug,
  languageByCode,
  moodBySlug,
  ONBOARDING_VERSION,
} from "./catalog.js";

export type PreferenceInput = {
  artistIds?: string[];
  categorySlugs?: string[];
  languageCodes?: string[];
  moodSlugs?: string[];
  languageMode?: "prefer" | "only";
  wifiOnlyDownloads?: boolean;
  autoDownloadRecommendations?: boolean;
  downloadStarterPack?: boolean;
};

export type PreferenceView = {
  userId: string;
  favoriteArtists: { id: string; name: string; artworkUrl: string | null }[];
  favoriteCategories: { slug: string; name: string }[];
  preferredLanguages: { code: string; name: string }[];
  preferredMoods: { slug: string; name: string }[];
  languageMode: "prefer" | "only";
  wifiOnlyDownloads: boolean;
  autoDownloadRecommendations: boolean;
  downloadStarterPack: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  onboardingVersion: number;
  starterTrackIds: string[];
};

const MAX_ARTISTS = 15;
const MAX_LIST = 16;

export async function ensurePreferenceRow(userId: string, completed: boolean) {
  return prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      onboardingCompleted: completed,
      onboardingVersion: completed ? ONBOARDING_VERSION : 0,
      onboardingCompletedAt: completed ? new Date() : null,
    },
    update: {},
  });
}

export async function getPreferenceView(userId: string): Promise<PreferenceView> {
  await ensurePreferenceRow(userId, false);
  const row = await prisma.userPreference.findUniqueOrThrow({
    where: { userId },
    include: {
      artists: { include: { artist: true } },
      categories: true,
      languages: true,
      moods: true,
    },
  });
  return serializePreference(row);
}

export async function savePreferences(
  userId: string,
  input: PreferenceInput,
): Promise<PreferenceView> {
  await ensurePreferenceRow(userId, false);
  const artistIds = unique(input.artistIds ?? []).slice(0, MAX_ARTISTS);
  const categorySlugs = unique(input.categorySlugs ?? []).slice(0, MAX_LIST);
  const languageCodes = unique(input.languageCodes ?? []).slice(0, MAX_LIST);
  const moodSlugs = unique(input.moodSlugs ?? []).slice(0, MAX_LIST);

  if (artistIds.length > 0) {
    const found = await prisma.artist.findMany({
      where: { id: { in: artistIds } },
      select: { id: true },
    });
    if (found.length !== artistIds.length) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Unknown artist id");
    }
  }
  for (const slug of categorySlugs) {
    if (!categoryBySlug.has(slug)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unknown category ${slug}`);
    }
  }
  for (const code of languageCodes) {
    if (!languageByCode.has(code)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unknown language ${code}`);
    }
  }
  for (const slug of moodSlugs) {
    if (!moodBySlug.has(slug)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unknown mood ${slug}`);
    }
  }

  const languageMode = input.languageMode ?? "prefer";
  if (languageMode !== "prefer" && languageMode !== "only") {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      "languageMode must be prefer or only",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.userFavoriteArtist.deleteMany({ where: { userId } });
    await tx.userFavoriteCategory.deleteMany({ where: { userId } });
    await tx.userPreferredLanguage.deleteMany({ where: { userId } });
    await tx.userPreferredMood.deleteMany({ where: { userId } });
    if (artistIds.length > 0) {
      await tx.userFavoriteArtist.createMany({
        data: artistIds.map((artistId) => ({ userId, artistId })),
      });
    }
    if (categorySlugs.length > 0) {
      await tx.userFavoriteCategory.createMany({
        data: categorySlugs.map((categorySlug) => ({ userId, categorySlug })),
      });
    }
    if (languageCodes.length > 0) {
      await tx.userPreferredLanguage.createMany({
        data: languageCodes.map((languageCode) => ({ userId, languageCode })),
      });
    }
    if (moodSlugs.length > 0) {
      await tx.userPreferredMood.createMany({
        data: moodSlugs.map((moodSlug) => ({ userId, moodSlug })),
      });
    }
    await tx.userPreference.update({
      where: { userId },
      data: {
        languageMode,
        wifiOnlyDownloads: input.wifiOnlyDownloads ?? undefined,
        autoDownloadRecommendations: input.autoDownloadRecommendations ?? undefined,
        downloadStarterPack: input.downloadStarterPack ?? undefined,
      },
    });
  });

  return getPreferenceView(userId);
}

export async function completeOnboarding(
  userId: string,
  options: { skip?: boolean } = {},
): Promise<PreferenceView> {
  await ensurePreferenceRow(userId, false);
  await prisma.userPreference.update({
    where: { userId },
    data: {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      onboardingVersion: ONBOARDING_VERSION,
      ...(options.skip
        ? {
            languageMode: "prefer",
          }
        : {}),
    },
  });
  return getPreferenceView(userId);
}

export async function setStarterTrackIds(userId: string, trackIds: string[]) {
  await ensurePreferenceRow(userId, false);
  await prisma.userPreference.update({
    where: { userId },
    data: { starterTrackIds: trackIds },
  });
}

function serializePreference(row: {
  userId: string;
  languageMode: string;
  wifiOnlyDownloads: boolean;
  autoDownloadRecommendations: boolean;
  downloadStarterPack: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  onboardingVersion: number;
  starterTrackIds: string[];
  artists: { artist: { id: string; name: string; artworkUrl: string | null } }[];
  categories: { categorySlug: string }[];
  languages: { languageCode: string }[];
  moods: { moodSlug: string }[];
}): PreferenceView {
  return {
    userId: row.userId,
    favoriteArtists: row.artists.map((item) => ({
      id: item.artist.id,
      name: item.artist.name,
      artworkUrl: item.artist.artworkUrl,
    })),
    favoriteCategories: row.categories.map((item) => ({
      slug: item.categorySlug,
      name: categoryBySlug.get(item.categorySlug)?.name ?? item.categorySlug,
    })),
    preferredLanguages: row.languages.map((item) => ({
      code: item.languageCode,
      name: languageByCode.get(item.languageCode)?.name ?? item.languageCode,
    })),
    preferredMoods: row.moods.map((item) => ({
      slug: item.moodSlug,
      name: moodBySlug.get(item.moodSlug)?.name ?? item.moodSlug,
    })),
    languageMode: row.languageMode === "only" ? "only" : "prefer",
    wifiOnlyDownloads: row.wifiOnlyDownloads,
    autoDownloadRecommendations: row.autoDownloadRecommendations,
    downloadStarterPack: row.downloadStarterPack,
    onboardingCompleted: row.onboardingCompleted,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    onboardingVersion: row.onboardingVersion,
    starterTrackIds: row.starterTrackIds,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
