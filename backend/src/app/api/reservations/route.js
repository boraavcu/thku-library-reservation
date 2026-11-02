import {
  runReservationLifecycleChecks,
  sendReservationCancelledEmails,
  sendReservationInvitationEmails,
} from "@/lib/lifecycle";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";
import { getIstanbulTimeDetails, parseReservationMinutesUTC } from "@/lib/timeUtils";
import {
  getActiveReservationRules,
  validateDailyQuotaForUsers,
  validateNightToMorningRuleForUsers,
} from "@/lib/reservationPolicy";

const EXCLUDED_STATUSES = ["CANCELLED", "NO_SHOW"];

export async function POST(request) {
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lockKey = null;

  try {
    await runReservationLifecycleChecks();

    const body = await request.json();
    const { roomId, reservationDate, startTime, endTime, purpose, participantEmails = [] } = body;

    if (!roomId || !reservationDate || !startTime || !endTime) {
      return NextResponse.json({ error: "Eksik alanlar var." }, { status: 400 });
    }

    const creator = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true, email: true, fullName: true, isBanned: true, banUntil: true, banReason: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (creator.isBanned) {
      const banDateStr = creator.banUntil
        ? new Date(creator.banUntil).toLocaleDateString("tr-TR")
        : "Kalıcı (Süresiz)";
      return NextResponse.json(
        {
          error: `Hesabınız (${banDateStr} tarihine kadar) askıya alınmıştır. Sebep: ${
            creator.banReason || "Kural ihlali"
          }`,
        },
        { status: 403 }
      );
    }

    const roomRecord = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, roomNumber: true, name: true, capacity: true, isActive: true },
    });

    if (!roomRecord || !roomRecord.isActive) {
      return NextResponse.json({ error: "Seçilen çalışma odası aktif değil." }, { status: 400 });
    }

    const cleanedEmails = [
      ...new Set(
        participantEmails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && e !== creator.email.toLowerCase())
      ),
    ];

    const rules = await getActiveReservationRules();
    const minP = rules.minParticipants;
    const maxP = Math.min(roomRecord.capacity || rules.maxParticipants, rules.maxParticipants);
    const maxDurationHours = rules.maxDurationHours;
    const maxAdvanceDays = rules.maxAdvanceDays;
    const dailyReleaseHour = rules.dailyReleaseHour;

    const totalParticipants = cleanedEmails.length + 1;
    if (totalParticipants < minP || totalParticipants > maxP) {
      return NextResponse.json(
        {
          error: `Toplam katılımcı sayısı en az ${minP}, en fazla ${maxP} kişi olmalıdır. Şu an: ${totalParticipants}`,
        },
        { status: 400 }
      );
    }

    const dateObj = new Date(reservationDate + "T00:00:00Z");

    const { todayDate: todayUtcObj, hour: curH, totalMins: nowTotalMins } = getIstanbulTimeDetails();
    const diffDays = Math.round((dateObj.getTime() - todayUtcObj.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) {
      return NextResponse.json({ error: "Geçmiş bir tarihe rezervasyon yapılamaz." }, { status: 400 });
    }
    if (diffDays > maxAdvanceDays) {
      return NextResponse.json(
        { error: `En fazla ${maxAdvanceDays} gün sonrasına rezervasyon yapabilirsiniz.` },
        { status: 400 }
      );
    }
    if (diffDays === maxAdvanceDays && maxAdvanceDays > 0 && curH < dailyReleaseHour) {
      return NextResponse.json(
        {
          error: `Yeni gün rezervasyon kotaları sabah saat ${String(dailyReleaseHour).padStart(2, "0")}:00 itibarıyla açılmaktadır.`,
        },
        { status: 400 }
      );
    }

    const startObj = new Date(`1970-01-01T${startTime}:00Z`);
    const endObj =
      endTime === "24:00"
        ? new Date("1970-01-01T23:59:59Z")
        : new Date(`1970-01-01T${endTime}:00Z`);

    const { startTotalMins, endTotalMins } = parseReservationMinutesUTC({
      startTime: startObj,
      endTime: endObj,
    });

    // Bugün için seçilen saat dilimi tamamen geçmişse engelle (Walk-In için devam eden saat dilimine izin verilir)
    if (diffDays === 0 && endTotalMins <= nowTotalMins) {
      return NextResponse.json(
        { error: "Seçilen saat dilimi sona ermiştir. Geçmiş bir saate rezervasyon yapılamaz." },
        { status: 400 }
      );
    }

    const durationHours = (endTotalMins - startTotalMins) / 60;
    if (durationHours <= 0 || durationHours > maxDurationHours) {
      return NextResponse.json(
        { error: `Rezervasyon süresi günde en fazla ${maxDurationHours} saat olabilir (Uzatma yapılamaz).` },
        { status: 400 }
      );
    }

    let participantUsers = [];
    if (cleanedEmails.length > 0) {
      const foundUsers = await prisma.user.findMany({
        where: { email: { in: cleanedEmails } },
        select: { id: true, email: true, fullName: true, isBanned: true },
      });

      const foundSet = new Set(foundUsers.map((u) => u.email.toLowerCase()));
      const missingEmails = cleanedEmails.filter((e) => !foundSet.has(e));

      if (missingEmails.length > 0) {
        return NextResponse.json(
          { error: "Şu e-postalar sisteme kayıtlı değil", missingEmails },
          { status: 400 }
        );
      }

      const bannedParticipant = foundUsers.find((u) => u.isBanned);
      if (bannedParticipant) {
        return NextResponse.json(
          {
            error: `Davet ettiğiniz ${bannedParticipant.email} kullanıcısının rezervasyon yasağı (ban) bulunmaktadır.`,
          },
          { status: 400 }
        );
      }

      participantUsers = foundUsers;
    }

    const allGroupUserIds = [creator.id, ...participantUsers.map((u) => u.id)];

    const quotaCheck = await validateDailyQuotaForUsers({
      userIds: allGroupUserIds,
      creatorId: creator.id,
      reservationDateObj: dateObj,
    });
    if (!quotaCheck.valid) {
      return NextResponse.json({ error: quotaCheck.error }, { status: 400 });
    }

    const nightToMorningCheck = await validateNightToMorningRuleForUsers({
      userIds: allGroupUserIds,
      reservationDateObj: dateObj,
      startTotalMins,
      endTotalMins,
    });
    if (!nightToMorningCheck.valid) {
      return NextResponse.json({ error: nightToMorningCheck.error }, { status: 400 });
    }

    // Aynı anda aynı odaya gelen rezervasyon isteklerinde yarış durumunu (Double Booking) önleyen Redis kilidi
    lockKey = `lock:room_booking:${roomId}:${reservationDate}`;
    try {
      const acquired = await redis.set(lockKey, creator.id, "NX", "EX", 5);
      if (!acquired) {
        return NextResponse.json(
          { error: "Bu oda için şu an başka bir işlem yapılıyor. Lütfen birkaç saniye sonra tekrar deneyiniz." },
          { status: 409 }
        );
      }
    } catch {
      // Redis kapalıysa DB kontrolü ile devam et
    }

    const overlapping = await prisma.reservation.findFirst({
      where: {
        roomId,
        reservationDate: dateObj,
        status: { notIn: EXCLUDED_STATUSES },
        AND: [{ startTime: { lt: endObj } }, { endTime: { gt: startObj } }],
      },
      select: { id: true },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: "Bu oda seçilen tarih ve saat aralığında zaten rezerve edilmiş." },
        { status: 409 }
      );
    }

    // Geçmiş CANCELLED/NO_SHOW kayıtlarını silmek yerine (analitik ve PenaltyHistory FK bütünlüğünü korumak için)
    // startTime saniyesini kaydırarak unique_user_time kısıtlaması çakışmasını önle
    const existingInactive = await prisma.reservation.findMany({
      where: {
        userId: creator.id,
        reservationDate: dateObj,
        startTime: startObj,
        status: { in: EXCLUDED_STATUSES },
      },
      select: { id: true },
    });

    if (existingInactive.length > 0) {
      await Promise.all(
        existingInactive.map((oldRes, idx) =>
          prisma.reservation.update({
            where: { id: oldRes.id },
            data: {
              startTime: new Date(
                startObj.getTime() + (((Date.now() + idx) % 50) + 1) * 1000
              ),
            },
          })
        )
      );
    }

    const initialStatus = "PENDING";

    const reservation = await prisma.reservation.create({
      data: {
        roomId,
        userId: creator.id,
        reservationDate: dateObj,
        startTime: startObj,
        endTime: endObj,
        purpose: purpose || "Grup Çalışması",
        status: initialStatus,
        ...(participantUsers.length > 0 && {
          participants: {
            create: participantUsers.map((u) => ({
              userId: u.id,
              status: "PENDING",
            })),
          },
        }),
      },
      include: {
        room: { select: { roomNumber: true, name: true } },
        participants: {
          include: { user: { select: { email: true, fullName: true } } },
        },
      },
    });

    const roomLabel = [reservation.room.roomNumber, reservation.room.name].join(" - ");
    const timeLabel = [startTime, endTime].join(" - ");

    await prisma.auditLog.create({
      data: {
        userId: creator.id,
        action: "RESERVATION_CREATED",
        entityType: "Reservation",
        entityId: reservation.id,
        newData: {
          room: roomLabel,
          date: reservationDate,
          time: timeLabel,
          organizer: creator.email,
          invitedParticipants: cleanedEmails,
          status: initialStatus,
        },
      },
    });

    // Davet edilen öğrencilere bildirim ve kurumsal davet e-postasını arka planda gönder
    sendReservationInvitationEmails(reservation.id).catch((err) =>
      console.error("Invitation email trigger error:", err)
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error("Reservation create error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  } finally {
    if (lockKey) {
      redis.del(lockKey).catch(() => {});
    }
  }
}

