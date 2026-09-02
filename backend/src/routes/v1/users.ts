import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { currentUser, requireAuth } from "../../auth/hooks.js";
import { getMe, getPublicUser, updateMe } from "../../auth/service.js";
import { parseWith } from "../../http/validate.js";

const uuidParam = z.object({ id: z.string().uuid() });
const patchMeBody = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(500).nullable().optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field is required",
  });

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/users/me",
    {
      schema: {
        tags: ["users"],
        summary: "Current user",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => getMe(currentUser(request).id),
  );

  app.patch(
    "/users/me",
    {
      schema: {
        tags: ["users"],
        summary: "Update current user",
        security: [{ bearerAuth: [] }],
      },
      preHandler: requireAuth,
    },
    async (request) => {
      const body = parseWith(patchMeBody, request.body, "body");
      return updateMe(currentUser(request).id, body);
    },
  );

  app.get(
    "/users/:id",
    {
      schema: {
        tags: ["users"],
        summary: "Public profile",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request) => {
      const params = parseWith(uuidParam, request.params, "params");
      return getPublicUser(params.id);
    },
  );
}
