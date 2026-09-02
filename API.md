# OpenTune API

Versioned REST API. Base path: `/api/v1`.

OpenAPI/Swagger is generated from the Fastify app. UI: `/docs`. JSON: `/docs/json`.

The API returns **metadata and source descriptors**. It never returns audio or video byte streams and never proxies media. Playback and download URLs are resolved at request time from allowlisted provider hosts.

## Conventions

- JSON request and response bodies
- ISO-8601 timestamps
- UUID resource ids
- Errors: `{ "error": { "code": "string", "message": "string", "requestId": "string" } }`
- Request ID: send or receive `x-request-id` (8–128 URL-safe characters)
- Auth: `Authorization: Bearer <access_token>`
- Operator: `x-opentune-operator` matching `OPERATOR_TOKEN` (sync, health writes, sync logs)
- Rate limit: in-process, health endpoints excluded

## Health

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | No |
| GET | `/api/v1/health` | No |

Response `200`: `{ "status": "ok" }`

## Auth — `/api/v1/auth`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | email, username, password, displayName |
| POST | `/api/v1/auth/login` | access + refresh tokens |
| POST | `/api/v1/auth/refresh` | rotate refresh token |
| POST | `/api/v1/auth/logout` | revoke session (`refreshToken`) |

## Users — `/api/v1/users`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/users/me` | current profile |
| PATCH | `/api/v1/users/me` | update profile |
| GET | `/api/v1/users/:id` | public profile |

## Search — `/api/v1/search` (Phase 7)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/search` | `?q=` aggregated across enabled providers, deduped by `canonical_key`, ranked. Metadata only — no playback URLs. |

## Tracks — `/api/v1/tracks`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/tracks/:id` | metadata + license summary (no audio URLs) |
| GET | `/api/v1/tracks/:id/sources` | source resolver; client fetches the provider URL |

## Artists / albums

Metadata pages. Responses include license and availability on each track reference. **No audio URLs.**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/artists/:id` | artist, albums, licensed track refs |
| GET | `/api/v1/artists/:id/albums` | album refs |
| GET | `/api/v1/artists/:id/tracks` | same track refs as the artist page |
| GET | `/api/v1/albums/:id` | album, credited artists, licensed track refs |
| GET | `/api/v1/albums/:id/tracks` | same track refs as the album page |

## Playlists — `/api/v1/playlists`

Playlists store **track references**, never audio.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/playlists` | auth |
| GET | `/api/v1/playlists` | owner list |
| GET | `/api/v1/playlists/:id` | private lists only for owner |
| PATCH | `/api/v1/playlists/:id` | owner |
| DELETE | `/api/v1/playlists/:id` | soft delete |
| POST | `/api/v1/playlists/:id/tracks` | append a track ref (idempotent) |
| PATCH | `/api/v1/playlists/:id/tracks` | reorder `{ trackIds }` |
| DELETE | `/api/v1/playlists/:id/tracks/:trackId` | remove a track ref |
| POST | `/api/v1/playlists/:id/share` | hashed token shown once; private becomes unlisted; `{ token, path }` — no audio |
| DELETE | `/api/v1/playlists/:id/shares` | owner revokes active tokens |
| POST | `/api/v1/playlists/:id/fork` | copy track refs to caller |
| GET | `/api/v1/playlists/shared/:token` | public metadata lookup; recipients resolve sources themselves |
| POST | `/api/v1/playlists/shared/:token/fork` | copy refs from a share token |

## Library — `/api/v1/library`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/library` | favorites, playlists, recents |
| GET | `/api/v1/library/favorites` | |
| PUT | `/api/v1/library/favorites/:trackId` | |
| DELETE | `/api/v1/library/favorites/:trackId` | |
| POST | `/api/v1/library/plays` | record play history for ranking |

## Downloads — `/api/v1/downloads`

Metadata only. The client downloads from the **provider URL**.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/downloads/:trackId/source` | permitted download URL + license |

## Providers — `/api/v1/providers`

Status and catalog **metadata** only. Sync never stores playback or download URLs.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/providers` | configured providers, capabilities, health, last check |
| GET | `/api/v1/providers/:slug/health` | operator; records a health check; disable after 3 consecutive failures |
| GET | `/api/v1/providers/:slug/sync-logs` | operator; recent metadata sync jobs |
| POST | `/api/v1/providers/:slug/sync` | operator; persist catalog metadata; 409 if disabled |
| POST | `/api/v1/providers/health-sweep` | operator; check all connectors; disable after 3 consecutive failures |

## Licenses — `/api/v1/licenses`

| Method | Path |
| --- | --- |
| GET | `/api/v1/licenses` |
| GET | `/api/v1/licenses/:id` |

## Discovery — `/api/v1/discovery`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/discovery/home` | ranked shelves (`recommended` / `trending` / `newOpenReleases`); optional Bearer for recents + For you |
| GET | `/api/v1/discovery/trending` | play-count ranking |
| GET | `/api/v1/discovery/genres` | |

## Reports — `/api/v1/reports`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/reports` | auth; takedown / abuse reports against an existing entity; reason is stored text, never fetched |

## Error codes

Envelope: `{ "error": { "code", "message", "requestId" } }`. OpenAPI at `/docs/json` is the schema source of truth.

| Code | Typical HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod / Fastify validation |
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer / operator token |
| `FORBIDDEN` | 403 | Operator token not configured; ACL |
| `NOT_FOUND` | 404 | Unknown route or resource |
| `CONFLICT` | 409 | Duplicate identity; disabled provider sync |
| `RATE_LIMITED` | 429 | In-process limiter |
| `INTERNAL_ERROR` | 500 | Unexpected failure (generic message in production) |

The API never returns media bodies. Do not add a route that streams audio or video through OpenTune.

## Versioning

- Current prefix: `/api/v1`
- Additive, non-breaking changes stay on v1
- Breaking changes (removed fields, auth, or meaning) require `/api/v2` and a CHANGELOG entry
- Deprecations are announced in CHANGELOG for at least one minor release before removal

## Production

- Terminate TLS in front of the API. PostgreSQL stays on a private network ([docs/DEPLOY.md](docs/DEPLOY.md))
- Empty `CORS_ORIGIN` disables CORS reflection in production (native Flutter does not need it)
- Operator header: `x-opentune-operator`
- Health probes: `GET /health` and `GET /api/v1/health` (excluded from rate limiting)
