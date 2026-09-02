# Free Music Archive (disabled)

FMA is **priority 4** in the Sohum source router but is not a live catalog.

[FMA’s developer policy](https://freemusicarchive.org/app-developers) states that:

- The public API was shut down
- Hotlinking FMA-hosted audio is not allowed
- Forwarding user search queries and scraping HTML is not allowed without explicit approval

OpenTune therefore does not call FMA. The connector always returns empty results and a failed health check. Do not scrape `freemusicarchive.org` and do not host FMA audio on OpenTune servers.
