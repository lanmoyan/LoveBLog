# Docker Compose Deployment

This folder is ready to copy to a server and run with Docker Compose.

## 1. Prepare environment

Copy the example env file:

```bash
cp .env.docker.example .env
```

Edit `.env` and set:

- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

By default uploads are stored in the Docker `uploads-data` volume with `STORAGE_DRIVER=local`.
To use S3 / Cloudflare R2 instead, set `STORAGE_DRIVER=s3` and fill `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL`.

Large uploaded images are compressed in the browser before upload, and local images support generated WebP variants through `/api/uploads/...?...`.
For production with many photos, the recommended path is S3 / Cloudflare R2 compatible object storage plus CDN. OpenList can be used as an external public-file source if it exposes stable CDN URLs, but it is not the preferred primary upload backend for this app unless you add a dedicated storage driver.

Optional email registration verification can be configured either in the admin panel or through env vars:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Optional third-party login providers can also be configured in the admin panel or through env vars:

- GitHub: `OAUTH_GITHUB_ID`, `OAUTH_GITHUB_SECRET`
- Google: `OAUTH_GOOGLE_ID`, `OAUTH_GOOGLE_SECRET`
- Discord: `OAUTH_DISCORD_ID`, `OAUTH_DISCORD_SECRET`

Provider callback URLs:

- GitHub: `https://your-domain.example/api/auth/callback/github`
- Google: `https://your-domain.example/api/auth/callback/google`
- Discord: `https://your-domain.example/api/auth/callback/discord`

QQ and WeChat entries are reserved in the admin UI. They need platform approval and a provider-specific adapter before they can be enabled in production.

Keep auth secrets stable after deployment, otherwise existing login sessions become invalid.

## 2. Start

```bash
docker compose up -d --build
```

The app listens on port `3000` by default. PostgreSQL starts as a sibling service and migrations run automatically unless `RUN_MIGRATIONS=0`.

## 3. Persistent data

Docker Compose stores PostgreSQL data in the `postgres-data` named volume and local uploads in the `uploads-data` named volume.

If you use S3 / Cloudflare R2, back up PostgreSQL and your object-storage bucket before upgrading or moving servers. If you use local uploads, back up both Docker volumes.

## 4. Useful commands

```bash
docker compose logs -f
docker compose ps
docker compose down
docker compose up -d --build
```
