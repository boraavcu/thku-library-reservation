/*
  Warnings:

  - You are about to drop the column `amenities` on the `rooms` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `rooms` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `rooms` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `rooms` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "rooms" DROP COLUMN "amenities",
DROP COLUMN "description",
DROP COLUMN "floor",
DROP COLUMN "image_url";
