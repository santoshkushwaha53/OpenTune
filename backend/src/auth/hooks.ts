import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";
import { verifyAccessToken } from "./tokens.js";

export type AuthUser = {
  id: string;
  sessionId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Authentication required");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Authentication required");
  }

  let payload: { sub: string; sid: string };
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid or expired token");
  }

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.user.deletedAt
  ) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid or expired token");
  }

  request.authUser = { id: session.userId, sessionId: session.id };
}

export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Authentication required");
  }
  return request.authUser;
}

export async function optionalAuth(request: FastifyRequest): Promise<void> {
  if (!request.headers.authorization?.startsWith("Bearer ")) {
    return;
  }
  try {
    await requireAuth(request, undefined as never);
  } catch {
    request.authUser = undefined;
  }
}
