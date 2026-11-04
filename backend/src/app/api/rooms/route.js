import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { runReservationLifecycleChecks } from "@/lib/lifecycle";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";
import { getIstanbulTimeDetails } from "@/lib/timeUtils";
import { getActiveReservationRules } from "@/lib/reservationPolicy";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck;

  try {
    await runReservationLifecycleChecks();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const { dateStr: todayStr } = getIstanbulTimeDetails();
    const targetDateStr = dateParam && DATE_REGEX.test(dateParam) ? dateParam : todayStr;
    const targetDateUtc = new Date(`${targetDateStr}T00:00:00.000Z`);

    const [rooms, activeReservations, rules] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        orderBy: { roomNumber: "asc" },
      }),
      prisma.reservation.findMany({
        where: {
          reservationDate: targetDateUtc,
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        },
        select: {
          id: true,
          roomId: true,
          startTime: true,
          endTime: true,
          status: true,
        },
        orderBy: { startTime: "asc" },
      }),
      getActiveReservationRules(),
    ]);

    const maxAdvanceDays = rules.maxAdvanceDays;

    const slotsByRoom = new Map();
    for (const r of activeReservations) {
      if (!slotsByRoom.has(r.roomId)) {
        slotsByRoom.set(r.roomId, []);
      }
      slotsByRoom.get(r.roomId).push({
        startTime: r.startTime,
        endTime: r.endTime,
        status: r.status,
      });
    }

    const result = rooms.map((room) => ({
      ...room,
      maxAdvanceDays,
      occupiedSlots: slotsByRoom.get(room.id) || [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rooms fetch error:", error);
    return NextResponse.json({ error: "Odalar yüklenemedi." }, { status: 500 });
  }
}
