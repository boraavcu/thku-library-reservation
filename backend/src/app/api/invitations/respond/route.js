import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import {
  runReservationLifecycleChecks,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
} from "@/lib/lifecycle";

const DEFAULT_MIN = 2;
const INVITATION_TIMEOUT_MS = 30 * 60 * 1000;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    runReservationLifecycleChecks().catch(() => {});

    const { participantId, action } = await request.json();

    if (!participantId || !["ACCEPT", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true, email: true, fullName: true, isBanned: true },
    });

    if (user?.isBanned && action === "ACCEPT") {
      return NextResponse.json(
        { error: "Hesabınız banlı olduğu için grup davetlerini kabul edemezsiniz." },
        { status: 403 }
      );
    }

    const participant = await prisma.reservationParticipant.findUnique({
      where: { id: participantId },
      include: {
        reservation: {
          include: { room: { select: { roomNumber: true, name: true } } },
        },
      },
    });

    if (!participant || participant.userId !== user.id) {
      return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
    }

    if (participant.reservation.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Bu rezervasyon (30 dakikalık onay süresi dolduğu veya iptal edildiği için) artık geçerli değil." },
        { status: 400 }
      );
    }

    const elapsedMs = Date.now() - new Date(participant.reservation.createdAt).getTime();
    if (participant.reservation.status === "PENDING" && elapsedMs > INVITATION_TIMEOUT_MS) {
      await prisma.reservation.update({
        where: { id: participant.reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Gönderilen davetiyeler 30 dakika içinde onaylanmadığı için otomatik iptal edildi.",
        },
      });
      return NextResponse.json(
        { error: "30 dakikalık davet onay süresi dolduğu için bu randevu otomatik olarak iptal edilmiştir." },
        { status: 400 }
      );
    }

    if (participant.status !== "PENDING") {
      return NextResponse.json({ error: "Bu davete zaten yanıt verilmiş." }, { status: 400 });
    }

    if (action === "ACCEPT") {
      const targetDate = participant.reservation.reservationDate;

      const existingBookingOnDate = await prisma.reservation.findFirst({
        where: {
          id: { not: participant.reservationId },
          reservationDate: targetDate,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
          OR: [
            { userId: user.id },
            {
              participants: {
                some: { userId: user.id, status: "ACCEPTED" },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (existingBookingOnDate) {
        return NextResponse.json(
          { error: "Bu tarihte zaten aktif bir rezervasyonunuz bulunduğu için ikinci bir gruba katılamazsınız (Günlük 1 Rezervasyon Kuralı)." },
          { status: 400 }
        );
      }

      const startDt = new Date(participant.reservation.startTime);
      const endDt = new Date(participant.reservation.endTime);
      const startTotalMins = startDt.getUTCHours() * 60 + startDt.getUTCMinutes();
      const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
      const endTotalMins = endH * 60 + (endH === 24 ? 0 : endDt.getUTCMinutes());

      if (startTotalMins < 8 * 60) {
        const prevDayObj = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000);
        const prevNight = await prisma.reservation.findFirst({
          where: {
            reservationDate: prevDayObj,
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
            endTime: { gt: new Date("1970-01-01T21:00:00Z") },
            OR: [
              { userId: user.id },
              { participants: { some: { userId: user.id, status: "ACCEPTED" } } },
            ],
          },
          select: { id: true },
        });

        if (prevNight) {
          return NextResponse.json(
            {
              error:
                "Bir önceki gece 21:00 - 24:00 saatleri arasında randevunuz bulunduğu için ertesi gün 00:00 - 08:00 arasındaki bir gruba katılamazsınız.",
            },
            { status: 400 }
          );
        }
      }

      if (endTotalMins > 21 * 60) {
        const nextDayObj = new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000);
        const nextMorning = await prisma.reservation.findFirst({
          where: {
            reservationDate: nextDayObj,
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
            startTime: { lt: new Date("1970-01-01T08:00:00Z") },
            OR: [
              { userId: user.id },
              { participants: { some: { userId: user.id, status: "ACCEPTED" } } },
            ],
          },
          select: { id: true },
        });

        if (nextMorning) {
          return NextResponse.json(
            {
              error:
                "Ertesi gün 00:00 - 08:00 saatleri arasında randevunuz bulunduğu için bir önceki gece 21:00 - 24:00 arasındaki gruba katılamazsınız.",
            },
            { status: 400 }
          );
        }
      }
    }

    const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    await prisma.reservationParticipant.update({
      where: { id: participantId },
      data: {
        status: newStatus,
        joinedAt: new Date(),
      },
    });

    const minRule = await prisma.reservationRule.findFirst({
      where: { ruleName: "MIN_PARTICIPANTS", isActive: true },
      select: { ruleValue: true },
    });
    const minP = Math.max(2, minRule?.ruleValue?.value ?? DEFAULT_MIN);

    if (action === "ACCEPT") {
      const acceptedCount = await prisma.reservationParticipant.count({
        where: {
          reservationId: participant.reservationId,
          status: "ACCEPTED",
        },
      });

      const totalConfirmed = 1 + acceptedCount;

      if (totalConfirmed >= minP) {
        const transitionResult = await prisma.reservation.updateMany({
          where: {
            id: participant.reservationId,
            status: "PENDING",
          },
          data: { status: "CONFIRMED" },
        });

        const isInitialConfirmation =
          transitionResult.count === 1 || totalConfirmed === minP;

        handleParticipantAcceptedEmails({
          reservationId: participant.reservationId,
          acceptingUserId: user.id,
          isInitialConfirmation,
        }).catch((err) => console.error("Background email error:", err));
      }
    } else if (action === "REJECT") {
      // Davet reddedildiğinde geriye kalan maksimum potansiyel katılımcı sayısını kontrol et
      const [acceptedCount, pendingCount] = await Promise.all([
        prisma.reservationParticipant.count({
          where: { reservationId: participant.reservationId, status: "ACCEPTED" },
        }),
        prisma.reservationParticipant.count({
          where: { reservationId: participant.reservationId, status: "PENDING" },
        }),
      ]);

      const maxPotentialPeople = 1 + acceptedCount + pendingCount;

      if (maxPotentialPeople < minP && participant.reservation.status === "PENDING") {
        const cancelReasonText = `Davet edilen katılımcı (${user.email}) daveti reddettiği ve minimum ${minP} kişilik grup şartı sağlanamadığı için otomatik iptal edildi.`;

        await prisma.reservation.update({
          where: { id: participant.reservationId },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: cancelReasonText,
          },
        });

        sendReservationCancelledEmails({
          reservationId: participant.reservationId,
          cancelledByEmail: user.email,
          reason: cancelReasonText,
          wasConfirmed: false,
        }).catch((err) => console.error("Reject auto-cancel email error:", err));
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: action === "ACCEPT" ? "INVITATION_ACCEPTED" : "INVITATION_REJECTED",
        entityType: "Reservation",
        entityId: participant.reservationId,
        newData: {
          participantEmail: user.email,
          room: participant.reservation.room?.roomNumber,
          response: newStatus,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: action === "ACCEPT" ? "Davet kabul edildi." : "Davet reddedildi.",
    });
  } catch (error) {
    console.error("Invitation respond error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}