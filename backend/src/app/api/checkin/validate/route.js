import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { rejectIfPasswordChangeRequired } from "@/lib/passwordGate";
import { getBrowserCookiePath } from "@/lib/publicPaths";
import { runReservationLifecycleChecks, sendKioskCheckInEmailToStaff } from "@/lib/lifecycle";
import { performCheckIn } from "@/lib/kioskStore";
import {
  getIstanbulTimeDetails,
  getReservationKioskWindow,
  parseReservationMinutesUTC,
} from "@/lib/timeUtils";
import {
  MAX_DISTANCE_METERS,
  DEVICE_LOCK_TTL,
  getCrossIncognitoSignature,
  calculateDistanceMeters,
  verifyCampusNetworkAndVpn,
  checkDeviceLockForReservation,
} from "@/lib/kioskSecurity";

const DEFAULT_TOLERANCE_MINUTES = 15;
const DEFAULT_MIN_CHECKIN_PARTICIPANTS = 2;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;

  try {
    await runReservationLifecycleChecks();

    const signature = getCrossIncognitoSignature(request);
    const body = await request.json();
    const { personalSessionToken, lat, lng } = body;

    const networkCheck = await verifyCampusNetworkAndVpn(signature.ip, signature.netType);
    if (!networkCheck.allowed) {
      return NextResponse.json({ error: networkCheck.reason }, { status: 403 });
    }

    if (process.env.ENFORCE_CAMPUS_GPS === "true") {
      if (typeof lat !== "number" || typeof lng !== "number") {
        return NextResponse.json(
          { error: "Fiziksel konum doğrulaması için tarayıcı GPS izni gereklidir." },
          { status: 403 }
        );
      }
      const dist = calculateDistanceMeters(lat, lng);
      if (dist > MAX_DISTANCE_METERS) {
        return NextResponse.json(
          { error: `Kütüphane binası sınırları dışındasınız (${dist}m). Uzaktan onay verilemez.` },
          { status: 403 }
        );
      }
    }

    const rulesRows = await prisma.reservationRule.findMany({
      where: {
        isActive: true,
        ruleName: { in: ["CHECKIN_TOLERANCE_MINUTES", "MIN_PARTICIPANTS"] },
      },
      select: { ruleName: true, ruleValue: true },
    });
    const rulesMap = Object.fromEntries(rulesRows.map((r) => [r.ruleName, r.ruleValue?.value]));
    const toleranceMinutes = Number(rulesMap.CHECKIN_TOLERANCE_MINUTES ?? DEFAULT_TOLERANCE_MINUTES);
    const minCheckinParticipants = Math.max(
      2,
      Number(rulesMap.MIN_PARTICIPANTS ?? DEFAULT_MIN_CHECKIN_PARTICIPANTS)
    );

    const now = new Date();
    const { todayDate, totalMins: nowTotalMinutes } = getIstanbulTimeDetails(now);
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
    const nowEpochMins = Math.floor(todayDate.getTime() / 60000) + nowTotalMinutes;

    const candidateReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: { in: [yesterdayDate, todayDate, tomorrowDate] },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
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
        user: { select: { id: true, email: true } },
        participants: {
          where: { status: "ACCEPTED" },
          include: { user: { select: { id: true, email: true } } },
        },
      },
      orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
    });

    const reservation = candidateReservations.find((r) => {
      const resDateStr = new Date(r.reservationDate).toISOString().split("T")[0];
      const resDayEpochMins = Math.floor(new Date(`${resDateStr}T00:00:00Z`).getTime() / 60000);
      const { minAllowed, maxAllowed } = getReservationKioskWindow(
        r,
        resDateStr,
        toleranceMinutes
      );
      const { endTotalMins } = parseReservationMinutesUTC(r);
      const minEpochMins = resDayEpochMins + minAllowed;
      const maxEpochMins = resDayEpochMins + maxAllowed;
      const endEpochMins = resDayEpochMins + endTotalMins;

      const isWithinWindow = nowEpochMins >= minEpochMins && nowEpochMins <= maxEpochMins;
      const isRoomAlreadyCheckedInAndActive =
        r.status === "CHECKED_IN" &&
        !r.penaltyApplied &&
        nowEpochMins >= minEpochMins &&
        nowEpochMins < endEpochMins;

      return isWithinWindow || isRoomAlreadyCheckedInAndActive;
    });

    if (!reservation) {
      return NextResponse.json(
        {
          error: `Şu anki saat diliminde (±${toleranceMinutes} dk başlangıç penceresi içinde) onaylanabilecek bir randevunuz bulunamadı.`,
        },
        { status: 400 }
      );
    }

    const { isLockedByAnotherUser, cookieName, locks, presence } =
      await checkDeviceLockForReservation(request, reservation.id, currentUserId, signature);

    if (isLockedByAnotherUser) {
      return NextResponse.json(
        {
          error:
            "⛔ Güvenlik İhlali (Gizli Sekme / Aynı Cihaz Algılandı): Bu fiziksel cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi cihazından QR okutmak zorundadır!",
        },
        { status: 403 }
      );
    }

    const totalGroupMembers = 1 + reservation.participants.length;
    const roomTitle = [reservation.room.roomNumber, reservation.room.name].join(" ");

    if (presence.checkedUserIds.includes(currentUserId)) {
      const resJson = NextResponse.json({
        success: true,
        reservationId: reservation.id,
        room: reservation.room,
        checkedCount: presence.checkedUserIds.length,
        totalCount: totalGroupMembers,
        message: "Yoklama kaydınız zaten alınmış.",
      });
      resJson.cookies.set(cookieName, currentUserId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: DEVICE_LOCK_TTL,
        path: getBrowserCookiePath(),
      });
      return resJson;
    }

    const outcome = await performCheckIn({
      reservationId: reservation.id,
      userId: currentUserId,
      code: personalSessionToken,
      locks,
      minParticipants: minCheckinParticipants,
      onRecorded: async (tx, result) => {
        await tx.auditLog.create({
          data: {
            userId: currentUserId,
            action: "RESERVATION_CHECKED_IN",
            entityType: "Reservation",
            entityId: reservation.id,
            newData: {
              room: roomTitle,
              checkedInBy: session.user.email,
              deviceSignature:
                signature.hwLockHash || signature.headerDeviceId || "cookie-only",
              progress: `${result.checkedUserIds.length}/${totalGroupMembers}`,
            },
          },
        });
      },
    });

    if (!outcome.ok && outcome.reason === "device_conflict") {
      return NextResponse.json(
        {
          error:
            "⛔ Güvenlik İhlali (Gizli Sekme / Aynı Cihaz Algılandı): Bu fiziksel cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi cihazından QR okutmak zorundadır!",
        },
        { status: 403 }
      );
    }

    if (!outcome.ok) {
      return NextResponse.json(
        {
          error:
            "Oturum doğrulama anahtarınızın süresi dolmuş. Lütfen kapıdaki QR kodu tekrar okutunuz.",
        },
        { status: 400 }
      );
    }

    const checkedUserIds = outcome.checkedUserIds;

    if (outcome.transitioned) {
      sendKioskCheckInEmailToStaff(reservation.id, checkedUserIds).catch((err) =>
        console.error("Kiosk staff email error:", err)
      );
    }

    const statusMessage =
      checkedUserIds.length < minCheckinParticipants
        ? `Yoklama kaydınız alındı (${checkedUserIds.length}/${totalGroupMembers}). Randevunun başlaması için en az ${minCheckinParticipants} grup üyesinin kapı QR onayı vermesi gerekmektedir.`
        : `Oda girişiniz onaylandı ve randevunuz resmen başladı! (${checkedUserIds.length}/${totalGroupMembers} katılımcı doğruladı)`;

    const resJson = NextResponse.json({
      success: true,
      reservationId: reservation.id,
      room: reservation.room,
      checkedCount: checkedUserIds.length,
      totalCount: totalGroupMembers,
      message: statusMessage,
    });

    resJson.cookies.set(cookieName, currentUserId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: DEVICE_LOCK_TTL,
      path: getBrowserCookiePath(),
    });

    return resJson;
  } catch (error) {
    console.error("Check-in validate error:", error);
    return NextResponse.json(
      { error: "Onay işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
