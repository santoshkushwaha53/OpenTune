# Fastify plugins

Phase 3 registers:

- Helmet and CORS (app bootstrap)
- In-memory rate limiting (`rate-limit.ts`) — Redis is not required
- Request IDs via Fastify `requestIdHeader` / `genReqId`
- Structured Pino logs with secret redaction
- OpenAPI + Swagger UI (`swagger.ts`) at `/docs`
- Canonical JSON error envelope (`error-handler.ts`)

Provider connectors live under `src/providers/` (Phase 5), not here.

The API must never register a plugin that proxies, caches, or stores audio or video.

Operator authentication for provider sync/health lives in `src/security/operator.ts` (Phase 18), not as a Fastify plugin.
