import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";

const DEFAULT_MIN = 2;
const DEFAULT_MAX = 8; 
const DEFAULT_MAX_HOURS = 3; 
const DEFAULT_MAX_ADVANCE_DAYS = 1; 
const EXCLUDED_STATUSES = ["CANCELLED", "NO_SHOW"];

// Türkiye saatini (Europe/Istanbul) parçalı olarak döner
function getIstanbulNow() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(timeParts.find((p) => p.type === "hour").value);
  const minute = Number(timeParts.find((p) => p.type === "minute").value);
  return { dateStr, hour, minute };
}

export async function POST(request) {
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roomId, reservationDate, startTime, endTime, purpose, participantEmails = [] } = body;

    if (!roomId || !reservationDate || !startTime || !endTime) {
      return NextResponse.json({ error: "Eksik alanlar var." }, { status: 400 });
    }

    const creator = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, fullName: true, isBanned: true, banUntil: true, banReason: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    if (creator.isBanned) {
      const banDateStr = creator.banUntil ? new Date(creator.banUntil).toLocaleDateString("tr-TR") : "Dönem Sonu";
      return NextResponse.json(
        { error: `Hesabınız (${banDateStr} tarihine kadar) askıya alınmıştır. Sebep: ${creator.banReason || "Kural ihlali"}` },
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

    const rulesRows = await prisma.reservationRule.findMany({
      where: {
        isActive: true,
        ruleName: {
          in: ["MIN_PARTICIPANTS", "MAX_PARTICIPANTS", "MAX_DURATION_HOURS", "MAX_ADVANCE_DAYS"],
        },
      },
      select: { ruleName: true, ruleValue: true },
    });
    const rulesMap = Object.fromEntries(rulesRows.map((r) => [r.ruleName, r.ruleValue]));
    const minP = rulesMap.MIN_PARTICIPANTS?.value ?? DEFAULT_MIN;
    const maxP = Math.min(roomRecord.capacity || DEFAULT_MAX, rulesMap.MAX_PARTICIPANTS?.value ?? DEFAULT_MAX);
    const maxDurationHours = rulesMap.MAX_DURATION_HOURS?.value ?? DEFAULT_MAX_HOURS;
    const maxAdvanceDays = rulesMap.MAX_ADVANCE_DAYS?.value ?? DEFAULT_MAX_ADVANCE_DAYS;

    const totalParticipants = cleanedEmails.length + 1;
    if (totalParticipants < minP || totalParticipants > maxP) {
      return NextResponse.json(
        { error: `Toplam katılımcı sayısı en az ${minP}, en fazla ${maxP} kişi olmalıdır. Şu an: ${totalParticipants}` },
        { status: 400 }
      );
    }

    const dateObj = new Date(reservationDate + "T00:00:00Z");

    // --- MADDE 3: İleri Tarih Sınırı Kontrolü (Varsayılan Maksimum 1 Gün) ---
    const { dateStr: todayTrStr } = getIstanbulNow();
    const todayUtcObj = new Date(todayTrStr + "T00:00:00Z");
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

    const startObj = new Date(`1970-01-01T${startTime}:00Z`);
    const endObj =
      endTime === "24:00"
        ? new Date("1970-01-01T23:59:59Z")
        : new Date(`1970-01-01T${endTime}:00Z`);

    const startHourNum = startObj.getUTCHours();
    const endHourNum = endTime === "24:00" ? 24 : endObj.getUTCHours();

    const durationHours = endHourNum - startHourNum;
    if (durationHours <= 0 || durationHours > maxDurationHours) {
      return NextResponse.json(
        { error: `Rezervasyon süresi günde en fazla ${maxDurationHours} saat olabilir (Uzatma yapılamaz).` },
        { status: 400 }
      );
    }

    // --- Katılımcı E-posta ve Ban Doğrulama ---
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
          { error: `Davet ettiğiniz ${bannedParticipant.email} kullanıcısının rezervasyon yasağı (ban) bulunmaktadır.` },
          { status: 400 }
        );
      }

      participantUsers = foundUsers;
    }

    const allGroupUserIds = [creator.id, ...participantUsers.map((u) => u.id)];

    // --- Günlük 1 Rezervasyon Limiti (Organizatör ve Onaylı Katılımcılar Dahil) ---
    const existingGroupBookingToday = await prisma.reservation.findFirst({
      where: {
        reservationDate: dateObj,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
        OR: [
          { userId: { in: allGroupUserIds } },
          {
            participants: {
              some: {
                userId: { in: allGroupUserIds },
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
      include: {
        user: { select: { email: true, fullName: true } },
        participants: {
          where: { userId: { in: allGroupUserIds }, status: "ACCEPTED" },
          include: { user: { select: { email: true, fullName: true } } },
        },
      },
    });

    if (existingGroupBookingToday) {
      const isCreatorBusy =
        existingGroupBookingToday.userId === creator.id ||
        existingGroupBookingToday.participants.some((p) => p.userId === creator.id);

      if (isCreatorBusy) {
        return NextResponse.json(
          { error: "Aynı gün içinde (organizatör veya katılımcı olarak) yalnızca 1 adet rezervasyon hakkınız bulunmaktadır." },
          { status: 400 }
        );
      }

      const busyMember = allGroupUserIds.includes(existingGroupBookingToday.userId)
        ? existingGroupBookingToday.user.email
        : existingGroupBookingToday.participants[0]?.user?.email;

      return NextResponse.json(
        { error: `Grubunuzdaki ${busyMember} öğrencisinin seçilen tarihte zaten aktif bir rezervasyonu bulunmaktadır.` },
        { status: 400 }
      );
    }

    // Gece 21:00-24:00 Alanların Ertesi Gün 00:00-08:00 Arası Randevu Alamaması 
    // Senaryo A: Yeni alınan randevu sabah 00:00 - 08:00 arasına değiyorsa (startHourNum < 8),
    // bir önceki gün 21:00 - 24:00 arasına değen (endTime > 21:00) randevusu var mı kontrol et.
    if (startHourNum < 8) {
      const prevDayObj = new Date(dateObj.getTime() - 24 * 60 * 60 * 1000);
      const nightThreshold = new Date("1970-01-01T21:00:00Z");

      const prevNightBooking = await prisma.reservation.findFirst({
        where: {
          reservationDate: prevDayObj,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
          endTime: { gt: nightThreshold },
          OR: [
            { userId: { in: allGroupUserIds } },
            { participants: { some: { userId: { in: allGroupUserIds }, status: "ACCEPTED" } } },
          ],
        },
        select: { id: true },
      });

      if (prevNightBooking) {
        return NextResponse.json(
          {
            error:
              "Kütüphane kuralları gereği bir önceki gece 21:00 - 24:00 saatleri arasında randevusu bulunan kullanıcılar, ertesi gün 00:00 - 08:00 saatleri arasına randevu alamazlar.",
          },
          { status: 400 }
        );
      }
    }

    // Senaryo B: Yeni alınan randevu gece 21:00 - 24:00 arasına değiyorsa (endHourNum > 21),
    // ertesi gün 00:00 - 08:00 arasında halihazırda alınmış randevusu var mı kontrol et.
    if (endHourNum > 21) {
      const nextDayObj = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000);
      const morningThreshold = new Date("1970-01-01T08:00:00Z");

      const nextMorningBooking = await prisma.reservation.findFirst({
        where: {
          reservationDate: nextDayObj,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
          startTime: { lt: morningThreshold },
          OR: [
            { userId: { in: allGroupUserIds } },
            { participants: { some: { userId: { in: allGroupUserIds }, status: "ACCEPTED" } } },
          ],
        },
        select: { id: true },
      });

      if (nextMorningBooking) {
        return NextResponse.json(
          {
            error:
              "Ertesi gün 00:00 - 08:00 saatleri arasında randevusu bulunan kullanıcılar, bir önceki gece 21:00 - 24:00 saatleri arasına randevu alamazlar.",
          },
          { status: 400 }
        );
      }
    }

    // --- Oda Saat Çakışma Kontrolü ---
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

    // P2002 Koruması: Aynı saatte daha önce CANCELLED olan kayıt varsa temizle
    await prisma.reservation.deleteMany({
      where: {
        userId: creator.id,
        reservationDate: dateObj,
        startTime: startObj,
        status: { in: EXCLUDED_STATUSES },
      },
    });

    const initialStatus = minP <= 1 ? "CONFIRMED" : "PENDING";

    const reservation = await prisma.reservation.create({
      data: {
        roomId,
        userId: creator.id,
        reservationDate: dateObj,
        startTime: startObj,
        endTime: endObj,
        purpose: purpose || null,
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
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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

/**
 * PATCH /api/reservations ->
 * +1 Saat Uzatma (SELF_EXTEND_1H) tamamen kaldırıldı!
 * Sadece EARLY_CHECKOUT (Odayı Erken Boşaltma) aktif.
 */
export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reservationId, action } = await request.json();
    if (!reservationId || action !== "EARLY_CHECKOUT") {
      return NextResponse.json(
        { error: "Süre uzatma işlemi kaldırılmıştır. Yalnızca erken boşaltma yapılabilir." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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
        { error: "Bu işlemi yalnızca rezervasyon organizatörü veya görevli yapabilir." },
        { status: 403 }
      );
    }

    const { hour: curH, minute: curM } = getIstanbulNow();
    const origStartH = new Date(reservation.startTime).getUTCHours();
    const origEndH = new Date(reservation.endTime).getUTCHours();

    let newEndObj = reservation.endTime;
    if (curH >= origStartH && curH < origEndH) {
      newEndObj = new Date(Date.UTC(1970, 0, 1, curH, curM, 0));
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

/**
 * DELETE /api/reservations ->
 * Randevu başlangıcına 1 saatten (60 dk) az kaldıysa öğrenci iptal edemez!
 */
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
      where: { email: session.user.email },
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
        { error: "Giriş (Check-in) yapılmış rezervasyon iptal edilemez; 'Odayı Erken Boşalt' butonunu kullanabilirsiniz." },
        { status: 400 }
      );
    }

    // --- MADDE 5: Son 1 Saat (60 Dakika) İptal Kilidi ---
    if (!isStaff) {
      const { dateStr: todayTrStr, hour: curH, minute: curM } = getIstanbulNow();
      const resDateStr = new Date(reservation.reservationDate).toISOString().split("T")[0];
      const startH = new Date(reservation.startTime).getUTCHours();
      const startM = new Date(reservation.startTime).getUTCMinutes();

      const nowEpochMins =
        Math.floor(new Date(todayTrStr + "T00:00:00Z").getTime() / 60000) + curH * 60 + curM;
      const resStartEpochMins =
        Math.floor(new Date(resDateStr + "T00:00:00Z").getTime() / 60000) + startH * 60 + startM;

      const minsRemaining = resStartEpochMins - nowEpochMins;

      if (minsRemaining < 60) {
        return NextResponse.json(
          {
            error:
              "Rezervasyon başlangıç saatine 1 saatten (60 dk) az kaldığı için iptal edilemez. Ceza/uyarı almamak için odaya gelip Kiosk kodunuzu girmeniz gerekmektedir.",
          },
          { status: 400 }
        );
      }
    }

    const reasonText = isStaff
      ? "Kütüphane görevlisi tarafından iptal edildi"
      : "Organizatör tarafından başlangıçtan en az 1 saat önce iptal edildi";

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reservation cancel error:", error);
    return NextResponse.json({ error: "İptal işlemi başarısız." }, { status: 500 });
  }
}