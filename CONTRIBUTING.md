# Contributing to OpenTune

Thank you for contributing. OpenTune is an open-source **metadata mediator** for legally available music. Please read this document before opening a pull request.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Non-negotiable product rules

1. Do not host, proxy, cache, store, transcode, or redistribute audio or video on OpenTune servers.
2. Do not scrape copyrighted catalogs or bypass DRM.
3. Do not download from providers that prohibit downloading.
4. Do not turn a streaming-only source into a downloadable file.
5. Store metadata, not media. Every track needs source and license information.
6. Prefer official APIs, public catalogs, or explicitly permitted endpoints. Scraping is never a default strategy.
7. Never commit secrets. Use environment variables.
8. Never accept arbitrary user-supplied URLs and fetch them from the backend (SSRF).

## Phase discipline

Work is sequenced in numbered phases (see [ARCHITECTURE.md](ARCHITECTURE.md)). Phases 1–20 are implemented in this repository. New work should stay scoped: one provider, one bug, or one UI flow per pull request.

- Do not add audio proxying, scraping, or DRM bypass.
- After a change: tests, static analysis, formatting, migration checks (when applicable), API checks, Flutter analyzer and tests, and documentation updates.

## Adding a music provider

Provider connectors belong under `backend/src/providers/` (interface in Phase 5). A connector must include:

- A unique identifier and display name
- Explicit capability flags (`supportsStreaming`, `supportsDownload`, `supportsOffline`, `supportsRedistribution`, `requiresAttribution`)
- License and attribution mapping
- `healthCheck`
- Tests (fixtures preferred over live network in CI)

Call `permittedDownloadSource()` rather than `getDownloadSource()` directly so stream-only providers cannot be turned into downloads.

A pull request that adds a provider **without** a legal API or written permission will be rejected.

## Pull requests

1. Fork and branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Keep the change scoped to one concern.
3. Run the relevant checks locally:

   ```bash
   cd backend && npm test && npm run lint && npm run format:check && npm run db:validate
   cd ../mobile && flutter analyze && flutter test
   ```

   Pixel goldens (macOS): `flutter test --update-goldens test/golden_test.dart`. Load tests: `cd backend && npm test -- test/load.test.ts`.

   If the backend schema changed, also run `npm run db:migrate:deploy` against a local Postgres and include the migration in the PR.

4. Update documentation when behavior or architecture changes.
5. Fill in the pull request template.

## Reporting bugs and proposing features

Use GitHub issues. Include reproduction steps, expected vs actual behavior, and whether the report involves a **provider license** question.

Security vulnerabilities: do not file a public issue. Follow [SECURITY.md](SECURITY.md).

Production deploy: [docs/DEPLOY.md](docs/DEPLOY.md). Releases: [docs/RELEASE.md](docs/RELEASE.md).
