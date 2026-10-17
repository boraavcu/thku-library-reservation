import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import { NextResponse } from "next/server";

export async function checkRulesAcceptance() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [dbUser, activeAgreement] = await Promise.all([
    prisma.user.findUnique({
      where: { email: session.user.email },
      select: { acceptedAgreementVersion: true },
    }),
    prisma.agreement.findFirst({
      where: { isActive: true },
      select: { version: true },
    }),
  ]);

  if (
    !activeAgreement ||
    !dbUser?.acceptedAgreementVersion ||
    dbUser.acceptedAgreementVersion !== activeAgreement.version
  ) {
    return NextResponse.json(
      {
        error: "Agreement not accepted or outdated",
        requiresRulesAcceptance: true,
      },
      { status: 403 }
    );
  }

  return null;
}
