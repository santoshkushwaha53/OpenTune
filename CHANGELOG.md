# Changelog

All notable changes to OpenTune are documented here.

## Unreleased

- Personalized onboarding after registration: artists, scenes, languages, and vibes stored as metadata in PostgreSQL
- Starter-pack ranking returns at most 10 **download-eligible** tracks; streaming-only rows are never auto-downloaded
- Flutter downloads the starter pack from provider URLs in the background and lands on Home immediately
- Home is artwork-first (greeting, hero, horizontal shelves) instead of offline-status copy
- Discover browse uses visual scene tiles; search can target songs, singers, and years
- Discover scene results show a song count plus Play and Download actions (no source URLs)
- Discover scene search falls back to Jamendo tags when a name search is empty (open catalog, not commercial film songs)
- Discover retries empty scene chips with an open-catalog query (Bollywood → indian) so the list is not blank
- Indian scene chips fill from per-tag Jamendo/Audius queries (sitar, raga, bhangra, …) and say they are licensed open-catalog tracks, not film soundtracks
- Discover singer search seeds open-catalog artists (Jamendo/Audius) so the Singers tab can find names that have licensed tracks
- Internet Archive official search/metadata connector (CC BY / BY-SA / CC0 / public-domain audio only). Search still cannot return commercial film catalogs.
- Sohum source router: Audius (1) → Jamendo (2) → Internet Archive (3, CC/public-domain audio) → FMA (4, disabled). Search prefers download-allowed tracks; stream-only is never turned into a download. FMA has no official API so it is not queried.
- Home hero follows now playing, listen history, and the last Discover search

## 0.1.0 — 2026-09-02

Initial open-source release of the metadata mediator:

- Fastify TypeScript API with Prisma/PostgreSQL, JWT auth, and OpenAPI
- Jamendo official-API connector plus a test-only fake provider
- Search, discovery ranking, playlists, sharing, and play history
- Flutter client: Home, Discover, Library, player, on-device downloads
- API never proxies, caches, or stores audio or video
- Production compose: API + Postgres only (no audio bucket); GitHub Release workflow
