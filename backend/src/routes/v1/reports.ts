import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { createReport } from "../../library/reports.js";
import { parseWith } from "../../http/validate.js";

const bodySchema = z.object({
  entityType: z.enum(["track", "playlist", "user", "artist", "album", "source"]),
  entityId: z.string().uuid(),
  reason: z
    .string()
    .min(8)
    .max(2000)
    .refine((value) => !/^https?:\/\//i.test(value.trim()), {
      message: "reason must be text, not a URL to fetch",
    }),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/reports",
    {
      schema: { tags: ["users"], security: [{ bearerAuth: [] }] },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const body = parseWith(bodySchema, request.body, "body");
      const report = await createReport(currentUser(request).id, body);
      return reply.status(201).send(report);
    },
  );
}
