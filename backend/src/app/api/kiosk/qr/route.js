import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";
import { runReservationLifecycleChecks } from "@/lib/lifecycle";
import {
  getIstanbulTimeDetails,
  getReservationKioskWindow,
} from "@/lib/timeUtils";
import {
  MAX_DISTANCE_METERS,
  getCrossIncognitoSignature,
  calculateDistanceMeters,
  verifyCampusNetworkAndVpn,
  checkDeviceLockForReservation,
} from "@/lib/kioskSecurity";

const PERSONAL_OTP_TTL = 600;
const DEFAULT_TOLERANCE_MINUTES = 15;

function fmtClockModulo(totalMins) {
  const mod = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(mod / 60);
  const m = mod % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userRole = session.user.role;
  const isStaff = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(userRole);

  try {
    await runReservationLifecycleChecks();

    if (isStaff) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const singleDoorQrUrl = `${frontendUrl}/kiosk?door=thku-study-room`;

      return NextResponse.json({
        mode: "STAFF_POSTER",
        doorQrUrl: singleDoorQrUrl,
        ttlSeconds: PERSONAL_OTP_TTL,
        message: "Bu QR kod tüm çalışma odalarının (R101-R104) kapısına ortak olarak asılır.",
      });
    }

    const { searchParams } = new URL(request.url);
    const doorParam = searchParams.get("door");

    if (doorParam !== "thku-study-room") {
      return NextResponse.json({
        mode: "DOOR_QR_REQUIRED",
        error:
          "Yoklama ekranına anasayfadan veya doğrudan linkle girilemez. Lütfen çalışma odasının kapısındaki fiziksel QR kodu telefon kameranızla okutunuz.",
      });
    }

    const signature = getCrossIncognitoSignature(request);
    const networkCheck = await verifyCampusNetworkAndVpn(signature.ip, signature.netType);
    if (!networkCheck.allowed) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error: networkCheck.reason,
      });
    }

    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const enforceGps = process.env.ENFORCE_CAMPUS_GPS !== "false";

    let distanceMeters = null;
    if (latParam !== null && lngParam !== null) {
      const userLat = parseFloat(latParam);
      const userLng = parseFloat(lngParam);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        distanceMeters = calculateDistanceMeters(userLat, userLng);
        if (enforceGps && distanceMeters > MAX_DISTANCE_METERS) {
          return NextResponse.json({
            mode: "LOCATION_BLOCKED",
            error: `Fiziksel Konum Hatası: Kütüphane binasına ${distanceMeters} metre uzaklıktasınız (Maksimum sınır: ${MAX_DISTANCE_METERS}m). Kütüphane dışından onay verilemez.`,
          });
        }
      }
    } else if (enforceGps) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error: "Oda girişini onaylayabilmek için tarayıcınızın Konum (GPS) iznini açmanız zorunludur.",
      });
    }

    const tolRule = await prisma.reservationRule.findFirst({
      where: { ruleName: "CHECKIN_TOLERANCE_MINUTES", isActive: true },
      select: { ruleValue: true },
    });
    const toleranceMinutes = Number(tolRule?.ruleValue?.value ?? DEFAULT_TOLERANCE_MINUTES);

    const { todayDate, totalMins: nowMins } = getIstanbulTimeDetails();
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
    const nowEpochMins = Math.floor(todayDate.getTime() / 60000) + nowMins;

    const candidateReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: { in: [yesterdayDate, todayDate, tomorrowDate] },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          { userId },
          { participants: { some: { userId, status: "ACCEPTED" } } },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
        participants: {
          where: { status: "ACCEPTED" },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
      orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
    });

    if (candidateReservations.length === 0) {
      return NextResponse.json({
        mode: "STUDENT_NO_ACTIVE_BOOKING",
        error:
          "Bugün için onaylanmış aktif bir çalışma odası randevunuz bulunmamaktadır (veya ±15 dk yoklama süresi dolduğu için otomatik iptal edilmiştir).",
      });
    }

    let matchedReservation = null;
    let windowInfoError = null;
    let activeWindowLabel = "";

    for (const r of candidateReservations) {
      const resDateStr = new Date(r.reservationDate).toISOString().split("T")[0];
      const resDayEpochMins = Math.floor(new Date(`${resDateStr}T00:00:00Z`).getTime() / 60000);
      const { startTotalMins, minAllowed, maxAllowed } = getReservationKioskWindow(
        r,
        resDateStr,
        toleranceMinutes
      );

      const endDt = new Date(r.endTime);
      const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
      const endM = endH === 24 ? 0 : endDt.getUTCMinutes();
      const endTotalMins = endH * 60 + endM;

      const minEpochMins = resDayEpochMins + minAllowed;
      const maxEpochMins = resDayEpochMins + maxAllowed;
      const endEpochMins = resDayEpochMins + endTotalMins;

      const checkedUserIdsForCandidate = await redis.smembers(`kiosk:checked_users:${r.id}`);
      const isAlreadyInRoom =
        (r.status === "CHECKED_IN" || checkedUserIdsForCandidate.includes(userId)) &&
        nowEpochMins >= minEpochMins &&
        nowEpochMins < endEpochMins;

      if ((nowEpochMins >= minEpochMins && nowEpochMins <= maxEpochMins) || isAlreadyInRoom) {
        matchedReservation = r;
        activeWindowLabel = `${fmtClockModulo(minAllowed)} – ${fmtClockModulo(maxAllowed)}`;
        break;
      } else if (resDateStr === new Date(todayDate).toISOString().split("T")[0] || Math.abs(nowEpochMins - minEpochMins) <= 180) {
        windowInfoError = `${r.room.roomNumber} - ${r.room.name} odasındaki ${fmtClockModulo(
          startTotalMins
        )} randevunuz için kapı QR onayı yalnızca ${fmtClockModulo(
          minAllowed
        )} – ${fmtClockModulo(maxAllowed)} saatleri arasında yapılabilir. Şu anki saat: ${fmtClockModulo(
          nowMins
        )}`;
      }
    }

    if (!matchedReservation) {
      return NextResponse.json({
        mode: "OUTSIDE_TIME_WINDOW",
        error:
          windowInfoError ||
          `Şu anki saat, randevunuzun ±${toleranceMinutes} dakikalık başlangıç onay penceresi dışındadır.`,
      });
    }

    const { isLockedByAnotherUser } = await checkDeviceLockForReservation(
      request,
      matchedReservation.id,
      userId,
      signature
    );

    if (isLockedByAnotherUser) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error:
          "⛔ Güvenlik İhlali (Gizli Sekme / Aynı Cihaz Algılandı): Bu fiziksel cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi mobil cihazından QR okutmak zorundadır!",
      });
    }

    const checkedSetKey = `kiosk:checked_users:${matchedReservation.id}`;
    const checkedUserIds = await redis.smembers(checkedSetKey);
    const alreadyCheckedIn = checkedUserIds.includes(userId);

    const otpKey = `kiosk:personal_otp:${matchedReservation.id}:${userId}`;
    let personalSessionToken = await redis.get(otpKey);

    if (!alreadyCheckedIn && !personalSessionToken) {
      personalSessionToken = crypto.randomBytes(16).toString("hex");
      await redis.set(otpKey, personalSessionToken, "EX", PERSONAL_OTP_TTL);
    }

    const allMembers = [
      {
        id: matchedReservation.user.id,
        fullName: matchedReservation.user.fullName,
        email: matchedReservation.user.email,
        role: "Organizatör",
      },
      ...matchedReservation.participants.map((p) => ({
        id: p.user.id,
        fullName: p.user.fullName,
        email: p.user.email,
        role: "Katılımcı",
      })),
    ].map((m) => ({
      ...m,
      hasCheckedIn: checkedUserIds.includes(m.id),
    }));

    return NextResponse.json({
      mode: "STUDENT_ACTIVE",
      reservationId: matchedReservation.id,
      room: matchedReservation.room,
      windowLabel: activeWindowLabel,
      distanceMeters,
      personalSessionToken: alreadyCheckedIn ? null : personalSessionToken,
      alreadyCheckedIn,
      members: allMembers,
      checkedCount: checkedUserIds.length,
      totalCount: allMembers.length,
    });
  } catch (error) {
    console.error("Kiosk QR/Personal check error:", error);
    return NextResponse.json({ error: "Yoklama bilgileri alınırken hata oluştu." }, { status: 500 });
  }
}