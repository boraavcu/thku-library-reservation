import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
export const STAFF_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%*_-+=?";

function pick(chars) {
  return chars[randomInt(chars.length)];
}

export function normalizeEmail(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

export function isExactThkStaffEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0 || at !== normalized.lastIndexOf("@")) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== "thk.edu.tr") return false;
  if (local.length === 0 || local.length > 64 || local.includes("..")) return false;
  return /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(local);
}

export function validatePasswordPolicy(password, email) {
  const value = String(password ?? "");
  if (value.length < 12 || value.length > 128) {
    return { ok: false, message: "Şifre 12 ile 128 karakter arasında olmalıdır." };
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, message: "Şifre büyük harf, küçük harf, rakam ve özel karakter içermelidir." };
  }
  const normalized = normalizeEmail(email);
  const local = normalized.split("@")[0] || "";
  if (value.toLowerCase() === normalized || (local && value.toLowerCase() === local)) {
    return { ok: false, message: "Şifre e-posta adresiyle aynı olamaz." };
  }
  return { ok: true, message: "" };
}

export function generateTempPassword() {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < 20) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nRaw, rRaw, pRaw, saltHex, keyHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    if (!salt.length || expected.length === 0) return false;
    const actual = await scrypt(String(password), salt, expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
    });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function buildTempPasswordQueueRecord({ to, smtpAccepted, errorMessage, secret }) {
  const rawError = errorMessage ? String(errorMessage) : "";
  const safeError = secret ? rawError.split(secret).join("[gizli]") : rawError;
  return {
    to: normalizeEmail(to),
    subject: "Kurumsal hesap bildirimi",
    body: "Geçici şifre güvenlik nedeniyle bu kayda yazılmadı.",
    htmlBody: null,
    status: smtpAccepted ? "SENT" : "FAILED",
    metadata: {
      kind: "TEMP_PASSWORD_NOTICE",
      smtpAccepted: Boolean(smtpAccepted),
      deliveredToUser: false,
      deliveryGuaranteed: false,
    },
    errorMessage: safeError || null,
  };
}

export function buildMicrosoftProfileUpdate({ name, image, studentNumber }) {
  return {
    lastLoginAt: new Date(),
    avatarUrl: image || null,
    fullName: name || "İsimsiz Kullanıcı",
    ...(studentNumber ? { studentNumber } : {}),
  };
}

export function projectSessionUser(token) {
  const revoked = Boolean(token?.sessionRevoked) || !token?.userId;
  return {
    id: revoked ? null : token.userId,
    name: revoked ? null : token.name,
    role: revoked ? null : token.role,
    studentNumber: revoked ? null : token.studentNumber ?? null,
    image: revoked ? null : token.avatarUrl || null,
    acceptedAgreementVersion: revoked ? null : token.acceptedAgreementVersion ?? null,
    penaltyPoints: revoked ? 0 : token.penaltyPoints ?? 0,
    noShowCount: revoked ? 0 : token.noShowCount ?? 0,
    isBanned: revoked ? false : Boolean(token.isBanned),
    banUntil: revoked ? null : token.banUntil || null,
    banReason: revoked ? null : token.banReason || null,
    mustChangePassword: !revoked && Boolean(token.mustChangePassword),
  };
}

export function toAdminUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    studentNumber: user.studentNumber,
    department: user.department,
    role: user.role,
    penaltyPoints: user.penaltyPoints,
    isBanned: user.isBanned,
    banUntil: user.banUntil,
    banReason: user.banReason,
    isActive: user.isActive !== false,
    passwordLogin: Boolean(user.passwordHash),
    _count: user._count || { penalties: 0 },
  };
}

export function rateLimitBucket(kind, value) {
  return createHash("sha256").update(`${kind}:${String(value || "")}`).digest("hex");
}

export function banIsActive(user, now = new Date()) {
  if (!user?.isBanned) return false;
  if (user.banUntil && new Date(user.banUntil) <= now) return false;
  return true;
}

export function temporaryPasswordStillValid(user, now = new Date()) {
  if (!user?.mustChangePassword) return true;
  if (!user.tempPasswordExpiresAt) return false;
  return new Date(user.tempPasswordExpiresAt) > now;
}
