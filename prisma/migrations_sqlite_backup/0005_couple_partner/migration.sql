PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "avatar_image" TEXT NOT NULL DEFAULT '',
    "partner_id" INTEGER,
    "role_key" TEXT NOT NULL DEFAULT 'user',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_users" ("id", "username", "password_hash", "display_name", "avatar", "avatar_image", "role_key", "created_at")
SELECT "id", "username", "password_hash", "display_name", "avatar", "avatar_image", "role_key", "created_at"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_partner_id_key" ON "users"("partner_id");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
