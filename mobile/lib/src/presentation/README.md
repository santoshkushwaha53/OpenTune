# Presentation

UI: widgets, pages, theming, routing.

Phase 1: empty. Phase 8 introduces the design system, GoRouter shell
(Home / Discover / Library), and a mini-player that opens the now-playing
screen (queue, seek, license sheet). Audio is loaded from provider URLs.

New accounts are routed through personalization (`/onboarding`) before Home.
Returning users with `onboardingCompleted` skip it. Starter-pack files are
fetched on-device from provider download URLs. Home is a cinematic landing
screen (hero + shelves), not an offline-status dashboard. Discover is a visual
scene browser (songs, singers, year) over open catalogs.

This layer depends on the **application** layer only. It must not import
provider SDKs or call music-host APIs directly.