export async function GET() {
  runReservationLifecycleChecks().catch(() => {});
  const rulesCheck = await checkRulesAcceptance();
  if (rulesCheck) return rulesCheck;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true },
    });

    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { userId: user.id },
          { participants: { some: { userId: user.id, status: "ACCEPTED" } } },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true, capacity: true } },
        user: { select: { id: true, email: true, fullName: true } },
        participants: {
          include: { user: { select: { id: true, email: true, fullName: true } } },
        },
      },
      orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }],
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Reservations fetch error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reservationId, action } = await request.json();
    if (!reservationId || action !== "EARLY_CHECKOUT") {
      return NextResponse.json(
        { error: "Yalnızca odayı erken boşaltma işlemi yapılabilir." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true, email: true, fullName: true, role: true },
    });

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const isStaff = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(user.role);
    if (reservation.userId !== user.id && !isStaff) {
      return NextResponse.json(
        { error: "Bu işlemi yalnızca rezervasyon organizatörü veya görevli yapabilir." },
        { status: 403 }
      );
    }

    // No-Show cezasını atlatmayı önlemek için öğrenci yalnızca kapı QR Check-In yapılmış odayı erken boşaltabilir
    if (!isStaff && reservation.status !== "CHECKED_IN") {
      return NextResponse.json(
        {
          error:
            "Odayı erken boşaltma işlemi yalnızca Kiosk QR ile giriş (Check-In) yapılmış aktif rezervasyonlar için kullanılabilir.",
        },
        { status: 400 }
      );
    }

    const { totalMins: nowTotalMins } = getIstanbulTimeDetails();
    const { startTotalMins, endTotalMins } = parseReservationMinutesUTC(reservation);

    let newEndObj = reservation.endTime;
    if (nowTotalMins < endTotalMins) {
      const effectiveMins = Math.max(startTotalMins, nowTotalMins);
      const effH = Math.floor(effectiveMins / 60);
      const effM = effectiveMins % 60;
      newEndObj = new Date(Date.UTC(1970, 0, 1, effH, effM, 0));
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "COMPLETED",
        endTime: newEndObj,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RESERVATION_EARLY_CHECKOUT",
        entityType: "Reservation",
        entityId: reservationId,
        oldData: { status: reservation.status, endTime: reservation.endTime },
        newData: {
          status: "COMPLETED",
          newEndTime: newEndObj,
          room: reservation.room.roomNumber,
          releasedBy: user.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Oda başarıyla boşaltıldı ve kalan saatler diğer öğrencilerin kullanımına açıldı.",
      reservation: updated,
    });
  } catch (error) {
    console.error("Reservation PATCH error:", error);
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("id");

    if (!reservationId) {
      return NextResponse.json({ error: "Rezervasyon ID gerekli." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true, email: true, role: true },
    });

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const isStaff = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(user.role);
    if (reservation.userId !== user.id && !isStaff) {
      return NextResponse.json(
        { error: "Bu rezervasyonu yalnızca organizatör veya kütüphane görevlisi iptal edebilir." },
        { status: 403 }
      );
    }

    if (!isStaff && reservation.status === "CHECKED_IN") {
      return NextResponse.json(
        {
          error:
            "Giriş (Check-in) yapılmış rezervasyon iptal edilemez; 'Odayı Erken Boşalt' butonunu kullanabilirsiniz.",
        },
        { status: 400 }
      );
    }

    if (!isStaff) {
      const rules = await getActiveReservationRules();
      const cancelLockMins = rules.cancelLockMinutes;

      const { dateStr: todayTrStr, totalMins: nowTotalMins } = getIstanbulTimeDetails();
      const resDateStr = new Date(reservation.reservationDate).toISOString().split("T")[0];
      const { startTotalMins } = parseReservationMinutesUTC(reservation);

      const nowEpochMins =
        Math.floor(new Date(todayTrStr + "T00:00:00Z").getTime() / 60000) + nowTotalMins;
      const resStartEpochMins =
        Math.floor(new Date(resDateStr + "T00:00:00Z").getTime() / 60000) + startTotalMins;

      const minsRemaining = resStartEpochMins - nowEpochMins;

      if (minsRemaining < cancelLockMins) {
        return NextResponse.json(
          {
            error: `Rezervasyon başlangıç saatine ${cancelLockMins} dakikadan az kaldığı için iptal edilemez. Ceza/uyarı almamak için odaya gelip kapı QR onayınızı vermeniz gerekmektedir.`,
          },
          { status: 400 }
        );
      }
    }

    const wasConfirmed = ["CONFIRMED", "CHECKED_IN"].includes(reservation.status);
    const reasonText = isStaff
      ? `Kütüphane yetkilisi (${user.email}) tarafından iptal edildi`
      : `Organizatör (${user.email}) tarafından iptal edildi`;

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reasonText,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RESERVATION_CANCELLED",
        entityType: "Reservation",
        entityId: reservationId,
        oldData: { status: reservation.status, room: reservation.room.roomNumber },
        newData: { status: "CANCELLED", cancelledBy: user.email, reason: reasonText },
      },
    });

    sendReservationCancelledEmails({
      reservationId,
      cancelledByEmail: user.email,
      reason: reasonText,
      wasConfirmed,
    }).catch((err) => console.error("Cancel email error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reservation cancel error:", error);
    return NextResponse.json({ error: "İptal işlemi başarısız." }, { status: 500 });
  }
}
