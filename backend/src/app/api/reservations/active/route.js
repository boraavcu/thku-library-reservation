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

    const reservations = await prisma.reservation.findMany({
      where: {
        reservationDate: { gte: todayDateObj },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          { userId: user.id },
          {
            participants: {
              some: {
                userId: user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
        participants: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
    });

    const activeReservations = reservations.filter((res) => {
      const resDateStr = new Date(res.reservationDate).toISOString().split("T")[0];
      if (resDateStr > todayTrStr) return true;
      if (resDateStr < todayTrStr) return false;

      const { endTotalMins } = parseReservationMinutesUTC(res);
      return endTotalMins > nowTotalMins;
    });

    return NextResponse.json(activeReservations);
  } catch (error) {
    console.error("Active reservations GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
