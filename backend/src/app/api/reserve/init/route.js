import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const DEFAULTS = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 7,
  MAX_DURATION_HOURS: 3,
  MAX_ADVANCE_DAYS: 3,
  DAILY_RELEASE_HOUR: 8,
};

const RULE_NAMES = Object.keys(DEFAULTS);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [rooms, rulesRows] = await Promise.all([
      prisma.room.findMany({
        where: { isActive: true },
        select: { id: true, roomNumber: true, name: true, capacity: true },
        orderBy: { roomNumber: "asc" },
      }),
      prisma.reservationRule.findMany({
        where: { isActive: true, ruleName: { in: RULE_NAMES } },
        select: { ruleName: true, ruleValue: true },
      }),
    ]);

    const rulesMap = Object.fromEntries(
      rulesRows.map((r) => [r.ruleName, r.ruleValue])
    );

    const val = (key) => rulesMap[key]?.value ?? DEFAULTS[key];

    const rules = {
      minParticipants: val("MIN_PARTICIPANTS"),
      maxParticipants: val("MAX_PARTICIPANTS"),
      maxDurationHours: val("MAX_DURATION_HOURS"),
      maxAdvanceDays: val("MAX_ADVANCE_DAYS"),
      dailyReleaseHour: val("DAILY_RELEASE_HOUR"),
    };

    return NextResponse.json({ rooms, rules });
  } catch (error) {
    console.error("Reserve init error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
