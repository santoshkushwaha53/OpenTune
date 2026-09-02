import type { FastifyInstance } from "fastify";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { buildStarterPack } from "../../onboarding/recommendations.js";

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/recommendations/starter-pack",
    {
      schema: {
        tags: ["recommendations"],
        summary:
          "Rank up to 10 download-eligible tracks from preferences. Metadata only — no audio URLs.",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => buildStarterPack(currentUser(request).id),
  );
}
