// backend/src/app/api/rooms/route.js
import { NextResponse } from "next/server";
import  prisma  from "@/lib/db";
import { checkRulesAcceptance } from "@/middleware/checkRulesAcceptance";

export async function GET(request) {
  // ✅ Middleware kontrolü
  const rulesCheck = await checkRulesAcceptance(request);
  if (rulesCheck) return rulesCheck; // Hata varsa dön

  // Normal işlem devam eder
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
