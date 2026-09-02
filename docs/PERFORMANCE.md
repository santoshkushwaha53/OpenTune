# Testing and performance (Phase 19)

OpenTune load-tests **metadata** routes only. Never measure or fetch audio bytes through the API.

## Load tests

`backend/test/load.test.ts` concurrently hits:

- `GET /health` (excluded from rate limiting)
- `GET /api/v1/search?q=` (catalog metadata)
- `GET /api/v1/tracks/:id/sources` (source resolver)

Assertions: HTTP success, no `/api/v1/audio` bodies, provider URLs stay on allowlisted hosts, wall time under the Vitest timeout.

```bash
cd backend && npm test -- test/load.test.ts
```

## Indexes

Search does **not** use `pg_trgm`. Connectors search remotely; Postgres stores canonical keys and provenance.

| Index | Why |
| --- | --- |
| `tracks (canonical_key)` | Dedupe on persist |
| `tracks (deleted_at, created_at DESC)` | Home shelf pool |
| `track_sources (track_id)` | Resolver + ranking includes |
| `play_history (user_id, played_at DESC)` | Recents / For you |
| `play_history (track_id)` | Trending `groupBy` |
| `providers (is_enabled)` | Search enabled connectors |
| `playlists (visibility, deleted_at)` | Public community shelf |

Do not add audio URL columns to “speed up” playback. Resolve at request time.

## Flutter goldens and offline

- Semantic goldens (chip labels, offline banner) run on every OS in CI.
- Pixel goldens (`test/goldens/*.png`) run on macOS. Update with `flutter test --update-goldens test/golden_test.dart`.
- Offline tests: `CatalogCache` + `OfflineStore` so `home()` does not retry the API; the player uses local files only (`test/download_test.dart`, `test/offline_test.dart`).
