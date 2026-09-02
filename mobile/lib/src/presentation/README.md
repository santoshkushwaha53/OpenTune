# Presentation

UI: widgets, pages, theming, routing.

Phase 1: empty. Phase 8 introduces the design system, GoRouter shell
(Home / Discover / Library), and a mini-player that opens the now-playing
screen (queue, seek, license sheet). Audio is loaded from provider URLs.

This layer depends on the **application** layer only. It must not import
provider SDKs or call music-host APIs directly.
