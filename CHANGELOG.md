# Changelog

All notable changes to OpenTune are documented here.

## Unreleased

- Personalized onboarding after registration: artists, scenes, languages, and vibes stored as metadata in PostgreSQL
- Starter-pack ranking returns at most 10 **download-eligible** tracks; streaming-only rows are never auto-downloaded
- Flutter downloads the starter pack from provider URLs in the background and lands on Home immediately
- Home is artwork-first (greeting, hero, horizontal shelves) instead of offline-status copy
- Discover browse uses visual scene tiles; search can target songs, singers, and years
- Discover scene results show a song count plus Play and Download actions (no source URLs)
- Home hero follows now playing, listen history, and the last Discover search

## 0.1.0 — 2026-09-02

Initial open-source release of the metadata mediator:

- Fastify TypeScript API with Prisma/PostgreSQL, JWT auth, and OpenAPI
- Jamendo official-API connector plus a test-only fake provider
- Search, discovery ranking, playlists, sharing, and play history
- Flutter client: Home, Discover, Library, player, on-device downloads
- API never proxies, caches, or stores audio or video
- Production compose: API + Postgres only (no audio bucket); GitHub Release workflow
