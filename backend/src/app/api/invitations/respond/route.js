import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { rejectIfPasswordChangeRequired } from "@/lib/passwordGate";
import { getIstanbulTimeDetails, parseReservationMinutesUTC } from "@/lib/timeUtils";
import {
  getActiveReservationRules,
  validateDailyQuotaForUsers,
  validateNightToMorningRuleForUsers,
} from "@/lib/reservationPolicy";
import {
  runReservationLifecycleChecks,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
} from "@/lib/lifecycle";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runReservationLifecycleChecks();

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
          include: {
            room: { select: { roomNumber: true, name: true, capacity: true } },
          },
        },
      },
    });

    if (!participant || participant.userId !== user.id) {
      return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
    }

    if (["CANCELLED", "NO_SHOW", "COMPLETED"].includes(participant.reservation.status)) {
      return NextResponse.json(
        { error: "Bu rezervasyon artık aktif veya geçerli değil." },
        { status: 400 }
      );
    }

    const { dateStr: todayTrStr, totalMins: nowTotalMins } = getIstanbulTimeDetails();
    const resDateStr = new Date(participant.reservation.reservationDate).toISOString().split("T")[0];
    const { startTotalMins, endTotalMins } = parseReservationMinutesUTC(participant.reservation);

    if (resDateStr < todayTrStr || (resDateStr === todayTrStr && endTotalMins <= nowTotalMins)) {
      return NextResponse.json(
        { error: "Bu rezervasyonun saat dilimi sona erdiği için davete yanıt verilemez." },
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
          cancellationReason:
            "Gönderilen davetiyeler 30 dakika içinde onaylanmadığı için otomatik iptal edildi.",
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

    const rules = await getActiveReservationRules();
    const minP = rules.minParticipants;
    const maxP = Math.min(
      participant.reservation.room?.capacity || rules.maxParticipants,
      rules.maxParticipants
    );

    if (action === "ACCEPT") {
      const currentAcceptedCount = await prisma.reservationParticipant.count({
        where: {
          reservationId: participant.reservationId,
          status: "ACCEPTED",
        },
      });

      if (1 + currentAcceptedCount >= maxP) {
        return NextResponse.json(
          { error: `Oda maksimum kapasitesine (${maxP} kişi) ulaştığı için daveti kabul edemezsiniz.` },
          { status: 400 }
        );
      }

      const targetDate = participant.reservation.reservationDate;

      const quotaCheck = await validateDailyQuotaForUsers({
        userIds: [user.id],
        creatorId: user.id,
        reservationDateObj: targetDate,
        excludeReservationId: participant.reservationId,
      });
      if (!quotaCheck.valid) {
        return NextResponse.json(
          {
            error:
              "Bu tarihte zaten aktif bir rezervasyonunuz bulunduğu için ikinci bir gruba katılamazsınız (Günlük 1 Rezervasyon Kuralı).",
          },
          { status: 400 }
        );
      }

      const nightToMorningCheck = await validateNightToMorningRuleForUsers({
        userIds: [user.id],
        reservationDateObj: targetDate,
        startTotalMins,
        endTotalMins,
      });
      if (!nightToMorningCheck.valid) {
        return NextResponse.json({ error: nightToMorningCheck.error }, { status: 400 });
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
