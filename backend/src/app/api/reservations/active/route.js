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

    const reservationSelect = {
      id: true,
      reservationDate: true,
      startTime: true,
      endTime: true,
      status: true,
      purpose: true,
      checkedInAt: true,
      room: { select: { roomNumber: true, name: true } },
      user: { select: { id: true, fullName: true, email: true } },
      participants: {
        select: {
          status: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    };

    const [created, participating] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          userId: user.id,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        },
        select: reservationSelect,
        orderBy: { reservationDate: "asc" },
      }),
      prisma.reservation.findMany({
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          participants: {
            some: {
              userId: user.id,
              status: "ACCEPTED",
            },
          },
          NOT: { userId: user.id },
        },
        select: reservationSelect,
        orderBy: { reservationDate: "asc" },
      }),
    ]);

    const seen = new Set();
    const merged = [...created, ...participating].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    merged.sort((a, b) => new Date(a.reservationDate) - new Date(b.reservationDate));

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Active reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}