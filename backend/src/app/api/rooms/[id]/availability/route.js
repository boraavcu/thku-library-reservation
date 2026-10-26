import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { runReservationLifecycleChecks } from "@/lib/lifecycle";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Takvim açıldığında süresi dolan davet veya Kiosk randevularını anında temizle
    await runReservationLifecycleChecks();

    const resolvedParams = await Promise.resolve(params);
    const roomId = resolvedParams?.id;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!roomId || !dateStr) {
      return NextResponse.json(
        { error: "roomId ve date parametreleri gereklidir." },
        { status: 400 }
      );
    }

    const dateObj = new Date(`${dateStr}T00:00:00Z`);

    // Yalnızca aktif (PENDING, CONFIRMED, CHECKED_IN) randevular odayı dolu gösterir.
    // CANCELLED, NO_SHOW ve COMPLETED (erken boşaltılan) randevular odayı İŞGAL ETMEZ!
    const reservations = await prisma.reservation.findMany({
      where: {
        roomId,
        reservationDate: dateObj,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({
      roomId,
      date: dateStr,
      occupiedSlots: reservations,
    });
  } catch (error) {
    console.error("Room availability error:", error);
    return NextResponse.json(
      { error: "Oda müsaitlik bilgisi alınamadı." },
      { status: 500 }
    );
  }
}