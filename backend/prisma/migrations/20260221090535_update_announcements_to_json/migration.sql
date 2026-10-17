/*
  Warnings:

  - Changed the type of `title` on the `announcements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `content` on the `announcements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "announcements" DROP COLUMN "title",
ADD COLUMN     "title" JSONB NOT NULL,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL;
