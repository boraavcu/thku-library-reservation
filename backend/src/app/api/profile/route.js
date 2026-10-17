import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

const PROFILE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  studentNumber: true,
  phone: true,
  department: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updateData = {};

    if (body.phone !== undefined) {
      const phone = body.phone?.trim() || null;
      if (phone && !PHONE_REGEX.test(phone)) {
        return NextResponse.json(
          { error: "Geçersiz telefon numarası formatı." },
          { status: 400 }
        );
      }
      updateData.phone = phone;
    }

    if (body.department !== undefined) {
      updateData.department = body.department?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Güncellenecek alan bulunamadı." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: PROFILE_SELECT,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
