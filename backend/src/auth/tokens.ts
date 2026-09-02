import { createHash, randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { getEnv } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  sid: string;
};

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const env = getEnv();
  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(secretKey(env.JWT_ACCESS_SECRET));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const env = getEnv();
  const { payload } = await jwtVerify(token, secretKey(env.JWT_ACCESS_SECRET), {
    algorithms: ["HS256"],
  });
  const sub = payload.sub;
  const sid = payload.sid;
  if (typeof sub !== "string" || typeof sid !== "string") {
    throw new Error("invalid access token payload");
  }
  return { sub, sid };
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate(): Date {
  const env = getEnv();
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const amount = match ? Number(match[1]) : 14;
  const unit = match?.[2] ?? "d";
  const ms =
    unit === "s"
      ? amount * 1000
      : unit === "m"
        ? amount * 60_000
        : unit === "h"
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(Date.now() + ms);
}
