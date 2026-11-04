import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import test from "node:test";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import {
  buildPenaltyTargets,
  claimNoShowCancellation,
  consumeCheckIn,
  listAttendanceUserIds,
} from "../src/lib/kioskSql.mjs";
import {
  buildKioskLocksForRequest,
  getCrossIncognitoSignature,
  sanitizeDeviceId,
  verifyCampusNetworkAndVpn,
} from "../src/lib/kioskSecurity.js";
import { parseReservationMinutesUTC } from "../src/lib/timeUtils.js";
import { isReservationEnded } from "../../frontend/src/utils/dateUtils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "../.env") });

function redact(error) {
  return String(error?.message || error).replace(/:\/\/[^@\s]+@/g, "://***@");
}

test("yoklaması alınan kişi ceza listesine girmez", () => {
  const organizer = "organizer";
  const guest = "guest";
  const belowMinimum = buildPenaltyTargets({
    checkedUserIds: [organizer],
    memberIds: [organizer, guest],
    status: "CONFIRMED",
    minRequired: 2,
    penaltyApplied: false,
  });
  assert.equal(belowMinimum.action, "cancel_no_show");
  assert.deepEqual(belowMinimum.penalizeUserIds, [guest]);

  const partial = buildPenaltyTargets({
    checkedUserIds: [organizer, guest],
    memberIds: [organizer, guest, "late"],
    status: "CHECKED_IN",
    minRequired: 2,
    penaltyApplied: false,
  });
  assert.equal(partial.action, "penalize_absent");
  assert.deepEqual(partial.penalizeUserIds, ["late"]);

  const repeated = buildPenaltyTargets({
    ...partial,
    checkedUserIds: [organizer, guest],
    memberIds: [organizer, guest, "late"],
    penaltyApplied: true,
    status: "CHECKED_IN",
    minRequired: 2,
  });
  assert.equal(repeated.action, "skip");
  assert.deepEqual(repeated.penalizeUserIds, []);
});

test("kampüs NAT (eduroam) aynı IP ve UA paylaşımında sahte kilit üretmez, gizli sekmeyi yakalar", () => {
  const reqPhoneA = new Request("http://localhost:3000/api/kiosk/qr?door=thku-study-room", {
    headers: {
      "x-forwarded-for": "193.255.10.20",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)",
      "x-device-id": "dev_student_a",
      "x-hardware-fp": "hw_apple_a16_2556x1179",
    },
  });
  const reqPhoneAIncognito = new Request("http://localhost:3000/api/kiosk/qr?door=thku-study-room", {
    headers: {
      "x-forwarded-for": "193.255.10.20",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)",
      "x-device-id": "dev_incognito_new",
      "x-hardware-fp": "hw_apple_a16_2556x1179",
    },
  });
  const reqPhoneB = new Request("http://localhost:3000/api/kiosk/qr?door=thku-study-room", {
    headers: {
      "x-forwarded-for": "193.255.10.20",
      "user-agent": "Mozilla/5.0 (Linux; Android 14)",
      "x-device-id": "dev_student_b",
      "x-hardware-fp": "hw_samsung_s23_2340x1080",
    },
  });

  const sigA = getCrossIncognitoSignature(reqPhoneA);
  const sigAIncog = getCrossIncognitoSignature(reqPhoneAIncognito);
  const sigB = getCrossIncognitoSignature(reqPhoneB);

  // Aynı telefon gizli sekme -> aynı hwLockHash üretir ve yakalanır
  assert.equal(sigA.hwLockHash, sigAIncog.hwLockHash);
  // Farklı telefon aynı kampüs IP'sinde -> farklı hwLockHash üretir
  assert.notEqual(sigA.hwLockHash, sigB.hwLockHash);

  // Varsayılan "no-dev-id" ve "no-hw" sahte kilit üretmez
  assert.equal(sanitizeDeviceId("no-dev-id"), "");
  assert.equal(sanitizeDeviceId("dev_fallback_browser"), "");
  const reqDummy = new Request("http://localhost:3000/api/kiosk/qr", {
    headers: {
      "x-forwarded-for": "193.255.10.20",
      "user-agent": "Mozilla/5.0",
      "x-device-id": "no-dev-id",
      "x-hardware-fp": "no-hw",
    },
  });
  const sigDummy = getCrossIncognitoSignature(reqDummy);
  const builtDummy = buildKioskLocksForRequest(reqDummy, "res-1", sigDummy);
  assert.deepEqual(builtDummy.locks, []);
});

