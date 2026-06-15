# Love Next

这是一个 Next.js + TypeScript + Prisma 的情侣博客与私密生活记录站点。

## 技术栈

- Next.js App Router
- React + TypeScript
- Prisma + PostgreSQL
- NextAuth Credentials
- Tailwind CSS
- Zod
- S3 / Cloudflare R2 对象存储
- Docker Compose

## 页面路由

- `/` 首页
- `/essay/` 动态
- `/stories/` 爱情博客
- `/timeline/` 时光
- `/album/` 相册
- `/wishlist/` 心愿
- `/secret/` 悄悄话
- `/settings/` 设置

## 已有能力

- NextAuth 登录、退出、个人昵称、表情头像、上传头像和 URL 头像
- 动态发布、图片拖拽上传、图片 URL、视频和点赞
- 爱情博客：长文故事、封面、标签、置顶、草稿、公开/私密可见性
- 后台自定义表情包 JSON，支持外链图片表情
- 时光碎片瀑布流、图片查看器、EXIF 自动识别与手动刷新
- 首页相册轮播、拖拽上传、URL 图片和删除
- 心愿便利贴、随机/自定义样式、日期时间标注
- 悄悄话私密便签
- 访问计数、站点标题、在一起日期等基础信息配置
- 旧版 SQLite 数据和 uploads 文件迁移脚本
- 后台普通用户只管理自己的内容，管理员进入全站数据栏目管理所有用户内容

## 本地运行

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:migrate
npm run seed
npm run dev
```

如果本机没有 Docker，但已经有 PostgreSQL 服务，可以直接修改 `.env` 里的 `DATABASE_URL`，确保数据库名、用户名和密码对应本机配置，然后运行：

```bash
npm install
npm run db:migrate
npm run seed
npm run dev
```

默认 seed 只会写入站点基础配置；如果希望在空库里创建演示账号，可以临时设置 `SEED_DEFAULT_USERS=1` 后再运行 `npm run seed`。

导入旧版数据：

```bash
npm run import:old
npm run seed
```

`import:old` 会读取上一级旧项目的 `data/love.db`，并复制旧项目 `uploads` 到 `love-next/uploads`。它会重置 PostgreSQL 目标库后再导入旧数据，并同步自增序列。

访问：

```text
http://localhost:3000
```

## 生产部署

生产环境必须配置 `AUTH_SECRET`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`DATABASE_URL`。公网部署建议配置 `STORAGE_DRIVER=s3`，并填写 S3 / Cloudflare R2 兼容参数。

项目启用了 `output: standalone`，生产启动命令为：

```bash
npm run build
npm run start
```

## Docker 运行

```bash
docker compose up -d --build
```

默认数据挂载：

- `postgres-data` Docker volume 保存 PostgreSQL 数据
- 上传文件默认进入 S3 / Cloudflare R2
