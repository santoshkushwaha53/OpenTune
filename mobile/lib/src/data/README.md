# Data

Repository implementations: Dio API client, JSON download index, catalog cache, secure
storage. Downloads use a Dio transport from **provider URLs** (never the
OpenTune API). Offline mode reads the local index and skips further API calls.
`background_downloader` and Drift remain optional later.

**Audio files are fetched from original provider URLs, never through the
OpenTune API.** The API client is metadata-only.