test("kampüs Wi-Fi doğrulaması hücresel veriyi engeller ve yerel/kampüs ağını kabul eder", async () => {
  const cellRes = await verifyCampusNetworkAndVpn("193.255.10.20", "cellular");
  assert.equal(cellRes.allowed, false);

  const wifiRes = await verifyCampusNetworkAndVpn("193.255.10.20", "wifi");
  assert.equal(wifiRes.allowed, true);
});

test("randevu bitiş saati hesaplaması gece yarısı (23:59 -> 24:00) ve geçmiş randevuları doğru tespit eder", () => {
  const sampleRes = {
    reservationDate: new Date("2025-01-15T00:00:00.000Z"),
    startTime: new Date("1970-01-01T21:00:00.000Z"),
    endTime: new Date("1970-01-01T23:59:00.000Z"),
  };
  const timing = parseReservationMinutesUTC(sampleRes);
  assert.equal(timing.startH, 21);
  assert.equal(timing.endH, 24);
  assert.equal(timing.endTotalMins - timing.startTotalMins, 180);
  assert.equal(isReservationEnded(sampleRes), true);
});

function dbOf(client) {
  return {
    async query(sql, params = []) {
      const result = await client.query(sql, params);
      return result.rows;
    },
  };
}

async function withTx(pool, schema, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    const result = await fn(dbOf(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* bağlantı koptuysa ikinci hatayı yut */
    }
    throw error;
  } finally {
    client.release();
  }
}

async function seedReservation(pool, schema, reservationId) {
  await withTx(pool, schema, async (db) => {
    await db.query(
      `INSERT INTO reservations (id, status) VALUES ($1::uuid, 'CONFIRMED')`,
      [reservationId]
    );
  });
}

async function seedCode(pool, schema, reservationId, userId, code, expired = false) {
  await withTx(pool, schema, async (db) => {
    const expires = expired ? "NOW() - INTERVAL '5 seconds'" : "NOW() + INTERVAL '600 seconds'";
    await db.query(
      `INSERT INTO kiosk_check_in_codes
         (id, reservation_id, user_id, code, expires_at, consumed_at, created_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, ${expires}, NULL, NOW())`,
      [crypto.randomUUID(), reservationId, userId, code]
    );
  });
}

