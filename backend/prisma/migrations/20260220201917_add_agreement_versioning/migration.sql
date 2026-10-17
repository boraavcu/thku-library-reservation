/*
  Warnings:

  - You are about to drop the column `has_accepted_rules` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "has_accepted_rules",
ADD COLUMN     "accepted_agreement_version" VARCHAR(20);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agreements_version_key" ON "agreements"("version");
