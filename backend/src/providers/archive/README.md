# Internet Archive connector

Official [Internet Archive search](https://archive.org/developers/search.html) and [metadata](https://archive.org/developers/md-read.html) JSON APIs only (`https://archive.org/advancedsearch.php`, `https://archive.org/metadata/{id}`). No HTML scraping.

The connector:

- Searches `mediatype:audio` items that declare a Creative Commons BY / BY-SA or public-domain / CC0 `licenseurl`
- Expands scene queries such as Bollywood into extra licensed-catalog terms (hindi, sitar, raga, …) in **one** search request
- Drops NC, ND, missing licenses, and access-restricted items
- Maps metadata JSON only; playback/download URLs are `https://archive.org/download/{id}/{file}` on the device
- Never fetches audio or video bytes
- Never treats the whole Archive as licensed — most IA audio is **not** included

Set `INTERNET_ARCHIVE_ENABLED=false` to disable. Default is enabled (no API key).

CI uses recorded JSON fixtures. Do not put live secrets in tests.
