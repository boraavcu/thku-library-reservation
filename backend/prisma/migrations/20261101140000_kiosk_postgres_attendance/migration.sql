-- CreateEnum
CREATE TYPE "kiosk_lock_type" AS ENUM ('DEVICE', 'HARDWARE', 'IP_UA');

-- CreateTable
CREATE TABLE "kiosk_check_in_codes" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "consumed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiosk_check_in_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_device_locks" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "lock_type" "kiosk_lock_type" NOT NULL,
    "lock_key" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "kiosk_device_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_attendances" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "checked_in_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiosk_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_check_in_codes_reservation_id_user_id_key" ON "kiosk_check_in_codes"("reservation_id", "user_id");

-- CreateIndex
CREATE INDEX "kiosk_check_in_codes_expires_at_idx" ON "kiosk_check_in_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_device_locks_reservation_id_lock_type_lock_key_key" ON "kiosk_device_locks"("reservation_id", "lock_type", "lock_key");

-- CreateIndex
CREATE INDEX "kiosk_device_locks_reservation_id_expires_at_idx" ON "kiosk_device_locks"("reservation_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_attendances_reservation_id_user_id_key" ON "kiosk_attendances"("reservation_id", "user_id");

-- CreateIndex
CREATE INDEX "kiosk_attendances_reservation_id_idx" ON "kiosk_attendances"("reservation_id");

-- AddForeignKey
ALTER TABLE "kiosk_check_in_codes" ADD CONSTRAINT "kiosk_check_in_codes_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_check_in_codes" ADD CONSTRAINT "kiosk_check_in_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_device_locks" ADD CONSTRAINT "kiosk_device_locks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_device_locks" ADD CONSTRAINT "kiosk_device_locks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_attendances" ADD CONSTRAINT "kiosk_attendances_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_attendances" ADD CONSTRAINT "kiosk_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
