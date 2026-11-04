import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {
  buildMicrosoftProfileUpdate,
  buildTempPasswordQueueRecord,
  generateTempPassword,
  hashPassword,
  isExactThkStaffEmail,
  normalizeEmail,
  projectSessionUser,
  temporaryPasswordStillValid,
  toAdminUser,
  validatePasswordPolicy,
  verifyPassword,
} from "../src/lib/staffAuth.mjs";
import { LOGIN_MAX_FAILURES, recordLoginFailure } from "../src/lib/staffAuthSql.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "../.env") });

function redact(error) {
  return String(error?.message || error).replace(/:\/\/[^@\s]+@/g, "://***@");
}

test("kurumsal e-posta yalnızca tam thk.edu.tr alan adını kabul eder", () => {
  assert.equal(isExactThkStaffEmail("  Funda@THK.edu.tr "), true);
  assert.equal(normalizeEmail("  Funda@THK.edu.tr "), "funda@thk.edu.tr");
  assert.equal(isExactThkStaffEmail("funda@stu.thk.edu.tr"), false);
  assert.equal(isExactThkStaffEmail("funda@thk.edu.tr.example.com"), false);
  assert.equal(isExactThkStaffEmail("funda@stu.thk.edu.tr.example.com"), false);
  assert.equal(isExactThkStaffEmail("funda@thk.edu.tr.tr"), false);
  assert.equal(isExactThkStaffEmail("funda.ad@thk.edu.tr"), true);
  assert.equal(isExactThkStaffEmail("@thk.edu.tr"), false);
  assert.equal(isExactThkStaffEmail("funda@thk.edu.tr@thk.edu.tr"), false);
});

test("şifre politikası sunucu kurallarını uygular", () => {
  assert.equal(validatePasswordPolicy("kisa", "funda@thk.edu.tr").ok, false);
  assert.equal(validatePasswordPolicy("sadecekucukharf1!", "funda@thk.edu.tr").ok, false);
  assert.equal(validatePasswordPolicy("funda@thk.edu.tr", "funda@thk.edu.tr").ok, false);
  assert.equal(validatePasswordPolicy("FundaGuclu1!", "funda@thk.edu.tr").ok, true);
});

test("geçici şifre güçlüdür ve yalnızca hash saklanır", async () => {
  const password = generateTempPassword();
  assert.equal(password.length, 20);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[^A-Za-z0-9]/);
  const hash = await hashPassword(password);
  assert.equal(hash.includes(password), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(`${password}x`, hash), false);
});

test("e-posta kuyruğu ve oturum yanıtı geçici şifreyi taşımaz", () => {
  const secret = "GeciciSifre1!abcd";
  const record = buildTempPasswordQueueRecord({
    to: "Funda@thk.edu.tr",
    smtpAccepted: true,
    errorMessage: `SMTP ${secret} rejected`,
    secret,
  });
  assert.equal(JSON.stringify(record).includes(secret), false);
  assert.equal(record.metadata.smtpAccepted, true);
  assert.equal(record.metadata.deliveredToUser, false);
  assert.equal(record.metadata.deliveryGuaranteed, false);
  assert.equal(record.body.includes("yazılmadı"), true);

  const sessionUser = projectSessionUser({
    userId: "user-1",
    name: "Funda",
    role: "LIBRARIAN",
    mustChangePassword: true,
    passwordHash: "scrypt$secret",
    tempPasswordExpiresAt: "2026-11-03T00:00:00.000Z",
    sessionVersion: 3,
  });
  assert.equal(sessionUser.mustChangePassword, true);
  assert.equal("passwordHash" in sessionUser, false);
  assert.equal("tempPasswordExpiresAt" in sessionUser, false);
  assert.equal("sessionVersion" in sessionUser, false);

  const adminUser = toAdminUser({
    id: "user-1",
    fullName: "Funda",
    email: "funda@thk.edu.tr",
    phone: null,
    studentNumber: null,
    department: "BİM",
    role: "LIBRARIAN",
    penaltyPoints: 0,
    isBanned: false,
    banUntil: null,
    banReason: null,
    passwordHash: "scrypt$secret",
    tempPasswordExpiresAt: new Date(),
    mustChangePassword: true,
    sessionVersion: 2,
  });
  assert.equal(adminUser.passwordLogin, true);
  assert.equal(JSON.stringify(adminUser).includes("scrypt"), false);
  assert.equal("tempPasswordExpiresAt" in adminUser, false);
  assert.equal("mustChangePassword" in adminUser, false);
});

