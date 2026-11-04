import crypto from "crypto";

export const CODE_TTL_SECONDS = 600;
export const DEVICE_LOCK_SECONDS = 14400;

function rowsOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function queryRows(db, sql, params) {
  return rowsOf(await db.query(sql, params));
}

export function buildPenaltyTargets({
  checkedUserIds,
  memberIds,
  status,
  minRequired,
  penaltyApplied,
}) {
  if (penaltyApplied) {
    return { action: "skip", penalizeUserIds: [] };
  }

  const checked = new Set(checkedUserIds);
  const absent = memberIds.filter((id) => !checked.has(id));
  const minimum = Math.max(2, Number(minRequired) || 2);

  if (checkedUserIds.length < minimum && status !== "CHECKED_IN") {
    return { action: "cancel_no_show", penalizeUserIds: absent };
  }

  if (checkedUserIds.length >= minimum && absent.length > 0) {
    return { action: "penalize_absent", penalizeUserIds: absent };
  }

  return { action: "none", penalizeUserIds: [] };
}

export async function listAttendanceUserIds(db, reservationId) {
  const rows = await queryRows(
    db,
    `SELECT user_id::text AS user_id
     FROM kiosk_attendances
     WHERE reservation_id = $1::uuid`,
    [reservationId]
  );
  return rows.map((row) => row.user_id);
}

export async function getActiveLockOwners(db, { reservationId, deviceKey, hardwareKey, ipUaKey }) {
  const rows = await queryRows(
    db,
    `SELECT lock_type::text AS lock_type, user_id::text AS user_id
     FROM kiosk_device_locks
     WHERE reservation_id = $1::uuid
       AND expires_at > NOW()
       AND (
         ($2 <> '' AND lock_type = 'DEVICE'::"kiosk_lock_type" AND lock_key = $2)
         OR ($3 <> '' AND lock_type = 'HARDWARE'::"kiosk_lock_type" AND lock_key = $3)
         OR ($4 <> '' AND lock_type = 'IP_UA'::"kiosk_lock_type" AND lock_key = $4)
       )`,
    [reservationId, deviceKey || "", hardwareKey || "", ipUaKey || ""]
  );

  const owners = { DEVICE: null, HARDWARE: null, IP_UA: null };
  for (const row of rows) {
    owners[row.lock_type] = row.user_id;
  }
  return owners;
}

export async function issuePersonalCode(db, { reservationId, userId, newCode }) {
  await queryRows(
    db,
    `SELECT id FROM reservations WHERE id = $1::uuid FOR UPDATE`,
    [reservationId]
  );

  const attended = await queryRows(
    db,
    `SELECT id FROM kiosk_attendances
     WHERE reservation_id = $1::uuid AND user_id = $2::uuid`,
    [reservationId, userId]
  );
  if (attended.length > 0) {
    return { alreadyCheckedIn: true, code: null };
  }

  const active = await queryRows(
    db,
    `SELECT code
     FROM kiosk_check_in_codes
     WHERE reservation_id = $1::uuid
       AND user_id = $2::uuid
       AND consumed_at IS NULL
       AND expires_at > NOW()`,
    [reservationId, userId]
  );
  if (active.length > 0) {
    return { alreadyCheckedIn: false, code: active[0].code };
  }

  const codeId = crypto.randomUUID();
  const inserted = await queryRows(
    db,
    `INSERT INTO kiosk_check_in_codes
       (id, reservation_id, user_id, code, expires_at, consumed_at, created_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW() + ($5::int * INTERVAL '1 second'), NULL, NOW())
     ON CONFLICT (reservation_id, user_id)
     DO UPDATE SET
       code = EXCLUDED.code,
       expires_at = EXCLUDED.expires_at,
       consumed_at = NULL,
       created_at = NOW()
     WHERE kiosk_check_in_codes.consumed_at IS NOT NULL
        OR kiosk_check_in_codes.expires_at <= NOW()
     RETURNING code`,
    [codeId, reservationId, userId, newCode, CODE_TTL_SECONDS]
  );

  if (inserted.length > 0) {
    return { alreadyCheckedIn: false, code: inserted[0].code };
  }

  const again = await queryRows(
    db,
    `SELECT code
     FROM kiosk_check_in_codes
     WHERE reservation_id = $1::uuid
       AND user_id = $2::uuid
       AND consumed_at IS NULL
       AND expires_at > NOW()`,
    [reservationId, userId]
  );
  return { alreadyCheckedIn: false, code: again[0]?.code ?? null };
}

async function acquireLock(db, { reservationId, lockType, lockKey, userId }) {
  const lockId = crypto.randomUUID();
  const claimed = await queryRows(
    db,
    `INSERT INTO kiosk_device_locks
       (id, reservation_id, lock_type, lock_key, user_id, expires_at, created_at, updated_at)
     VALUES (
       $1::uuid,
       $2::uuid,
       $3::"kiosk_lock_type",
       $4,
       $5::uuid,
       NOW() + ($6::int * INTERVAL '1 second'),
       NOW(),
       NOW()
     )
     ON CONFLICT (reservation_id, lock_type, lock_key)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     WHERE kiosk_device_locks.user_id = EXCLUDED.user_id
        OR kiosk_device_locks.expires_at <= NOW()
     RETURNING user_id::text AS user_id`,
    [lockId, reservationId, lockType, lockKey, userId, DEVICE_LOCK_SECONDS]
  );

  if (claimed.length > 0 && claimed[0].user_id === userId) {
    return true;
  }

  const current = await queryRows(
    db,
    `SELECT user_id::text AS user_id
     FROM kiosk_device_locks
     WHERE reservation_id = $1::uuid
       AND lock_type = $2::"kiosk_lock_type"
       AND lock_key = $3
       AND expires_at > NOW()`,
    [reservationId, lockType, lockKey]
  );
  return current.length > 0 && current[0].user_id === userId;
}

