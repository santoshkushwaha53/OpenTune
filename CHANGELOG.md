# Changelog

All notable changes to OpenTune are documented here.

## 0.1.0 — 2026-09-02

Initial open-source release of the metadata mediator:

- Fastify TypeScript API with Prisma/PostgreSQL, JWT auth, and OpenAPI
- Jamendo official-API connector plus a test-only fake provider
- Search, discovery ranking, playlists, sharing, and play history
- Flutter client: Home, Discover, Library, player, on-device downloads
- API never proxies, caches, or stores audio or video
- Production compose: API + Postgres only (no audio bucket); GitHub Release workflow
