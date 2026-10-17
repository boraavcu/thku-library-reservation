import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const invitations = await prisma.reservationParticipant.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        reservation: {
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      },
      select: {
        id: true,
        status: true,
        reservation: {
          select: {
            id: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true,
            purpose: true,
            room: { select: { roomNumber: true, name: true } },
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { reservation: { reservationDate: "asc" } },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Invitations fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}