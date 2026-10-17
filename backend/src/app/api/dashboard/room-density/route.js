import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const LIBRARY_OPEN = 8;
const LIBRARY_CLOSE = 22;
const TOTAL_HOURS = LIBRARY_CLOSE - LIBRARY_OPEN;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Türkiye saat dilimine göre YYYY-MM-DD formatında bugünün tarihini al
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Istanbul",
    });
    const todayDate = new Date(todayStr);

    const [rooms, reservations] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        select: { id: true, roomNumber: true, name: true, capacity: true },
        orderBy: { roomNumber: "asc" },
      }),
      prisma.reservation.findMany({
        where: {
          reservationDate: todayDate,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
        },
        select: { roomId: true, startTime: true, endTime: true },
      }),
    ]);

    const roomMap = new Map();
    for (const r of reservations) {
      const start = new Date(r.startTime).getUTCHours();
      const end = new Date(r.endTime).getUTCHours();
      const hours = Math.max(0, end - start);
      roomMap.set(r.roomId, (roomMap.get(r.roomId) || 0) + hours);
    }

    let totalOccupancy = 0;
    const data = rooms.map((room) => {
      const bookedHours = roomMap.get(room.id) || 0;
      const pct = Math.min(Math.round((bookedHours / TOTAL_HOURS) * 100), 100);
      totalOccupancy += pct;
      return {
        roomNumber: room.roomNumber,
        name: room.name,
        bookedHours,
        totalHours: TOTAL_HOURS,
        occupancyPercent: pct,
      };
    });

    const averageOccupancy =
      rooms.length > 0 ? Math.round(totalOccupancy / rooms.length) : 0;

    return NextResponse.json({ rooms: data, averageOccupancy });
  } catch (error) {
    console.error("Room density error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}