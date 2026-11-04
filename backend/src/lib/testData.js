import prisma from "@/lib/db";

export async function purgeDemoTestData(adminId) {
  const demoUsers = await prisma.user.findMany({
    where: {
      email: { endsWith: "@demo.local" },
      NOT: { id: adminId },
    },
    select: { id: true, email: true },
  });
  const ids = demoUsers.map((user) => user.id);
  if (ids.length === 0) {
    return { ok: true, status: 200, deletedUsers: 0, deletedReservations: 0 };
  }

  const ownedReservations = await prisma.reservation.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const reservationIds = ownedReservations.map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    if (reservationIds.length > 0) {
      await tx.penaltyHistory.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }
    await tx.reservationParticipant.deleteMany({ where: { userId: { in: ids } } });
    await tx.reservation.updateMany({
      where: { checkedInById: { in: ids } },
      data: { checkedInById: null },
    });
    await tx.adminAction.deleteMany({ where: { adminId: { in: ids } } });
    await tx.adminAction.updateMany({
      where: { affectedUserId: { in: ids } },
      data: { affectedUserId: null },
    });
    await tx.auditLog.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await tx.emailQueue.deleteMany({ where: { to: { endsWith: "@demo.local" } } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
    await tx.adminAction.create({
      data: {
        adminId,
        actionType: "BULK_OPERATION",
        targetEntityType: "User",
        description: `${ids.length} demo.local test hesabı ve bu hesapların açtığı ${reservationIds.length} rezervasyon silindi. Kurumsal hesaplar, odalar ve kurallar duruyor.`,
        newData: { deletedUsers: ids.length, deletedReservations: reservationIds.length },
      },
    });
  });

  return {
    ok: true,
    status: 200,
    deletedUsers: ids.length,
    deletedReservations: reservationIds.length,
  };
}
