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
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        title: true,
        content: true,
        priority: true,
        isPinned: true,
        publishedAt: true,
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 30,
    });

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Announcements GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}