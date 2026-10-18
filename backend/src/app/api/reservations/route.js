import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";

const DEFAULT_MIN = 2;
const DEFAULT_MAX = 7;
const DEFAULT_MAX_HOURS = 3;
const EXCLUDED_STATUSES = ["CANCELLED", "NO_SHOW"];

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
      const banDateStr = creator.banUntil ? new Date(creator.banUntil).toLocaleDateString("tr-TR") : "Süresiz";
      return NextResponse.json(
        { error: `Hesabınız (${banDateStr} tarihine kadar) askıya alınmıştır. Sebep: ${creator.banReason || "Kural ihlali"}` },
        { status: 403 }
      );
    }

    const cleanedEmails = [
      ...new Set(
        participantEmails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && e !== creator.email.toLowerCase())
      ),
    ];

    // --- Kural Kontrolü ---
    const rulesRows = await prisma.reservationRule.findMany({
      where: {
        isActive: true,
        ruleName: { in: ["MIN_PARTICIPANTS", "MAX_PARTICIPANTS", "MAX_DURATION_HOURS"] },
      },
      select: { ruleName: true, ruleValue: true },
    });
    const rulesMap = Object.fromEntries(rulesRows.map((r) => [r.ruleName, r.ruleValue]));
    const minP = rulesMap.MIN_PARTICIPANTS?.value ?? DEFAULT_MIN;
    const maxP = rulesMap.MAX_PARTICIPANTS?.value ?? DEFAULT_MAX;
    const maxDurationHours = rulesMap.MAX_DURATION_HOURS?.value ?? DEFAULT_MAX_HOURS;

    const totalParticipants = cleanedEmails.length + 1;
    if (totalParticipants < minP || totalParticipants > maxP) {
      return NextResponse.json(
        { error: `Toplam katılımcı sayısı ${minP} ile ${maxP} arasında olmalıdır. Şu an: ${totalParticipants}` },
        { status: 400 }
      );
    }

    const dateObj = new Date(reservationDate + "T00:00:00Z");
    const startObj = new Date(`1970-01-01T${startTime}:00Z`);
    const endObj =
      endTime === "24:00"
        ? new Date("1970-01-01T23:59:59Z")
        : new Date(`1970-01-01T${endTime}:00Z`);

    const durationHours = Math.round((endObj - startObj) / (1000 * 60 * 60));
    if (durationHours <= 0 || durationHours > maxDurationHours) {
      return NextResponse.json(
        { error: `Rezervasyon süresi en fazla ${maxDurationHours} saat olabilir.` },
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

    // --- MADDE 2: Organizatör VE Katılımcılar İçin Günlük 1 Rezervasyon Limiti (Kuyruk Önleme) ---
    const allGroupUserIds = [creator.id, ...participantUsers.map((u) => u.id)];

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
        { error: `Grubunuzdaki ${busyMember} öğrencisinin seçilen tarihte zaten aktif bir rezervasyonu bulunmaktadır (Günlük 1 Rezervasyon Kuralı).` },
        { status: 400 }
      );
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

    // P2002 Unique Constraint Koruması: Aynı saatte daha önce CANCELLED olan kayıt varsa temizle
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

    // --- MADDE 9: Sistem Denetim Logu (AuditLog) ---
    await prisma.auditLog.create({
      data: {
        userId: creator.id,
        action: "RESERVATION_CREATED",
        entityType: "Reservation",
        entityId: reservation.id,
        newData: {
          room: `${reservation.room.roomNumber} - ${reservation.room.name}`,
          date: reservationDate,
          time: `${startTime} - ${endTime}`,
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

    // Hem kullanıcının oluşturduğu hem de katılımcı olduğu rezervasyonları getir
    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { userId: user.id },
          { participants: { some: { userId: user.id, status: "ACCEPTED" } } },
        ],
      },
      include: {
        room: { select: { roomNumber: true, name: true } },
        user: { select: { id: true, email: true, fullName: true } },
        participants: {
          include: { user: { select: { email: true, fullName: true } } },
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
 * 1) EARLY_CHECKOUT: Organizatörün Odayı Erken Boşaltması (Madde 8)
 * 2) SELF_EXTEND_1H: 7/24 Kütüphanede Önündeki Saat Boşsa Öğrencinin +1 Saat Uzatması (Madde 3)
 */
export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reservationId, action } = await request.json();
    if (!reservationId || !["EARLY_CHECKOUT", "SELF_EXTEND_1H"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
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

    // --- SENARYO 1: ÖĞRENCİNİN KENDİ KENDİNE +1 SAAT SÜRE UZATMASI (7/24 Destekli) ---
    if (action === "SELF_EXTEND_1H") {
      if (!["CONFIRMED", "CHECKED_IN"].includes(reservation.status)) {
        return NextResponse.json(
          { error: "Yalnızca onaylanmış veya giriş yapılmış aktif rezervasyonlar uzatılabilir." },
          { status: 400 }
        );
      }

      const currentEndHour = new Date(reservation.endTime).getUTCHours();
      const currentEndMin = new Date(reservation.endTime).getUTCMinutes();

      if (currentEndHour >= 23 && currentEndMin >= 59) {
        return NextResponse.json(
          { error: "Gün sonu (24:00) sınırına ulaşıldığı için aynı gün içinde daha fazla uzatılamaz." },
          { status: 400 }
        );
      }

      const targetEndHour = currentEndHour + 1;
      const newEndTime =
        targetEndHour >= 24
          ? new Date(Date.UTC(1970, 0, 1, 23, 59, 59))
          : new Date(Date.UTC(1970, 0, 1, targetEndHour, currentEndMin, 0));

      // Odanın bir sonraki saatinde başka bir rezervasyon var mı?
      const conflict = await prisma.reservation.findFirst({
        where: {
          id: { not: reservationId },
          roomId: reservation.roomId,
          reservationDate: reservation.reservationDate,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          AND: [
            { startTime: { lt: newEndTime } },
            { endTime: { gt: reservation.endTime } },
          ],
        },
      });

      if (conflict) {
        return NextResponse.json(
          { error: "Odanın bir sonraki saat dilimi başka bir grup tarafından rezerve edildiği için uzatılamaz." },
          { status: 409 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { endTime: newEndTime },
      });

      const formattedTargetHour = targetEndHour >= 24 ? "24:00" : `${String(targetEndHour).padStart(2, "0")}:00`;

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "RESERVATION_EXTENDED",
          entityType: "Reservation",
          entityId: reservationId,
          oldData: { endTime: reservation.endTime },
          newData: {
            room: reservation.room.roomNumber,
            newEndTime: formattedTargetHour,
            extendedBy: user.email,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Oda müsait olduğu için rezervasyonunuz saat ${formattedTargetHour}'a kadar +1 saat uzatıldı!`,
        reservation: updated,
      });
    }

    // --- SENARYO 2: ODAYI ERKEN BOŞALTMA (EARLY_CHECKOUT) ---
    const now = new Date();
    const trParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const curH = Number(trParts.find((p) => p.type === "hour").value);
    const curM = Number(trParts.find((p) => p.type === "minute").value);

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
 * DELETE /api/reservations -> MADDE 10: Rezervasyon Başlamadan Organizatör Tarafından İptal Edilmesi
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

    const reasonText = isStaff
      ? "Kütüphane görevlisi tarafından iptal edildi"
      : "Organizatör tarafından başlangıç öncesi iptal edildi";

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reasonText,
      },
    });

    // MADDE 9: AuditLog Kaydı
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