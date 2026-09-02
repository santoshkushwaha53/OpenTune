# OpenTune

Open-source music discovery and offline listening for **legally available** open and licensed music.

OpenTune is a **metadata mediator**. It does not host, proxy, cache, store, transcode, or redistribute audio or video. The Flutter app resolves a permitted source through the API, then streams or downloads audio **directly from the original provider** to the user’s device.

```
User → Flutter app → Node.js API → PostgreSQL metadata
                 ↘ provider audio URL → user device
```

## What this project will not do

- Scrape copyrighted catalogs
- Bypass DRM
- Convert streaming-only sources into downloadable files
- Download from providers that prohibit downloading
- Store audio or video on OpenTune servers
- Tightly couple the app to a single music provider

Every track must carry **source** and **license** information. Attribution requirements are first-class, not an afterthought.

## Status

**Phase 20 — Production deployment and open-source release.** API + PostgreSQL only (no audio bucket). Production compose, secret checks, GitHub Release workflow, and complete SECURITY/API docs.

See [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [docs/DEPLOY.md](docs/DEPLOY.md), [docs/RELEASE.md](docs/RELEASE.md), and [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Stack

| Layer | Choice |
| --- | --- |
| App | Flutter, Dart, clean architecture |
| State / nav / HTTP | Riverpod, GoRouter, Dio |
| Local data | JSON cache + download index, flutter_secure_storage |
| Playback / downloads | just_audio + audio_session; Dio downloads provider URLs to device storage |
| API | Node.js, TypeScript, Fastify |
| Database | PostgreSQL 16 + Prisma |
| Auth | JWT access tokens + rotating refresh sessions |
| First provider | Jamendo official API |

## Repository layout

```
backend/     Fastify TypeScript API
mobile/       Flutter application
docs live at the repository root (ARCHITECTURE.md, API.md, …)
```

## Local development

### Prerequisites

- Node.js 20+
- Flutter (stable) with iOS and/or Android toolchains
- PostgreSQL 16+ (Docker Compose or local)

### 1. Environment

```bash
cp .env.example .env
```

### 2. PostgreSQL (and optional API container)

```bash
docker compose up -d postgres
```

`docker compose up --build` also starts the API image. For day-to-day API work, run Node on the host as below.

### 3. API

```bash
cd backend
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Health:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/api/v1/health`

OpenAPI:

- UI: `http://localhost:3000/docs`
- JSON: `http://localhost:3000/docs/json`

```bash
npm test
npm run lint
npm run format
npm run db:validate
```

### 4. Flutter app

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

Music obtained through OpenTune remains under **each track’s own license** (for example Creative Commons). The application license is not a music license.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request. Security reports: [SECURITY.md](SECURITY.md). Production: [docs/DEPLOY.md](docs/DEPLOY.md). Releases: [docs/RELEASE.md](docs/RELEASE.md).
