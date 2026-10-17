import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const DEFAULT_MIN = 2;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { participantId, action } = await request.json();

    if (!participantId || !["ACCEPT", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    const participant = await prisma.reservationParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, userId: true, reservationId: true, status: true },
    });

    if (!participant || participant.userId !== user.id) {
      return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
    }

    if (participant.status !== "PENDING") {
      return NextResponse.json({ error: "Bu davete zaten yanıt verilmiş." }, { status: 400 });
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

      const minRule = await prisma.reservationRule.findFirst({
        where: { ruleName: "MIN_PARTICIPANTS", isActive: true },
        select: { ruleValue: true },
      });
      const minP = minRule?.ruleValue?.value ?? DEFAULT_MIN;

      const totalConfirmed = 1 + acceptedCount;

      if (totalConfirmed >= minP) {
        await prisma.reservation.update({
          where: { id: participant.reservationId },
          data: { status: "CONFIRMED" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: action === "ACCEPT" ? "Davet kabul edildi." : "Davet reddedildi.",
    });
  } catch (error) {
    console.error("Invitation respond error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
