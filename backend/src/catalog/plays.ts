import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";

export async function recordPlay(
  userId: string,
  input: {
    trackId: string;
    durationPlayedMs: number;
    context?: "queue" | "playlist" | "album" | "search" | "other";
    contextId?: string;
  },
) {
  const track = await prisma.track.findFirst({
    where: { id: input.trackId, deletedAt: null },
  });
  if (!track) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Track not found");
  }
  return prisma.playHistory.create({
    data: {
      userId,
      trackId: input.trackId,
      durationPlayedMs: input.durationPlayedMs,
      context: input.context,
      contextId: input.contextId,
    },
  });
}
