import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import redis from "@/lib/redis";

const TOKEN_LENGTH = 6;
const TOKEN_TTL = 30;
const REDIS_KEY = "kiosk:current_token";
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALLOWED_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];

function generateToken() {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += CHARSET[bytes[i] % CHARSET.length];
  }
  return token;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json(
      { error: "Bu ekran yalnızca yetkili kütüphane Kiosk cihazı tarafından açılabilir." },
      { status: 403 }
    );
  }

  try {
    const existing = await redis.get(REDIS_KEY);

    if (existing) {
      const ttl = await redis.ttl(REDIS_KEY);
      return NextResponse.json({ token: existing, expiresIn: ttl > 0 ? ttl : 0 });
    }

    const token = generateToken();
    await redis.set(REDIS_KEY, token, "EX", TOKEN_TTL);

    return NextResponse.json({ token, expiresIn: TOKEN_TTL });
  } catch (error) {
    console.error("Kiosk QR token error:", error);
    return NextResponse.json(
      { error: "Token oluşturulamadı" },
      { status: 500 }
    );
  }
}