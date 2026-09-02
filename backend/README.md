# OpenTune API

Fastify + TypeScript metadata API. **Does not proxy, cache, or store audio.**

Production is this API plus PostgreSQL — no object storage for music. See [docs/DEPLOY.md](../docs/DEPLOY.md).

## Scripts

```bash
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev          # http://localhost:3000
npm test
npm run lint
npm run format
npm run format:check
npm run db:validate
```

Copy the repository root `.env.example` to `.env` before running Prisma or `npm run dev`. Prisma loads `../.env` then `backend/.env`.

Health:

- `GET /health`
- `GET /api/v1/health`

OpenAPI:

- `GET /docs`
- `GET /docs/json`

Errors:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "..." } }
```

## Schema

See `prisma/schema.prisma`. Tables store **metadata and license provenance**, never audio files or long-lived stream/download URLs.

Load tests (`test/load.test.ts`) concurrently call search and the source resolver. They do not fetch audio. Index notes: [docs/PERFORMANCE.md](../docs/PERFORMANCE.md).

Production image: `backend/Dockerfile` (non-root, healthcheck, `prisma migrate deploy` then `node dist/server.js`). Compose: [docker-compose.prod.yml](../docker-compose.prod.yml).
