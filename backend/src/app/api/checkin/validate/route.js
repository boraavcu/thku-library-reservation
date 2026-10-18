import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";

const TOLERANCE_MINUTES = 15;
const REDIS_KEY = "kiosk:current_token";
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300; // 5 dakika

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;
  const attemptKey = `kiosk:attempts:${currentUserId}`;

  try {
    // 1. Brute-Force (Deneme-Yanılma) Kontrolü
    const attempts = Number((await redis.get(attemptKey)) || 0);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Çok fazla hatalı kod denemesi yaptınız. Lütfen 5 dakika sonra tekrar deneyiniz." },
        { status: 429 }
      );
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    }

    const currentToken = await redis.get(REDIS_KEY);
    if (!currentToken || currentToken !== token.trim().toUpperCase()) {
      const newCount = await redis.incr(attemptKey);
      if (newCount === 1) {
        await redis.expire(attemptKey, LOCK_SECONDS);
      }
      return NextResponse.json(
        { error: `Geçersiz veya süresi dolmuş Kiosk kodu. (Kalan deneme hakkı: ${Math.max(0, MAX_ATTEMPTS - newCount)})` },
        { status: 400 }
      );
    }

    // Doğru girildiyse hatalı deneme sayacını temizle
    await redis.del(attemptKey);

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const todayDate = new Date(`${todayStr}T00:00:00Z`);

    const trTimeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const currentHour = Number(trTimeParts.find((p) => p.type === "hour").value);
    const currentMinute = Number(trTimeParts.find((p) => p.type === "minute").value);
    const nowTotalMinutes = currentHour * 60 + currentMinute;

    const winStartMinutes = Math.max(0, nowTotalMinutes - TOLERANCE_MINUTES);
    const winEndMinutes = Math.min(24 * 60 - 1, nowTotalMinutes + TOLERANCE_MINUTES);

    const windowStart = new Date(
      Date.UTC(1970, 0, 1, Math.floor(winStartMinutes / 60), winStartMinutes % 60, 0)
    );
    const windowEnd = new Date(
      Date.UTC(1970, 0, 1, Math.floor(winEndMinutes / 60), winEndMinutes % 60, 59)
    );

    const reservation = await prisma.reservation.findFirst({
      where: {
        reservationDate: todayDate,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        startTime: { gte: windowStart, lte: windowEnd },
        OR: [
          { userId: currentUserId },
          {
            participants: {
              some: { userId: currentUserId, status: "ACCEPTED" },
            },
          },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Şu an için başlayan (±15 dk) onaylı bir rezervasyonunuz bulunamadı." },
        { status: 404 }
      );
    }

    if (reservation.status !== "CHECKED_IN") {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: now,
          checkedInById: currentUserId,
        },
      });
    }

    const startHour = new Date(reservation.startTime).getUTCHours();
    const startMin = new Date(reservation.startTime).getUTCMinutes();
    const endDt = new Date(reservation.endTime);
    const endHour = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
    const endMin = endHour === 24 ? 0 : endDt.getUTCMinutes();

    const fmtTime = (h, m) =>
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const startTimeStr = fmtTime(startHour, startMin);
    const endTimeStr = fmtTime(endHour, endMin);

    const reservationStartMinutes = startHour * 60 + startMin;
    const isEarly = reservationStartMinutes > nowTotalMinutes;

    const response = {
      success: true,
      reservationId: reservation.id,
      room: reservation.room,
      startTime: startTimeStr,
      endTime: endTimeStr,
      isEarly,
    };

    if (isEarly) {
      response.warningMessage = `Girişiniz onaylandı! Ancak odanız saat ${startTimeStr}'a kadar dolu olabilir. Lütfen saatiniz gelene kadar bekleyiniz.`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Check-in validate error:", error);
    return NextResponse.json(
      { error: "Doğrulama sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}