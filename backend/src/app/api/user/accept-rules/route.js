import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Yetkisiz Erişim" }, { status: 401 });
  }

  try {
    const activeAgreement = await prisma.agreement.findFirst({
      where: { isActive: true },
      select: { version: true },
    });

    if (!activeAgreement) {
      return NextResponse.json(
        { error: "Aktif sözleşme bulunamadı" },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { acceptedAgreementVersion: activeAgreement.version },
    });

    return NextResponse.json({
      success: true,
      message: "Sözleşme kabul edildi.",
      acceptedVersion: activeAgreement.version,
    });
  } catch (error) {
    console.error("Sözleşme kabul hatası:", error);
    return NextResponse.json({ error: "Veritabanı hatası" }, { status: 500 });
  }
}
