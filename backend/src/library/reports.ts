import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";
import type { ReportEntityType } from "../generated/prisma/index.js";

export async function createReport(
  reporterId: string,
  input: { entityType: ReportEntityType; entityId: string; reason: string },
) {
  await assertEntityExists(input.entityType, input.entityId);
  return prisma.report.create({
    data: {
      reporterId,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason.trim(),
    },
    select: { id: true, status: true, entityType: true, entityId: true },
  });
}

async function assertEntityExists(entityType: ReportEntityType, entityId: string) {
  let found = false;
  switch (entityType) {
    case "track":
      found = Boolean(
        await prisma.track.findFirst({ where: { id: entityId, deletedAt: null } }),
      );
      break;
    case "playlist":
      found = Boolean(
        await prisma.playlist.findFirst({ where: { id: entityId, deletedAt: null } }),
      );
      break;
    case "user":
      found = Boolean(
        await prisma.user.findFirst({ where: { id: entityId, deletedAt: null } }),
      );
      break;
    case "artist":
      found = Boolean(await prisma.artist.findUnique({ where: { id: entityId } }));
      break;
    case "album":
      found = Boolean(await prisma.album.findUnique({ where: { id: entityId } }));
      break;
    case "source":
      found = Boolean(await prisma.trackSource.findUnique({ where: { id: entityId } }));
      break;
  }
  if (!found) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Reported entity not found");
  }
}
