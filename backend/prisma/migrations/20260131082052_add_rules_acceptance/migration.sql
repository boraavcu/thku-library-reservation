-- AlterTable
ALTER TABLE "users" ADD COLUMN     "has_accepted_rules" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "image" SET DATA TYPE TEXT,
ALTER COLUMN "avatar_url" SET DATA TYPE TEXT;
