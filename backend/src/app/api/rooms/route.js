import { NextResponse } from "next/server";
import  prisma  from "@/lib/db";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";

export async function GET(request) {
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck; 

  try {
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      orderBy: { roomNumber: 'asc' }
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Rooms fetch error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
