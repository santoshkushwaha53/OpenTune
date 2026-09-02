import { getEnv } from "../config/env.js";
import { Prisma } from "../generated/prisma/index.js";
import { prisma } from "../db/prisma.js";
import { AppError, ErrorCodes } from "../http/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  signAccessToken,
} from "./tokens.js";

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
} as const;

export const meUserSelect = {
  ...publicUserSelect,
  email: true,
  updatedAt: true,
} as const;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
};

async function issueTokens(
  userId: string,
  meta: { userAgent?: string; ip?: string },
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  const session = await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryDate(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });
  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: getEnv().JWT_ACCESS_EXPIRES_IN,
  };
}

export async function registerUser(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  meta: { userAgent?: string; ip?: string };
}): Promise<{ user: object; tokens: TokenPair }> {
  const email = input.email.toLowerCase().trim();
  const username = input.username.toLowerCase().trim();
  try {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName.trim(),
      },
      select: meUserSelect,
    });
    const tokens = await issueTokens(user.id, input.meta);
    return { user, tokens };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(409, ErrorCodes.CONFLICT, "Email or username already taken");
    }
    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
  meta: { userAgent?: string; ip?: string };
}): Promise<{ user: object; tokens: TokenPair }> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid email or password");
  }
  const tokens = await issueTokens(user.id, input.meta);
  const safe = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: meUserSelect,
  });
  return { user: safe, tokens };
}

export async function refreshSession(input: {
  refreshToken: string;
  meta: { userAgent?: string; ip?: string };
}): Promise<TokenPair> {
  const hash = hashRefreshToken(input.refreshToken);
  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.user.deletedAt
  ) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid refresh token");
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(session.userId, input.meta);
}

export async function logoutSession(refreshToken: string): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  await prisma.userSession.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: meUserSelect,
  });
  if (!user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Account not found");
  }
  return user;
}

export async function updateMe(
  userId: string,
  patch: { displayName?: string; bio?: string | null; avatarUrl?: string | null },
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName.trim() }
        : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    },
    select: meUserSelect,
  });
}

export async function getPublicUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: publicUserSelect,
  });
  if (!user) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");
  }
  return user;
}