test("Microsoft profil güncellemesi şifre zorunluluğunu silmez", () => {
  const update = buildMicrosoftProfileUpdate({
    name: "Funda",
    image: null,
    studentNumber: null,
  });
  for (const key of ["passwordHash", "mustChangePassword", "tempPasswordExpiresAt", "sessionVersion", "role"]) {
    assert.equal(Object.hasOwn(update, key), false);
  }
});

test("süresi dolan geçici şifre kabul edilmez", () => {
  const expired = temporaryPasswordStillValid({
    mustChangePassword: true,
    tempPasswordExpiresAt: new Date(Date.now() - 1000),
  });
  const fresh = temporaryPasswordStillValid({
    mustChangePassword: true,
    tempPasswordExpiresAt: new Date(Date.now() + 60_000),
  });
  const permanent = temporaryPasswordStillValid({
    mustChangePassword: false,
    tempPasswordExpiresAt: null,
  });
  assert.equal(expired, false);
  assert.equal(fresh, true);
  assert.equal(permanent, true);
});

test("giriş denemeleri kalıcı sayaçta sınırlanır", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("ÇALIŞTIRILAMADI: DATABASE_URL yok");
    return;
  }

  const schema = `thku_staff_ephemeral_${crypto.randomBytes(4).toString("hex")}`;
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
    max: 2,
  });
  let created = false;
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      created = true;
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
        CREATE TABLE auth_rate_limits (
          id uuid PRIMARY KEY,
          bucket varchar(128) NOT NULL UNIQUE,
          failures integer NOT NULL DEFAULT 0,
          window_start timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const db = {
        async query(sql, params) {
          const result = await client.query(sql, params);
          return result.rows;
        },
      };
      const bucket = "test-bucket";
      let last;
      for (let i = 0; i < LOGIN_MAX_FAILURES + 1; i += 1) {
        last = await recordLoginFailure(db, { id: crypto.randomUUID(), bucket });
      }
      assert.equal(last.failures, LOGIN_MAX_FAILURES + 1);
      assert.equal(last.limited, true);
      await client.query(`UPDATE auth_rate_limits SET window_start = NOW() - INTERVAL '16 minutes' WHERE bucket = $1`, [bucket]);
      const reset = await recordLoginFailure(db, { id: crypto.randomUUID(), bucket });
      assert.equal(reset.failures, 1);
      assert.equal(reset.limited, false);
    } finally {
      client.release();
    }
  } catch (error) {
    const message = redact(error);
    if (!created) {
      t.skip(`ÇALIŞTIRILAMADI: ${message}`);
      return;
    }
    assert.fail(message);
  } finally {
    if (created) {
      const cleanup = await pool.connect();
      try {
        await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        cleanup.release();
      }
    }
    await pool.end();
  }
});

test("korumalı uçlar şifre değiştirme kapısını çağırır", () => {
  const apiRoot = path.join(here, "../src/app/api");
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name === "route.js" || name === "route") files.push(full);
    }
  };
  walk(apiRoot);
  const missing = files.filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("getServerSession(authOptions)")) return false;
    if (file.includes(`${path.sep}account${path.sep}password${path.sep}`)) return false;
    return !source.includes("rejectIfPasswordChangeRequired(session)");
  });
  assert.deepEqual(missing, []);
});
