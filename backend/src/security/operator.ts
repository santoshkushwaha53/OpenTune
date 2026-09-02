import { timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { getEnv } from "../config/env.js";
import { AppError, ErrorCodes } from "../http/errors.js";

export const OPERATOR_HEADER = "x-opentune-operator";

export async function requireOperator(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const expected = getEnv().OPERATOR_TOKEN;
  if (!expected) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Operator token is not configured");
  }
  const provided = request.headers[OPERATOR_HEADER];
  if (typeof provided !== "string" || provided.length === 0) {
    throw new AppError(
      401,
      ErrorCodes.UNAUTHORIZED,
      "Operator authentication required",
    );
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError(
      401,
      ErrorCodes.UNAUTHORIZED,
      "Operator authentication required",
    );
  }
}
