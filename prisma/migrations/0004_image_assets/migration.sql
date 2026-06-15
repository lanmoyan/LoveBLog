-- CreateTable
CREATE TABLE "image_assets" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT '',
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "exif_meta" TEXT NOT NULL DEFAULT '{}',
    "variants" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_path_key" ON "image_assets"("path");

-- CreateIndex
CREATE INDEX "image_assets_updated_at_idx" ON "image_assets"("updated_at");