test("kiosk postgres atomikliği", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("ÇALIŞTIRILAMADI: DATABASE_URL yok");
    return;
  }

  const schema = `thku_kiosk_ephemeral_${crypto.randomBytes(4).toString("hex")}`;
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
    max: 4,
  });
  let created = false;

  try {
    const admin = await pool.connect();
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      created = true;
      await admin.query(`SET search_path TO "${schema}"`);
      await admin.query(`CREATE TYPE reservation_status AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`);
      await admin.query(`CREATE TYPE kiosk_lock_type AS ENUM ('DEVICE', 'HARDWARE', 'IP_UA')`);
      await admin.query(`
        CREATE TABLE reservations (
          id uuid PRIMARY KEY,
          status reservation_status NOT NULL DEFAULT 'CONFIRMED',
          penalty_applied boolean NOT NULL DEFAULT false,
          no_show boolean NOT NULL DEFAULT false,
          cancelled_at timestamp(6),
          cancellation_reason text,
          checked_in_at timestamp(6),
          checked_in_by uuid,
          updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await admin.query(`
        CREATE TABLE kiosk_check_in_codes (
          id uuid PRIMARY KEY,
          reservation_id uuid NOT NULL,
          user_id uuid NOT NULL,
          code varchar(64) NOT NULL,
          expires_at timestamp(6) NOT NULL,
          consumed_at timestamp(6),
          created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (reservation_id, user_id)
        )
      `);
      await admin.query(`
        CREATE TABLE kiosk_device_locks (
          id uuid PRIMARY KEY,
          reservation_id uuid NOT NULL,
          lock_type kiosk_lock_type NOT NULL,
          lock_key varchar(128) NOT NULL,
          user_id uuid NOT NULL,
          expires_at timestamp(6) NOT NULL,
          created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (reservation_id, lock_type, lock_key)
        )
      `);
      await admin.query(`
        CREATE TABLE kiosk_attendances (
          id uuid PRIMARY KEY,
          reservation_id uuid NOT NULL,
          user_id uuid NOT NULL,
          checked_in_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (reservation_id, user_id)
        )
      `);
    } finally {
      admin.release();
    }

    const locksFor = (device, hardware, ipua) => [
      { type: "DEVICE", key: device },
      { type: "HARDWARE", key: hardware },
      { type: "IP_UA", key: ipua },
    ];

    await t.test("süresi dolmuş kod yoklama yazmaz", async () => {
      const reservationId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, userId, "expired-code", true);
      const result = await withTx(pool, schema, (db) => consumeCheckIn(db, {
        reservationId,
        userId,
        code: "expired-code",
        locks: locksFor("dev-1", "hw-1", "ip-1"),
        minParticipants: 2,
      }));
      assert.equal(result.ok, false);
      assert.equal(result.reason, "invalid_code");
      const attendance = await withTx(pool, schema, (db) => listAttendanceUserIds(db, reservationId));
      assert.deepEqual(attendance, []);
    });

    await t.test("aynı kod ikinci kez yoklama yazmaz", async () => {
      const reservationId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, userId, "once-code");
      const first = await withTx(pool, schema, (db) => consumeCheckIn(db, {
        reservationId,
        userId,
        code: "once-code",
        locks: locksFor("dev-2", "hw-2", "ip-2"),
        minParticipants: 2,
      }));
      const second = await withTx(pool, schema, (db) => consumeCheckIn(db, {
        reservationId,
        userId,
        code: "once-code",
        locks: locksFor("dev-2", "hw-2", "ip-2"),
        minParticipants: 2,
      }));
      assert.equal(first.recorded, true);
      assert.equal(second.recorded, false);
      assert.equal(second.reason, "already_checked_in");
      const attendance = await withTx(pool, schema, (db) => listAttendanceUserIds(db, reservationId));
      assert.deepEqual(attendance, [userId]);
    });

    await t.test("paralel aynı kod tek yoklama üretir", async () => {
      const reservationId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, userId, "race-code");
      const args = {
        reservationId,
        userId,
        code: "race-code",
        locks: locksFor("dev-race", "hw-race", "ip-race"),
        minParticipants: 2,
      };
      const results = await Promise.all([
        withTx(pool, schema, (db) => consumeCheckIn(db, args)),
        withTx(pool, schema, (db) => consumeCheckIn(db, args)),
      ]);
      assert.equal(results.filter((item) => item.recorded).length, 1);
      const attendance = await withTx(pool, schema, (db) => listAttendanceUserIds(db, reservationId));
      assert.deepEqual(attendance, [userId]);
    });

    await t.test("aynı cihaz iki kullanıcıya verilmez", async () => {
      const reservationId = crypto.randomUUID();
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, userA, "code-a");
      await seedCode(pool, schema, reservationId, userB, "code-b");
      const results = await Promise.all([
        withTx(pool, schema, (db) => consumeCheckIn(db, {
          reservationId,
          userId: userA,
          code: "code-a",
          locks: locksFor("shared-device", "hw-a", "ip-a"),
          minParticipants: 2,
        })),
        withTx(pool, schema, (db) => consumeCheckIn(db, {
          reservationId,
          userId: userB,
          code: "code-b",
          locks: locksFor("shared-device", "hw-b", "ip-b"),
          minParticipants: 2,
        })),
      ]);
      const winners = results.filter((item) => item.ok && item.recorded);
      const conflicts = results.filter((item) => item.reason === "device_conflict");
      assert.equal(winners.length, 1);
      assert.equal(conflicts.length, 1);
      const attendance = await withTx(pool, schema, (db) => listAttendanceUserIds(db, reservationId));
      assert.equal(attendance.length, 1);
      const loser = results.find((item) => item.reason === "device_conflict");
      const loserId = attendance[0] === userA ? userB : userA;
      assert.ok(loser);
      const codeRows = await withTx(pool, schema, (db) => db.query(
        `SELECT consumed_at FROM kiosk_check_in_codes WHERE reservation_id = $1::uuid AND user_id = $2::uuid`,
        [reservationId, loserId]
      ));
      assert.equal(codeRows[0].consumed_at, null);
    });

    await t.test("minimum kişi eşiğinde durum bir kez değişir", async () => {
      const reservationId = crypto.randomUUID();
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, userA, "min-a");
      await seedCode(pool, schema, reservationId, userB, "min-b");
      const results = await Promise.all([
        withTx(pool, schema, (db) => consumeCheckIn(db, {
          reservationId,
          userId: userA,
          code: "min-a",
          locks: locksFor("dev-a", "hw-a2", "ip-a2"),
          minParticipants: 2,
        })),
        withTx(pool, schema, (db) => consumeCheckIn(db, {
          reservationId,
          userId: userB,
          code: "min-b",
          locks: locksFor("dev-b", "hw-b2", "ip-b2"),
          minParticipants: 2,
        })),
      ]);
      assert.equal(results.filter((item) => item.recorded).length, 2);
      assert.equal(results.filter((item) => item.transitioned).length, 1);
      const status = await withTx(pool, schema, (db) => db.query(
        `SELECT status::text AS status FROM reservations WHERE id = $1::uuid`,
        [reservationId]
      ));
      assert.equal(status[0].status, "CHECKED_IN");
    });

    await t.test("kod ve kilit silinse de yoklama ve ceza kararı kalır", async () => {
      const reservationId = crypto.randomUUID();
      const present = crypto.randomUUID();
      const absent = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      await seedCode(pool, schema, reservationId, present, "keep-code");
      await withTx(pool, schema, (db) => consumeCheckIn(db, {
        reservationId,
        userId: present,
        code: "keep-code",
        locks: locksFor("dev-keep", "hw-keep", "ip-keep"),
        minParticipants: 2,
      }));
      await withTx(pool, schema, async (db) => {
        await db.query(`DELETE FROM kiosk_check_in_codes WHERE reservation_id = $1::uuid`, [reservationId]);
        await db.query(`DELETE FROM kiosk_device_locks WHERE reservation_id = $1::uuid`, [reservationId]);
      });
      const checked = await withTx(pool, schema, (db) => listAttendanceUserIds(db, reservationId));
      assert.deepEqual(checked, [present]);
      const decision = buildPenaltyTargets({
        checkedUserIds: checked,
        memberIds: [present, absent],
        status: "CONFIRMED",
        minRequired: 2,
        penaltyApplied: false,
      });
      assert.deepEqual(decision.penalizeUserIds, [absent]);
    });

    await t.test("no-show kilidi paralel istekte bir kez alınır", async () => {
      const reservationId = crypto.randomUUID();
      await seedReservation(pool, schema, reservationId);
      const claims = await Promise.all([
        withTx(pool, schema, (db) => claimNoShowCancellation(db, reservationId, "süre doldu")),
        withTx(pool, schema, (db) => claimNoShowCancellation(db, reservationId, "süre doldu")),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const row = await withTx(pool, schema, (db) => db.query(
        `SELECT status::text AS status, penalty_applied FROM reservations WHERE id = $1::uuid`,
        [reservationId]
      ));
      assert.equal(row[0].status, "NO_SHOW");
      assert.equal(row[0].penalty_applied, true);
    });
  } catch (error) {
    const message = redact(error);
    if (!created) {
      t.skip(`ÇALIŞTIRILAMADI: ${message}`);
      return;
    }
    throw error;
  } finally {
    if (created) {
      const admin = await pool.connect();
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        admin.release();
      }
    }
    await pool.end();
  }
});
