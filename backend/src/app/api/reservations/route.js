import {
  runReservationLifecycleChecks,
  sendReservationCancelledEmails,
  sendReservationInvitationEmails,
} from "@/lib/lifecycle";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { rejectIfPasswordChangeRequired } from "@/lib/passwordGate";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";
import { getIstanbulTimeDetails, parseReservationMinutesUTC } from "@/lib/timeUtils";
import {
  getActiveReservationRules,
  validateDailyQuotaForUsers,
  validateNightToMorningRuleForUsers,
} from "@/lib/reservationPolicy";

const ACTIVE_ROOM_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"];
const INACTIVE_ROOM_STATUSES = ["CANCELLED", "NO_SHOW", "COMPLETED"];

export async function POST(request) {
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck;

  const session = await getServerSession(authOptions);
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const initialStatus = "PENDING";

    // PostgreSQL satır kilidi (FOR UPDATE) ile aynı odaya eşzamanlı rezervasyon yarış durumunu (Double Booking) önle
    const txOutcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM rooms WHERE id = $1::uuid FOR UPDATE`,
        roomId
      );

      const overlapping = await tx.reservation.findFirst({
        where: {
          roomId,
          reservationDate: dateObj,
          status: { in: ACTIVE_ROOM_STATUSES },
          AND: [{ startTime: { lt: endObj } }, { endTime: { gt: startObj } }],
        },
        select: { id: true },
      });

      if (overlapping) {
        return { conflict: true };
      }

      // Geçmiş CANCELLED/NO_SHOW/COMPLETED kayıtlarını silmek yerine (analitik ve PenaltyHistory FK bütünlüğünü korumak için)
      // startTime saniyesini kaydırarak unique_user_time kısıtlaması çakışmasını önle
      const existingInactive = await tx.reservation.findMany({
        where: {
          userId: creator.id,
          reservationDate: dateObj,
          startTime: startObj,
          status: { in: INACTIVE_ROOM_STATUSES },
        },
        select: { id: true },
      });

      if (existingInactive.length > 0) {
        await Promise.all(
          existingInactive.map((oldRes, idx) =>
            tx.reservation.update({
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

      const created = await tx.reservation.create({
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

      return { conflict: false, reservation: created };
    });

    if (txOutcome.conflict) {
      return NextResponse.json(
        { error: "Bu oda seçilen tarih ve saat aralığında zaten rezerve edilmiş." },
        { status: 409 }
      );
    }

    const reservation = txOutcome.reservation;
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

    sendReservationInvitationEmails(reservation.id).catch((err) =>
      console.error("Invitation email trigger error:", err)
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error("Reservation create error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function GET() {
  const rulesCheck = await checkRulesAcceptance();
  if (rulesCheck) return rulesCheck;

  const session = await getServerSession(authOptions);
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runReservationLifecycleChecks();

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
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
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

    if (!isStaff && reservation.status !== "CHECKED_IN") {
      return NextResponse.json(
        {
          error:
            "Odayı erken boşaltma işlemi yalnızca Kiosk QR ile giriş (Check-In) yapılmış aktif rezervasyonlar için kullanılabilir.",
        },
        { status: 400 }
      );
    }

    const { dateStr: todayTrStr, totalMins: nowTotalMins } = getIstanbulTimeDetails();
    const resDateStr = new Date(reservation.reservationDate).toISOString().split("T")[0];
    const { startTotalMins, endTotalMins } = parseReservationMinutesUTC(reservation);

    let newEndObj = reservation.endTime;
    if (resDateStr > todayTrStr) {
      newEndObj = reservation.startTime;
    } else if (resDateStr === todayTrStr && nowTotalMins < endTotalMins) {
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
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
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
