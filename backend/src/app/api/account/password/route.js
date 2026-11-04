import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { noStoreJson } from "@/lib/passwordGate";
import { hashPassword, temporaryPasswordStillValid, validatePasswordPolicy, verifyPassword } from "@/lib/staffAuth.mjs";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!session?.user?.id || !token?.userId || token.sessionRevoked) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!session.user.mustChangePassword || !token.mustChangePassword) {
    return noStoreJson({ error: "Kalıcı şifre bu oturumda değiştirilemez." }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Geçersiz istek." }, 400);
  }

  const password = String(body?.password || "");
  const confirm = String(body?.confirm || "");
  if (!password || password !== confirm) {
    return noStoreJson({ error: "Yeni şifre ve tekrarı aynı olmalıdır." }, 400);
  }

  const policy = validatePasswordPolicy(password, session.user.email);
  if (!policy.ok) return noStoreJson({ error: policy.message }, 400);

  const current = await prisma.user.findUnique({
    where: { id: token.userId },
    select: {
      passwordHash: true,
      mustChangePassword: true,
      tempPasswordExpiresAt: true,
      isActive: true,
    },
  });
  if (!current?.isActive || !current?.mustChangePassword || !current.passwordHash) {
    return noStoreJson({ error: "Şifre değiştirme oturumu geçersiz." }, 403);
  }
  if (!temporaryPasswordStillValid(current)) {
    return noStoreJson({ error: "Geçici şifrenin süresi dolmuş. Yönetici yeni şifre üretmelidir." }, 403);
  }
  if (await verifyPassword(password, current.passwordHash)) {
    return noStoreJson({ error: "Yeni şifre geçici şifre ile aynı olamaz." }, 400);
  }

  const passwordHash = await hashPassword(password);
  const updated = await prisma.user.updateMany({
    where: {
      id: token.userId,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: token.sessionVersion,
    },
    data: {
      passwordHash,
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  });

  if (updated.count !== 1) {
    return noStoreJson({ error: "Oturum geçersiz. Geçici şifreyle yeniden giriş yapın." }, 409);
  }

  return noStoreJson({ ok: true, requireLogin: true });
}
