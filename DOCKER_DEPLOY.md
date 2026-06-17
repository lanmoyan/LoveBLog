# Docker Compose Deployment

This project publishes a production image to GitHub Container Registry:

```text
ghcr.io/lanmoyan/loveblog:latest
```

The default `docker-compose.yml` runs from that image. Local builds use `docker-compose.build.yml` as an override.

## 1. Quick start

For a first deployment, `docker-compose.yml` alone is enough:

```bash
git clone https://github.com/lanmoyan/LoveBLog.git loveblog
cd loveblog
docker compose up -d
```

The app listens on port `3000` by default. PostgreSQL starts as a sibling service, migrations run automatically unless `RUN_MIGRATIONS=0`, and the app generates a persistent auth secret in the uploads volume when no secret is provided.

If your server terminal looks stuck while pulling the image, use the optional progress script:

```bash
bash deploy.sh
```

It shows a 0-100 deployment progress bar and asks Docker Compose to print plain pull progress for each image layer. Docker does not expose one perfectly accurate global download percentage, so the long `Pulling images` step may still depend on your server network speed.
The published app image uses a smaller Alpine-based runtime image to reduce first-pull bytes. For upgrades, prefer `bash deploy.sh` or `docker compose pull && docker compose up -d` so existing layers are reused.

For public production, you should still set your real domain and stronger passwords. You can either edit `docker-compose.yml` directly or create an optional `.env` file:

```bash
cp .env.docker.example .env
```

Recommended production values:

- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Set `POSTGRES_PASSWORD` before the first production start. If the PostgreSQL volume already exists, changing this value later does not automatically change the existing database password.

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

## 2. First start

```bash
docker compose up -d
```

The app listens on port `3000` by default. PostgreSQL starts as a sibling service and migrations run automatically unless `RUN_MIGRATIONS=0`.

If GHCR says the image is private, open the repository package page on GitHub and set package visibility to public, or log in on the server:

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## 3. Persistent data

Docker Compose stores PostgreSQL data in the `postgres-data` named volume and local uploads in the `uploads-data` named volume.

If you use S3 / Cloudflare R2, back up PostgreSQL and your object-storage bucket before upgrading or moving servers. If you use local uploads, back up both Docker volumes.

## 4. Useful commands

```bash
docker compose logs -f
docker compose ps
docker compose down
docker compose pull
docker compose up -d
docker image prune -f
```

## 5. Upgrade to the latest image

After new code is pushed to `main`, wait for the `Docker Image` GitHub Actions workflow to finish, then run on the server:

```bash
cd /path/to/your/deploy-folder
docker compose down
docker compose pull
docker compose up -d
docker compose logs -f love-next
```

For lower downtime, you can skip `down`:

```bash
docker compose pull
docker compose up -d
```

If you also changed `docker-compose.yml` or `.env.docker.example`, pull the latest repository files first:

```bash
git pull origin main
docker compose pull
docker compose up -d
```

Local build fallback:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```
