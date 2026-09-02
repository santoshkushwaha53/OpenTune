import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("14d"),
  CORS_ORIGIN: z.string().optional().default(""),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  JAMENDO_CLIENT_ID: z.string().optional().default(""),
  OPERATOR_TOKEN: z
    .string()
    .default("")
    .refine((value) => value.length === 0 || value.length >= 16, {
      message: "OPERATOR_TOKEN must be at least 16 characters when set",
    }),
});

export type Env = z.infer<typeof envSchema>;

const INSECURE_SECRET =
  /change-me|replace-with|not-for-production|placeholder|test-access-secret|test-refresh-secret/i;

function assertProductionSecrets(env: Env): void {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const problems: string[] = [];
  if (env.JWT_ACCESS_SECRET.length < 32) {
    problems.push("JWT_ACCESS_SECRET must be at least 32 characters in production");
  }
  if (env.JWT_REFRESH_SECRET.length < 32) {
    problems.push("JWT_REFRESH_SECRET must be at least 32 characters in production");
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
  }
  if (INSECURE_SECRET.test(env.JWT_ACCESS_SECRET)) {
    problems.push("JWT_ACCESS_SECRET looks like a placeholder");
  }
  if (INSECURE_SECRET.test(env.JWT_REFRESH_SECRET)) {
    problems.push("JWT_REFRESH_SECRET looks like a placeholder");
  }
  if (env.OPERATOR_TOKEN.length > 0 && INSECURE_SECRET.test(env.OPERATOR_TOKEN)) {
    problems.push("OPERATOR_TOKEN looks like a placeholder");
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
}

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(details)}`);
  }
  assertProductionSecrets(parsed.data);
  return parsed.data;
}

export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}

export function corsOrigins(env: Env = getEnv()): boolean | string[] {
  const raw = env.CORS_ORIGIN.trim();
  if (!raw) {
    return env.NODE_ENV === "production" ? false : true;
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
