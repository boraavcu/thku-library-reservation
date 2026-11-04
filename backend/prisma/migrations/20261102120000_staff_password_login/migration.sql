-- Mevcut satırlar silinmez. Yeni kolonlar varsayılan değerle eklenir.
ALTER TABLE "users"
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "temp_password_expires_at" TIMESTAMP(6),
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "auth_rate_limits" (
  "id" UUID NOT NULL,
  "bucket" VARCHAR(128) NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "window_start" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_rate_limits_bucket_key" ON "auth_rate_limits"("bucket");

-- PostgreSQL 12+ bu eklemeyi transaction içinde kabul eder.
-- Yeni değerler bu dosyada kullanılmaz; mevcut kayıtlar değişmez.
ALTER TYPE "admin_action_type" ADD VALUE 'USER_ACCOUNT_CREATED';
ALTER TYPE "admin_action_type" ADD VALUE 'TEMP_PASSWORD_RESET';
