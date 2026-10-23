import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email.trim().toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json([]);
    }

    const { dateStr: todayTrStr, hour: curH, minute: curM } = getIstanbulNow();
    const todayDateObj = new Date(`${todayTrStr}T00:00:00Z`);
    const nowTotalMins = curH * 60 + curM;

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

      const endDt = new Date(res.endTime);
      const endH =
        endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59
          ? 24
          : endDt.getUTCHours();
      const endM = endH === 24 ? 0 : endDt.getUTCMinutes();
      const endTotalMins = endH * 60 + endM;

      return endTotalMins > nowTotalMins;
    });

    return NextResponse.json(activeReservations);
  } catch (error) {
    console.error("Active reservations GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}