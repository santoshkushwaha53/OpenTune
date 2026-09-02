# Music providers

Connectors implement `MusicProvider` under `core/types.ts`. The Fastify API never fetches audio bytes from these URLs.

## Phase 5 contract

| Piece                  | Role                                                   |
| ---------------------- | ------------------------------------------------------ |
| `core/types.ts`        | Interface, capabilities, DTOs                          |
| `core/registry.ts`     | In-memory plugin registry                              |
| `core/capabilities.ts` | Stream/download permission helpers                     |
| `core/errors.ts`       | `ProviderError`, `ProviderCapabilityError`             |
| `fake/FakeProvider.ts` | Test catalog (downloadable + stream-only tracks)       |
| `audius/`              | Official Audius API (priority 1, CC stream + download) |
| `jamendo/`             | Official Jamendo API (priority 2)                      |
| `archive/`             | Official Internet Archive search/metadata (priority 3, CC/PD audio only) |
| `fma/`                 | Disabled slot — FMA retired its API; no scrape         |

Search walks enabled connectors in **priority order**. Download-allowed hits fill the list first; listen-only rows are kept only if the catalog would otherwise be empty of those query matches. `permittedDownloadSource()` still returns `null` for stream-only tracks.

Operator `POST /providers/:slug/sync` with `query=*` seeds scene queries (Bollywood, Hindi, jazz, …) as **metadata**. Playback URLs are still resolved per request.

Jamendo (`jamendo/`) is a **legal** connector (Phase 6). Official API only; recorded fixtures in CI. Do not scrape catalogs or invent a download from a stream-only capability set.

A connector must declare:

- `id` and `name`
- `capabilities` (`supportsStreaming`, `supportsDownload`, `supportsOffline`, `supportsRedistribution`, `requiresAttribution`)
- license and attribution mapping
- `healthCheck`
- tests (fixtures preferred over live network)

`getAlbum`, `getArtist`, and `getPlaylist` are optional. Callers check method presence instead of assuming every catalog exposes them.

`permittedDownloadSource()` returns `null` when the provider or track cannot download. That is the only supported way to resolve a download URL.

## Phase 17 — health and metadata sync

`healthCheck()` results are written to `provider_health_checks`. Three consecutive `down` rows disable the provider (`is_enabled = false`); a later healthy check re-enables it. Search and the source resolver already skip disabled connectors.

`syncProviderCatalog` calls `search` + `persistProviderTrack` only. Playback and download URLs stay request-time via the resolver and are never stored.
