import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { rejectIfPasswordChangeRequired } from "@/lib/passwordGate";
import { getActiveReservationRules } from "@/lib/reservationPolicy";

export async function GET() {
  const session = await getServerSession(authOptions);
  const passwordChangeBlock = rejectIfPasswordChangeRequired(session);
  if (passwordChangeBlock) return passwordChangeBlock;
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [rooms, rules] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        select: { id: true, roomNumber: true, name: true, capacity: true },
        orderBy: { roomNumber: "asc" },
      }),
      getActiveReservationRules(),
    ]);

    return NextResponse.json({ rooms, rules });
  } catch (error) {
    console.error("Reserve init error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
