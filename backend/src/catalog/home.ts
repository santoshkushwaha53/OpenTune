import { prisma } from "../db/prisma.js";

import { getPreferenceView } from "../onboarding/preferences.js";
import { rankDiscoveryShelves } from "./ranking.js";
import { serializeTrack } from "./search.js";

async function serializeIds(ids: string[]) {
  return Promise.all(ids.map((id) => serializeTrack(id)));
}

function daypartGreeting(displayName?: string): string {
  const hour = new Date().getHours();
  const part =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = displayName?.trim();
  return name ? `${part}, ${name}` : part;
}

export async function getHomeShelves(userId?: string) {
  const tracks = await prisma.track.findMany({
    where: { deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const pool = tracks.map((track) => track.id);
  const shelves = await rankDiscoveryShelves(pool, userId);

  const [recommended, trending, newOpenReleases, catalog] = await Promise.all([
    serializeIds(shelves.forYou.slice(0, 8)),
    serializeIds(shelves.trending.slice(0, 8)),
    serializeIds(shelves.fresh.slice(0, 8)),
    serializeIds(shelves.catalog.slice(0, 8)),
  ]);

  let recentlyPlayed: Awaited<ReturnType<typeof serializeTrack>>[] = [];
  if (userId) {
    const recents = await prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: 40,
    });
    const seen = new Set<string>();
    const recentIds: string[] = [];
    for (const row of recents) {
      if (seen.has(row.trackId)) {
        continue;
      }
      seen.add(row.trackId);
      recentIds.push(row.trackId);
      if (recentIds.length >= 8) {
        break;
      }
    }
    recentlyPlayed = await serializeIds(recentIds);
  }

  const genres = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    take: 20,
  });
  const playlists = await prisma.playlist.findMany({
    where: { visibility: "public", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, description: true },
  });

  const downloadable = catalog.filter((track) => track.availability.download);

  const personalized = userId ? await personalizedHome(userId, recommended) : null;

  return {
    greeting: personalized?.greeting ?? daypartGreeting(),
    subtitle: personalized?.subtitle ?? "Here's something you'll love.",
    personalized: Boolean(personalized),
    recentlyPlayed,
    continueListening: recentlyPlayed.slice(0, 4),
    recommended,
    newOpenReleases,
    trending,
    downloadable,
    genres,
    communityPlaylists: playlists,
    firstCollection: personalized?.firstCollection ?? [],
    becauseYouLike: personalized?.becauseYouLike ?? [],
    languageShelves: personalized?.languageShelves ?? [],
    categoryShelves: personalized?.categoryShelves ?? [],
    favoriteArtists: personalized?.favoriteArtists ?? [],
  };
}

async function personalizedHome(
  userId: string,
  recommended: Awaited<ReturnType<typeof serializeTrack>>[],
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    include: {
      artists: { include: { artist: true } },
      categories: true,
      languages: true,
      moods: true,
    },
  });
  if (!prefs?.onboardingCompleted) {
    return null;
  }

  const view = await getPreferenceView(userId);
  const firstCollection = view.starterTrackIds.length
    ? await serializeIds(view.starterTrackIds.slice(0, 10))
    : recommended.slice(0, 10);

  const becauseYouLike = [];
  for (const artist of view.favoriteArtists.slice(0, 3)) {
    const credits = await prisma.trackArtist.findMany({
      where: { artistId: artist.id, track: { deletedAt: null } },
      select: { trackId: true },
      take: 8,
    });
    const tracks = await serializeIds(credits.map((row) => row.trackId));
    if (tracks.length === 0) {
      continue;
    }
    becauseYouLike.push({
      title: `Because you like ${artist.name}`,
      artist,
      tracks,
    });
  }

  const languageShelves = view.preferredLanguages.slice(0, 3).map((language) => ({
    title: `Because you like ${language.name} music`,
    language,
  }));

  const categoryShelves = view.favoriteCategories.slice(0, 4).map((category) => ({
    title: `More from ${category.name}`,
    category,
  }));

  return {
    greeting: daypartGreeting(user?.displayName),
    subtitle: "Here's something you'll love.",
    firstCollection,
    becauseYouLike,
    languageShelves,
    categoryShelves,
    favoriteArtists: view.favoriteArtists,
    preferences: {
      artists: view.favoriteArtists.map((item) => item.name),
      categories: view.favoriteCategories.map((item) => item.name),
      languages: view.preferredLanguages.map((item) => item.name),
      moods: view.preferredMoods.map((item) => item.name),
    },
  };
}
