import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      PORT: "3000",
      HOST: "127.0.0.1",
      LOG_LEVEL: "silent",
      DATABASE_URL:
        "postgresql://opentune:opentune@localhost:5432/opentune?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-not-for-production-use-32ch",
      JWT_REFRESH_SECRET: "test-refresh-secret-not-for-production-use-32",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "14d",
      CORS_ORIGIN: "",
      RATE_LIMIT_MAX: "1000",
      RATE_LIMIT_WINDOW_MS: "60000",
      OPERATOR_TOKEN: "test-operator-token-not-for-production",
    },
  },
});
