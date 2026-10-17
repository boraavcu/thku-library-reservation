import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: roomId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!roomId || !date) {
    return NextResponse.json({ error: "roomId and date are required" }, { status: 400 });
  }

  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        roomId,
        reservationDate: new Date(date),
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        startTime: true,
        endTime: true,
        status: true,
      },
      orderBy: { startTime: "asc" },
    });

    const slots = reservations.map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
    }));

    return NextResponse.json({ roomId, date, occupiedSlots: slots });
  } catch (error) {
    console.error("Availability fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
