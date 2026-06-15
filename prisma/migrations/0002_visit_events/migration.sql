-- CreateTable
CREATE TABLE IF NOT EXISTS "visit_events" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "region" TEXT NOT NULL DEFAULT '',
    "device_type" TEXT NOT NULL DEFAULT '电脑端',
    "device_detail" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "os" TEXT NOT NULL DEFAULT '',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "ip_hash" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "visit_events_session_id_path_key" ON "visit_events"("session_id", "path");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visit_events_created_at_idx" ON "visit_events"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visit_events_path_created_at_idx" ON "visit_events"("path", "created_at");
