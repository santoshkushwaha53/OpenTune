import { z } from "zod";

import { AppError, ErrorCodes } from "./errors.js";

export function parseWith<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : label;
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, details);
  }
  return parsed.data;
}
