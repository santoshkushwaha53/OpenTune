# Jamendo connector

Official [Jamendo API v3.0](https://developer.jamendo.com/v3.0) only. No HTML scraping.

Set `JAMENDO_CLIENT_ID` to enable the provider in PostgreSQL. Without it, the connector stays registered but disabled.

The connector:

- Searches `/tracks` with `include=licenses`
- Scene chips query one Jamendo tag at a time (india, sitar, raga, …) so a broad `world` tag cannot crowd out Indian results
- Maps CC0, CC BY, and CC BY-SA; drops BY-NC, BY-ND, and sampling licenses
- Returns playback/download **URLs** on allowlisted Jamendo hosts
- Sets `supportsDownload` only when `audiodownload_allowed` is true **and** the download URL is allowlisted
- Never uses the streaming `audio` field as a download
- Never fetches audio or video bytes

CI uses recorded JSON fixtures (`backend/test/fixtures/jamendo-tracks.json`). Do not put live API secrets in tests.
