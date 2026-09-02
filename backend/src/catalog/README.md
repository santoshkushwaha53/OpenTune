# Catalog (Phase 7)

Search aggregates enabled `MusicProvider` connectors, persists **metadata only**, and dedupes by `canonical_key` (normalized title + primary artist + 5-second duration bucket).

The **source resolver** (`resolver.ts`) runs at request time:

1. Load stored provenance (`provider` + `externalTrackId` + license flags)
2. Ask the connector for playback/download URLs
3. Apply capability helpers so stream-only tracks cannot become downloads
4. Allowlist the URL host (Jamendo hosts, or `example.invalid` for the test fake)
5. Return descriptors to the client — never audio bytes, never a media proxy path

Resolved URLs are not written to PostgreSQL.

Discovery ranking (Phase 16) reorders these metadata results. It never fetches audio.

Onboarding recommendations rank catalog metadata using artist / category / language / mood weights, then **verify** a permitted provider download URL exists. The API still never returns audio bytes.

Discover scenes are editorial open-catalog queries (Bollywood, Hindi, Jazz, …). They do not claim a commercial industry catalog.

Search accepts `year` / `yearFrom` / `yearTo` and maps them to provider date filters (Jamendo `datebetween`).

Provider health (Phase 17) can disable a connector after repeated `healthCheck` failures. Disabled providers are omitted from this search loop. Catalog sync uses the same persist path and never writes audio URLs. `POST /providers/:slug/sync` with `query=*` walks open-catalog scene queries so singers with licensed tracks are stored as metadata.

`GET /api/v1/search/artists` looks up those persisted singers (and live-searches providers when `q` is set). It is not a commercial film-artist directory.

Load tests (Phase 19) hammer search and `/tracks/:id/sources` concurrently. They never request audio bytes. Query indexes are listed in `docs/PERFORMANCE.md`.

Production (Phase 20) deploys this API with PostgreSQL only. There is no media origin in OpenTune.
