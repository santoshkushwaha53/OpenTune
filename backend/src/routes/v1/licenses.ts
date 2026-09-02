import type { FastifyInstance } from "fastify";

import { prisma } from "../../db/prisma.js";
import { AppError, ErrorCodes } from "../../http/errors.js";

export async function licensesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/licenses",
    {
      schema: { tags: ["licenses"], summary: "SPDX license catalog" },
    },
    async () => ({
      licenses: await prisma.license.findMany({ orderBy: { spdxId: "asc" } }),
    }),
  );

  app.get(
    "/licenses/:id",
    {
      schema: { tags: ["licenses"], summary: "License by id or SPDX id" },
    },
    async (request) => {
      const id = (request.params as { id: string }).id;
      const byUuid = /^[0-9a-f-]{36}$/i.test(id);
      const license = await prisma.license.findFirst({
        where: byUuid ? { OR: [{ id }, { spdxId: id }] } : { spdxId: id },
      });
      if (!license) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, "License not found");
      }
      return license;
    },
  );
}
