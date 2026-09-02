# Audius connector

Official [Audius API](https://docs.audius.co/api) only (`https://api.audius.co/v1`). No HTML scraping.

Set `AUDIUS_API_KEY` to enable the provider. Without it, the connector stays registered but disabled.

The connector:

- Searches `/v1/tracks/search` with `only_downloadable=true`
- Maps Attribution / ShareAlike / CC0; drops All Rights Reserved, NC, and ND
- Returns stream/download **URL templates** on `api.audius.co` (the device follows redirects)
- Sets `supportsDownload` only when `is_downloadable` is true
- Never uses a stream URL as a download
- Never fetches audio or video bytes

CI uses recorded JSON fixtures. Do not put live API secrets in tests.
