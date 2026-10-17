import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const activeAgreement = await prisma.agreement.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        content: true,
        version: true,
        createdAt: true,
      },
    });

    if (!activeAgreement) {
      return NextResponse.json(
        { error: "No active agreement found" },
        { status: 404 }
      );
    }

    return NextResponse.json(activeAgreement);
  } catch (error) {
    console.error("Agreement fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
