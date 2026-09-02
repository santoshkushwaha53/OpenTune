# Security (Phase 18)

The API never fetches a caller-supplied URL. Provider hosts are allowlisted (`url-allowlist.ts`): https only, no credentials, no IP literals, port 443.

Jamendo metadata `fetch` uses `redirect: "error"` so a 3xx cannot hop off the allowlist. Playback/download URLs are sanitized again in the source resolver before they reach the client. The API still does not download audio bytes.

Operator routes (`POST /providers/:slug/sync`, health-sweep, recorded health checks, sync logs) require `x-opentune-operator` matching `OPERATOR_TOKEN`. Catalog source listing stays public metadata.

Share tokens are 32-byte `base64url` values stored hashed. Playlist UUID lookup is owner-only for private and unlisted lists; recipients use the share path.
