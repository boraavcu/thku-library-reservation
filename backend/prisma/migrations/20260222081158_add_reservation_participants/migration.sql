/*
  Warnings:

  - You are about to drop the column `participant_count` on the `reservations` table. All the data in the column will be lost.
  - You are about to drop the column `participants` on the `reservations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "participant_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "participant_count",
DROP COLUMN "participants";

-- CreateTable
CREATE TABLE "reservation_participants" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "participant_status" NOT NULL DEFAULT 'PENDING',
    "joined_at" TIMESTAMP(6),

    CONSTRAINT "reservation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_participants_reservation_id_user_id_key" ON "reservation_participants"("reservation_id", "user_id");

-- AddForeignKey
ALTER TABLE "reservation_participants" ADD CONSTRAINT "reservation_participants_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_participants" ADD CONSTRAINT "reservation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
