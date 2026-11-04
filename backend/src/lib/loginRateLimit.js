import crypto from "crypto";
import prisma from "@/lib/db";
import { rateLimitBucket } from "@/lib/staffAuth.mjs";
import {
  CLEAR_LOGIN_BUCKET_SQL,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_SECONDS,
  RECORD_LOGIN_FAILURE_SQL,
} from "@/lib/staffAuthSql.mjs";

export function clientIpFromRequest(req) {
  const headers = req?.headers;
  let forwarded = "";
  if (headers?.get) {
    forwarded = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "";
  } else if (headers) {
    forwarded = headers["x-forwarded-for"] || headers["x-real-ip"] || "";
  }
  const first = String(forwarded || "").split(",")[0].trim();
  return first.slice(0, 64) || "unknown";
}

async function bump(bucket) {
  const rows = await prisma.$queryRawUnsafe(
    RECORD_LOGIN_FAILURE_SQL,
    crypto.randomUUID(),
    bucket,
    LOGIN_WINDOW_SECONDS
  );
  const failures = Number(rows?.[0]?.failures || 0);
  return failures > LOGIN_MAX_FAILURES;
}

export async function beginLoginAttempt({ email, ip }) {
  const buckets = [rateLimitBucket("ip", ip || "unknown")];
  if (email) buckets.push(rateLimitBucket("email", email));
  let limited = false;
  for (const bucket of buckets) {
    if (await bump(bucket)) limited = true;
  }
  return { limited, buckets };
}

export async function clearLoginAttempts(buckets) {
  for (const bucket of buckets || []) {
    await prisma.$queryRawUnsafe(CLEAR_LOGIN_BUCKET_SQL, bucket);
  }
}
