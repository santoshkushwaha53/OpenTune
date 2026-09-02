import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { resolveTrackSources } from "../../catalog/resolver.js";
import { AppError, ErrorCodes } from "../../http/errors.js";
import { parseWith } from "../../http/validate.js";

const param = z.object({ trackId: z.string().uuid() });

export async function downloadsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/downloads/:trackId/source",
    {
      schema: {
        tags: ["downloads"],
        summary: "Permitted download URL from the original provider (not proxied)",
      },
    },
    async (request) => {
      const { trackId } = parseWith(param, request.params, "params");
      const resolved = await resolveTrackSources(trackId);
      const downloadable = resolved.sources.find((source) => source.downloadUrl);
      if (!downloadable) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, "No permitted download source");
      }
      return downloadable;
    },
  );
}
