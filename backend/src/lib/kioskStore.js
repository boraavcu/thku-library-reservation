import crypto from "crypto";
import prisma from "./db.js";
import {
  consumeCheckIn,
  issuePersonalCode,
  getActiveLockOwners,
  listAttendanceUserIds,
} from "./kioskSql.mjs";

export {
  CODE_TTL_SECONDS,
  DEVICE_LOCK_SECONDS,
  buildPenaltyTargets,
  claimNoShowCancellation,
  claimPenaltyApplied,
  listAttendanceUserIds,
} from "./kioskSql.mjs";

export function createPrismaDb(client) {
  return {
    async query(sql, params = []) {
      return client.$queryRawUnsafe(sql, ...params);
    },
  };
}

export async function readKioskPresence(reservationId, { deviceKey, hardwareKey, ipUaKey }) {
  const db = createPrismaDb(prisma);
  const [owners, checkedUserIds] = await Promise.all([
    getActiveLockOwners(db, { reservationId, deviceKey, hardwareKey, ipUaKey }),
    listAttendanceUserIds(db, reservationId),
  ]);
  return { owners, checkedUserIds };
}

export async function issuePersonalCodeForReservation(reservationId, userId) {
  return prisma.$transaction(async (tx) => {
    return issuePersonalCode(createPrismaDb(tx), {
      reservationId,
      userId,
      newCode: crypto.randomBytes(16).toString("hex"),
    });
  });
}

export async function performCheckIn({
  reservationId,
  userId,
  code,
  locks,
  minParticipants,
  onRecorded,
}) {
  let result = {
    ok: false,
    reason: "reservation_missing",
    checkedUserIds: [],
    recorded: false,
    transitioned: false,
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      const outcome = await consumeCheckIn(createPrismaDb(tx), {
        reservationId,
        userId,
        code,
        locks,
        minParticipants,
      });

      if (outcome.recorded && onRecorded) {
        await onRecorded(tx, outcome);
      }

      return outcome;
    });
  } catch (error) {
    if (error?.message === "DEVICE_LOCK_LOST") {
      return {
        ok: false,
        reason: "device_conflict",
        checkedUserIds: [],
        recorded: false,
        transitioned: false,
      };
    }
    throw error;
  }

  return result;
}
