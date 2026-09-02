# Production deployment

OpenTune in production is **API + PostgreSQL**. There is no audio/video bucket, CDN for tracks, transcoding service, or Redis requirement.

```
Internet → TLS (Render) → Fastify API
                              ↓
                         Neon PostgreSQL (metadata only)
```

Flutter talks to the public API hostname for metadata, then streams or downloads from **provider URLs** on the device.

## Hosted (Render + Neon)

The API is meant to run on **Render** (Singapore). PostgreSQL is a dedicated `opentune` database on the existing Neon project that also holds `pulseai` (endpoint `ep-blue-cake-aolo8q76`, ap-southeast-1). Do not add a Render Postgres instance or an object-storage disk.

```bash
# After the GitHub repo exists:
# Dashboard → New → Blueprint, or:
render services create --name opentune-api --type web_service \
  --repo https://github.com/santoshkushwaha53/OpenTune \
  --runtime docker --root-directory backend --region singapore --plan free
```

Set `DATABASE_URL` to the Neon `opentune` connection string (`sslmode=require`). The container runs `prisma migrate deploy` on boot. Health: `GET /health`.

## Self-host checklist

1. Copy [`.env.production.example`](../.env.production.example) to `.env` on the host.
2. Set `POSTGRES_PASSWORD` (`openssl rand -hex 24`), `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` (`openssl rand -hex 32` twice). Use hex so the database URL does not need encoding. Secrets must differ and must not match documented placeholders.
3. Optional: `AUDIUS_API_KEY`, `JAMENDO_CLIENT_ID`, `OPERATOR_TOKEN`, `CORS_ORIGIN`.
4. Start the stack:

   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

5. Confirm `GET /health` returns `{ "status": "ok" }`.
6. Put the API behind TLS (Caddy, nginx, or a cloud load balancer). Do **not** publish PostgreSQL (`5432` is not mapped in the production compose file).
7. Point the Flutter app at `https://your-api.example` (not `127.0.0.1`).

Migrations run on API boot (`prisma migrate deploy`). Seed licenses/providers separately if this is a new database:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

## What not to deploy

- Object storage for music
- ffmpeg / transcoding sidecars
- An API route that fetches audio bytes
- A public Postgres port

Local development still uses [`docker-compose.yml`](../docker-compose.yml) (Postgres on `localhost:5432`, `NODE_ENV=development`).

## Secrets

Production env validation refuses short, identical, or placeholder JWT secrets. Rotate any secret that was committed or logged. See [SECURITY.md](../SECURITY.md).

## Scaling

Rate limiting is in-process. A single API replica is the supported production shape. Multiple replicas need a shared limiter (Redis) before you horizontally scale — that is optional later work, not part of this release.

## Releases

Tag and GitHub Release: [RELEASE.md](RELEASE.md).


1. Copy [`.env.production.example`](../.env.production.example) to `.env` on the host.
2. Set `POSTGRES_PASSWORD` (`openssl rand -hex 24`), `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` (`openssl rand -hex 32` twice). Use hex so the database URL does not need encoding. Secrets must differ and must not match documented placeholders.
3. Optional: `AUDIUS_API_KEY`, `JAMENDO_CLIENT_ID`, `OPERATOR_TOKEN`, `CORS_ORIGIN`.
4. Start the stack:

   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

5. Confirm `GET /health` returns `{ "status": "ok" }`.
6. Put the API behind TLS (Caddy, nginx, or a cloud load balancer). Do **not** publish PostgreSQL (`5432` is not mapped in the production compose file).
7. Point the Flutter app at `https://your-api.example` (not `127.0.0.1`).

Migrations run on API boot (`prisma migrate deploy`). Seed licenses/providers separately if this is a new database:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

## What not to deploy

- Object storage for music
- ffmpeg / transcoding sidecars
- An API route that fetches audio bytes
- A public Postgres port

Local development still uses [`docker-compose.yml`](../docker-compose.yml) (Postgres on `localhost:5432`, `NODE_ENV=development`).

## Secrets

Production env validation refuses short, identical, or placeholder JWT secrets. Rotate any secret that was committed or logged. See [SECURITY.md](../SECURITY.md).

## Scaling

Rate limiting is in-process. A single API replica is the supported production shape. Multiple replicas need a shared limiter (Redis) before you horizontally scale — that is optional later work, not part of this release.

## Releases

Tag and GitHub Release: [RELEASE.md](RELEASE.md).
