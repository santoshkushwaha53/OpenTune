import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { Env } from "../config/env.js";
import { AppError, apiErrorBody, ErrorCodes } from "../http/errors.js";

function isFastifyValidationError(
  error: unknown,
): error is Error & { validation: unknown; statusCode?: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    (error as { validation?: unknown }).validation !== undefined
  );
}

export async function errorHandlerPlugin(
  app: FastifyInstance,
  env: Env,
): Promise<void> {
  app.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(apiErrorBody(error.code, error.message, requestId));
    }

    if (isFastifyValidationError(error)) {
      return reply
        .status(400)
        .send(apiErrorBody(ErrorCodes.VALIDATION_ERROR, error.message, requestId));
    }

    const statusCode =
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    if (statusCode === 429) {
      return reply
        .status(429)
        .send(apiErrorBody(ErrorCodes.RATE_LIMITED, "Too many requests", requestId));
    }

    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled error");
    }

    const message =
      env.NODE_ENV === "production" && statusCode >= 500
        ? "Internal server error"
        : error.message || "Internal server error";

    return reply
      .status(statusCode >= 400 ? statusCode : 500)
      .send(apiErrorBody(ErrorCodes.INTERNAL_ERROR, message, requestId));
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split("?")[0] ?? request.url;
    return reply
      .status(404)
      .send(
        apiErrorBody(
          ErrorCodes.NOT_FOUND,
          `Route ${request.method} ${path} not found`,
          request.id,
        ),
      );
  });
}
