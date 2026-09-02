import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { parseWith } from "../../http/validate.js";
import { listOnboardingArtists } from "../../onboarding/artists.js";
import {
  publicCategories,
  publicLanguages,
  publicMoods,
} from "../../onboarding/catalog.js";
import {
  completeOnboarding,
  getPreferenceView,
  savePreferences,
} from "../../onboarding/preferences.js";

const artistQuery = z.object({
  q: z.string().max(80).optional(),
});

const preferencesBody = z.object({
  artistIds: z.array(z.string().uuid()).max(15).optional(),
  categorySlugs: z.array(z.string().min(1).max(40)).max(16).optional(),
  languageCodes: z.array(z.string().min(1).max(32)).max(16).optional(),
  moodSlugs: z.array(z.string().min(1).max(40)).max(16).optional(),
  languageMode: z.enum(["prefer", "only"]).optional(),
  wifiOnlyDownloads: z.boolean().optional(),
  autoDownloadRecommendations: z.boolean().optional(),
  downloadStarterPack: z.boolean().optional(),
});

const completeBody = z.object({
  skip: z.boolean().optional(),
});

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/onboarding/artists",
    {
      schema: {
        tags: ["onboarding"],
        summary: "Open-catalog artists for personalization (metadata only)",
      },
    },
    async (request) => {
      const query = parseWith(artistQuery, request.query, "query");
      return listOnboardingArtists(query.q);
    },
  );

  app.get(
    "/onboarding/categories",
    {
      schema: { tags: ["onboarding"], summary: "Music scenes and styles" },
    },
    async (request) => {
      const more = (request.query as { more?: string }).more === "true";
      return { categories: publicCategories(more) };
    },
  );

  app.get(
    "/onboarding/languages",
    {
      schema: { tags: ["onboarding"], summary: "Language ranking signals" },
    },
    async () => ({ languages: publicLanguages() }),
  );

  app.get(
    "/onboarding/moods",
    {
      schema: { tags: ["onboarding"], summary: "Optional listening vibes" },
    },
    async () => ({ moods: publicMoods() }),
  );

  app.get(
    "/users/me/preferences",
    {
      schema: {
        tags: ["users"],
        summary: "Current listening preferences",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => getPreferenceView(currentUser(request).id),
  );

  app.put(
    "/users/me/preferences",
    {
      schema: {
        tags: ["users"],
        summary: "Replace listening preferences",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => {
      const body = parseWith(preferencesBody, request.body, "body");
      return savePreferences(currentUser(request).id, body);
    },
  );

  app.post(
    "/onboarding/complete",
    {
      schema: {
        tags: ["onboarding"],
        summary: "Mark personalization finished (skip or after starter pack)",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => {
      const body = parseWith(completeBody, request.body ?? {}, "body");
      return completeOnboarding(currentUser(request).id, { skip: body.skip });
    },
  );
}
