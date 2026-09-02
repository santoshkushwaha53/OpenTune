# Release

OpenTune is a metadata mediator. Cut a release only when CI is green and the following remain true:

1. No audio/video is stored, proxied, or redistributed by the API.
2. Provider connectors use official APIs or written permission.
3. `CHANGELOG.md` describes the release.
4. Secrets are not in the git tree.
5. GitHub Release assets do **not** include catalog audio.

## Tag a version

```bash
git tag -a v0.1.0 -m "OpenTune 0.1.0"
git push origin v0.1.0
```

Pushing a `v*` tag runs [`.github/workflows/release.yml`](../.github/workflows/release.yml): it refuses audio files in git, builds the API image (no push, no media layer), and creates a GitHub Release whose notes come from the first section of `CHANGELOG.md` (`scripts/release_notes.py`).

Attach no catalog audio to the GitHub Release.

## Local stack

```bash
cp .env.example .env
docker compose up --build
```

PostgreSQL is published on `localhost:5432` for development. The API uses `NODE_ENV=development`. Flutter talks to `http://127.0.0.1:3000` (Android emulator: `http://10.0.2.2:3000`).

## Production

See [DEPLOY.md](DEPLOY.md). Use `docker compose -f docker-compose.prod.yml` — API + Postgres only, Postgres not published.
