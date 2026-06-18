# Docker Compose 部署

LoveBLog 可以只用一个 `docker-compose.yml` 启动。国内服务器默认优先走镜像代理：

```text
ghcr.nju.edu.cn/lanmoyan/loveblog:latest
docker.m.daocloud.io/library/postgres:16-alpine
```

直连 GHCR / Docker Hub 可能很慢。更推荐把同一个镜像同步到阿里云、腾讯云、Docker Hub 等离服务器更近的镜像仓库，然后在 `.env` 里把 `APP_IMAGE` 改成你的镜像地址。

## 初次启动

```bash
git clone https://github.com/lanmoyan/LoveBLog.git loveblog
cd loveblog
cp .env.docker.example .env
docker compose up -d
```

老版本 Docker Compose 使用：

```bash
docker-compose up -d
```

站点默认监听 `3000` 端口。PostgreSQL 数据保存在 `postgres-data` 卷里，本地上传文件保存在 `uploads-data` 卷里。

## 必填配置

初次启动前建议先改 `.env`：

```env
POSTGRES_PASSWORD=replace-with-a-strong-postgres-password
AUTH_SECRET=replace-with-a-long-random-secret-at-least-32-chars
NEXTAUTH_SECRET=replace-with-the-same-long-random-secret
NEXTAUTH_URL=https://your-domain.example
POSTGRES_IMAGE=docker.m.daocloud.io/library/postgres:16-alpine
APP_IMAGE=ghcr.nju.edu.cn/lanmoyan/loveblog:latest
APP_PULL_POLICY=missing
```

`AUTH_SECRET` / `NEXTAUTH_SECRET` 部署后要保持稳定，否则已有登录状态会失效。`POSTGRES_PASSWORD` 也要在第一次启动前设置好；数据库卷创建后再改环境变量，不会自动修改已存在的数据库密码。

`APP_PULL_POLICY=missing` 表示本地没有镜像时才拉取，日常 `docker compose up -d` 会快很多。如果你想每次 `up -d` 都检查最新镜像，可以临时改成 `always`，但国内服务器会明显变慢。

如果镜像代理临时不可用，把 `.env` 改回源站即可：

```env
POSTGRES_IMAGE=postgres:16-alpine
APP_IMAGE=ghcr.io/lanmoyan/loveblog:latest
```

## 更新到最新版

推荐显式拉取再重启：

```bash
cd /path/to/loveblog
git pull origin main
docker compose pull
docker compose up -d
```

如果你使用的是老命令：

```bash
docker-compose pull
docker-compose up -d
```

## 加速拉取

### 方案 A：国内镜像仓库

在阿里云容器镜像服务创建仓库后，到 GitHub 仓库配置变量：

- `ALIYUN_REGISTRY`：例如 `registry.cn-hangzhou.aliyuncs.com`
- `ALIYUN_IMAGE`：例如 `registry.cn-hangzhou.aliyuncs.com/your-namespace/loveblog`

再配置密钥：

- `ALIYUN_REGISTRY_USERNAME`
- `ALIYUN_REGISTRY_PASSWORD`

之后推送到 `main` 时，GitHub Actions 会同时发布 GHCR 和阿里云镜像。服务器 `.env` 改成：

```env
APP_IMAGE=registry.cn-hangzhou.aliyuncs.com/your-namespace/loveblog:latest
APP_PULL_POLICY=missing
```

### 方案 B：服务器本地构建

如果 GHCR 仍然很慢，并且服务器上有完整源码，可以直接本地构建：

```bash
git pull origin main
NPM_REGISTRY=https://registry.npmmirror.com docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

第一次仍然需要拉 Docker 基础镜像和 npm 包，后续会复用 Docker 缓存。

## 存储

默认上传文件使用 Docker 本地卷：

```env
STORAGE_DRIVER=local
UPLOAD_DIR=/app/uploads
```

图片较多时建议使用 S3 / Cloudflare R2 加 CDN：

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_URL=
```

升级或迁移服务器前，记得备份 PostgreSQL 和上传文件/对象存储。

## 常用命令

```bash
docker compose ps
docker compose logs -f love-next
docker compose pull
docker compose up -d
docker image prune -f
```
