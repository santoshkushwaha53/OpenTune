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

Provider health (Phase 17) can disable a connector after repeated `healthCheck` failures. Disabled providers are omitted from this search loop. Catalog sync uses the same persist path and never writes audio URLs.

Load tests (Phase 19) hammer search and `/tracks/:id/sources` concurrently. They never request audio bytes. Query indexes are listed in `docs/PERFORMANCE.md`.

Production (Phase 20) deploys this API with PostgreSQL only. There is no media origin in OpenTune.
