import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { rejectIfPasswordChangeRequired } from "@/lib/passwordGate";
import { runReservationLifecycleChecks } from "@/lib/lifecycle";
import { getIstanbulTimeDetails, parseReservationMinutesUTC } from "@/lib/timeUtils";

export async function GET() {
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

    if (!user) {
      return NextResponse.json([]);
    }

    const { dateStr: todayTrStr, todayDate: todayDateObj, totalMins: nowTotalMins } =
      getIstanbulTimeDetails();

    const invitations = await prisma.reservationParticipant.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        reservation: {
          status: { in: ["PENDING", "CONFIRMED"] },
          reservationDate: { gte: todayDateObj },
        },
      },
      include: {
        reservation: {
          select: {
            id: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true,
            purpose: true,
            createdAt: true,
            room: {
              select: { id: true, roomNumber: true, name: true },
            },
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
      orderBy: {
        reservation: {
          reservationDate: "asc",
        },
      },
    });

    const validInvitations = invitations.filter((inv) => {
      const resDateStr = new Date(inv.reservation.reservationDate).toISOString().split("T")[0];
      if (resDateStr > todayTrStr) return true;
      if (resDateStr < todayTrStr) return false;

      const { endTotalMins } = parseReservationMinutesUTC(inv.reservation);
      return endTotalMins > nowTotalMins;
    });

    return NextResponse.json(validInvitations);
  } catch (error) {
    console.error("Invitations GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
