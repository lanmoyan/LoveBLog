ALTER TABLE "users" ADD COLUMN "role_key" TEXT NOT NULL DEFAULT 'user';

UPDATE "users"
SET "role_key" = 'admin'
WHERE "id" = (
  SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1
);