export async function consumeCheckIn(db, {
  reservationId,
  userId,
  code,
  locks,
  minParticipants,
}) {
  const lockedRows = await queryRows(
    db,
    `SELECT status::text AS status
     FROM reservations
     WHERE id = $1::uuid
     FOR UPDATE`,
    [reservationId]
  );

  if (lockedRows.length === 0) {
    return { ok: false, reason: "reservation_missing", checkedUserIds: [], recorded: false, transitioned: false };
  }

  const status = lockedRows[0].status;
  if (status !== "CONFIRMED" && status !== "CHECKED_IN") {
    return { ok: false, reason: "reservation_closed", checkedUserIds: [], recorded: false, transitioned: false };
  }

  const owners = await getActiveLockOwners(db, {
    reservationId,
    deviceKey: locks.find((lock) => lock.type === "DEVICE")?.key ?? "",
    hardwareKey: locks.find((lock) => lock.type === "HARDWARE")?.key ?? "",
    ipUaKey: locks.find((lock) => lock.type === "IP_UA")?.key ?? "",
  });

  const foreignOwner = Object.values(owners).find((owner) => owner && owner !== userId);
  if (foreignOwner) {
    return { ok: false, reason: "device_conflict", checkedUserIds: await listAttendanceUserIds(db, reservationId), recorded: false, transitioned: false };
  }

  const existingAttendance = await queryRows(
    db,
    `SELECT id FROM kiosk_attendances
     WHERE reservation_id = $1::uuid AND user_id = $2::uuid`,
    [reservationId, userId]
  );

  if (existingAttendance.length > 0) {
    return {
      ok: true,
      reason: "already_checked_in",
      checkedUserIds: await listAttendanceUserIds(db, reservationId),
      recorded: false,
      transitioned: false,
    };
  }

  const consumed = await queryRows(
    db,
    `UPDATE kiosk_check_in_codes
     SET consumed_at = NOW()
     WHERE reservation_id = $1::uuid
       AND user_id = $2::uuid
       AND code = $3
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING id`,
    [reservationId, userId, code]
  );

  if (consumed.length !== 1) {
    return {
      ok: false,
      reason: "invalid_code",
      checkedUserIds: await listAttendanceUserIds(db, reservationId),
      recorded: false,
      transitioned: false,
    };
  }

  for (const lock of locks) {
    if (!lock?.key) continue;
    const acquired = await acquireLock(db, {
      reservationId,
      lockType: lock.type,
      lockKey: lock.key,
      userId,
    });
    if (!acquired) {
      throw new Error("DEVICE_LOCK_LOST");
    }
  }

  const attendanceId = crypto.randomUUID();
  const insertedAttendance = await queryRows(
    db,
    `INSERT INTO kiosk_attendances (id, reservation_id, user_id, checked_in_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, NOW())
     ON CONFLICT (reservation_id, user_id) DO NOTHING
     RETURNING id`,
    [attendanceId, reservationId, userId]
  );

  const checkedUserIds = await listAttendanceUserIds(db, reservationId);
  const minimum = Math.max(2, Number(minParticipants) || 2);
  let transitioned = false;

  if (checkedUserIds.length >= minimum) {
    const updated = await queryRows(
      db,
      `UPDATE reservations
       SET status = 'CHECKED_IN'::"reservation_status",
           checked_in_at = NOW(),
           checked_in_by = $2::uuid,
           updated_at = NOW()
       WHERE id = $1::uuid
         AND status = 'CONFIRMED'::"reservation_status"
       RETURNING id`,
      [reservationId, userId]
    );
    transitioned = updated.length === 1;
  }

  return {
    ok: true,
    reason: insertedAttendance.length === 1 ? "checked_in" : "already_checked_in",
    checkedUserIds,
    recorded: insertedAttendance.length === 1,
    transitioned,
  };
}

export async function claimNoShowCancellation(db, reservationId, reason) {
  const rows = await queryRows(
    db,
    `UPDATE reservations
     SET status = 'NO_SHOW'::"reservation_status",
         no_show = TRUE,
         penalty_applied = TRUE,
         cancelled_at = NOW(),
         cancellation_reason = $2,
         updated_at = NOW()
     WHERE id = $1::uuid
       AND penalty_applied = FALSE
       AND status::text <> 'CHECKED_IN'
       AND status::text NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
     RETURNING id`,
    [reservationId, reason]
  );
  return rows.length === 1;
}

export async function claimPenaltyApplied(db, reservationId) {
  const rows = await queryRows(
    db,
    `UPDATE reservations
     SET penalty_applied = TRUE,
         updated_at = NOW()
     WHERE id = $1::uuid
       AND penalty_applied = FALSE
     RETURNING id`,
    [reservationId]
  );
  return rows.length === 1;
}
