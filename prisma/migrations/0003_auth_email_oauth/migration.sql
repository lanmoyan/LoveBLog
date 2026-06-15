ALTER TABLE "users" ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "user_oauth_accounts" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_oauth_accounts_provider_provider_account_id_key" ON "user_oauth_accounts"("provider", "provider_account_id");
CREATE INDEX "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts"("user_id");

ALTER TABLE "user_oauth_accounts"
  ADD CONSTRAINT "user_oauth_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_verification_codes" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'register',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_codes_email_purpose_created_at_idx" ON "email_verification_codes"("email", "purpose", "created_at");
CREATE INDEX "email_verification_codes_expires_at_idx" ON "email_verification_codes"("expires_at");
