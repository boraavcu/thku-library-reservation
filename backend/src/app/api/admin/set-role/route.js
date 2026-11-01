import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const VALID_ROLES = ["STUDENT", "ADMIN", "LIBRARIAN", "SUPER_ADMIN"];

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { email, role } = await req.json();

    if (!email || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Geçersiz e-posta veya rol değeri." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { role },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await prisma.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType: "USER_ROLE_CHANGED",
        targetEntityType: "User",
        targetEntityId: updatedUser.id,
        affectedUserId: updatedUser.id,
        description: `${updatedUser.email} kullanıcısının rolü ${role} olarak güncellendi.`,
        newData: { role },
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Rol atama hatası:", error);
    return NextResponse.json({ error: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}