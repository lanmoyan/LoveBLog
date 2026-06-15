-- CreateIndex
CREATE INDEX "posts_created_at_id_idx" ON "posts"("created_at", "id");

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_mood_idx" ON "posts"("mood");

-- CreateIndex
CREATE INDEX "post_images_post_id_sort_idx" ON "post_images"("post_id", "sort");

-- CreateIndex
CREATE INDEX "likes_user_id_created_at_idx" ON "likes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_user_id_created_at_idx" ON "comments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_created_at_id_idx" ON "messages"("created_at", "id");

-- CreateIndex
CREATE INDEX "messages_user_id_created_at_idx" ON "messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wishlist_done_created_at_id_idx" ON "wishlist"("done", "created_at", "id");

-- CreateIndex
CREATE INDEX "wishlist_display_at_idx" ON "wishlist"("display_at");

-- CreateIndex
CREATE INDEX "events_date_id_idx" ON "events"("date", "id");

-- CreateIndex
CREATE INDEX "blog_posts_visibility_published_at_idx" ON "blog_posts"("visibility", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_created_at_idx" ON "blog_posts"("author_id", "created_at");
