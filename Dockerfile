FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_CPUS=1
ENV SKIP_BUILD_TYPECHECK=1
ENV NODE_OPTIONS=--max-old-space-size=384
RUN apk add --no-cache ca-certificates openssl

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate
RUN npm run typecheck
RUN npm run build:next
RUN npm run clean:generated

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=384
RUN apk add --no-cache ca-certificates openssl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/scripts/prepare-db.mjs ./scripts/prepare-db.mjs
COPY --from=builder /app/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
COPY --from=builder /app/scripts/docker-start.mjs ./scripts/docker-start.mjs

EXPOSE 3000

CMD ["node", "scripts/docker-start.mjs"]
