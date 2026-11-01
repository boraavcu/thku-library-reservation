import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { getIstanbulTimeDetails } from "@/lib/timeUtils";
import { runReservationLifecycleChecks } from "@/lib/lifecycle";
import { ADMIN_ACTION_HANDLERS } from "./handlers";

const ALLOWED_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

  if (!session?.user?.id || !ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  const canViewLogs = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

  try {
    runReservationLifecycleChecks().catch(() => {});

    const now = new Date();
    const days180Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const days365Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    await Promise.all([
      prisma.room.updateMany({
        where: { roomNumber: "R103", name: "Uçantürk" },
        data: { name: "Hürkuş" },
      }),
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: days365Ago } } }),
      prisma.adminAction.deleteMany({ where: { createdAt: { lt: days365Ago } } }),
    ]);

    const [
      rooms,
      rawReservations,
      rawUsers,
      activeNoShowPenalties,
      rules,
      announcements,
      auditLogs,
      adminActions,
      archivedAuditCount,
      archivedAdminCount,
    ] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.reservation.findMany({
        take: 250,
        orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }],
        include: {
          room: { select: { id: true, roomNumber: true, name: true, capacity: true } },
          user: { select: { id: true, fullName: true, email: true, phone: true, studentNumber: true, department: true } },
          participants: {
            include: { user: { select: { id: true, fullName: true, email: true, phone: true, department: true } } },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: [{ isBanned: "desc" }, { penaltyPoints: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          studentNumber: true,
          department: true,
          role: true,
          penaltyPoints: true,
          isBanned: true,
          banUntil: true,
          banReason: true,
        },
      }),
      prisma.penaltyHistory.findMany({
        where: { penaltyType: "NO_SHOW", isActive: true },
        select: { userId: true },
      }),
      prisma.reservationRule.findMany({ orderBy: { ruleName: "asc" } }),
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
      canViewLogs
        ? prisma.auditLog.findMany({
            where: { createdAt: { gte: days180Ago } },
            take: 150,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { fullName: true, email: true, role: true } } },
          })
        : Promise.resolve([]),
      canViewLogs
        ? prisma.adminAction.findMany({
            where: { createdAt: { gte: days180Ago } },
            take: 150,
            orderBy: { createdAt: "desc" },
            include: { admin: { select: { fullName: true, email: true, role: true } } },
          })
        : Promise.resolve([]),
      canViewLogs
        ? prisma.auditLog.count({ where: { createdAt: { gte: days365Ago, lt: days180Ago } } })
        : Promise.resolve(0),
      canViewLogs
        ? prisma.adminAction.count({ where: { createdAt: { gte: days365Ago, lt: days180Ago } } })
        : Promise.resolve(0),
    ]);

    const reservations = await Promise.all(
      rawReservations.map(async (r) => {
        let checkedInUsers = [];
        try {
          checkedInUsers = await redis.smembers(`kiosk:checked_users:${r.id}`);
        } catch {
          checkedInUsers = [];
        }
        return {
          ...r,
          checkedInUsers,
          checkedInCount: checkedInUsers.length,
        };
      })
    );

    const penaltyCountMap = {};
    for (const p of activeNoShowPenalties) {
      penaltyCountMap[p.userId] = (penaltyCountMap[p.userId] || 0) + 1;
    }

    const users = rawUsers.map((u) => ({
      ...u,
      _count: { penalties: penaltyCountMap[u.id] || 0 },
    }));

    const { dateStr: todayIsoStr, totalMins: nowTotalMins } = getIstanbulTimeDetails();

    const hourlyHeatmap = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      hourNum: h,
      count: 0,
    }));

    const deptCounts = {};
    const roomUsageMap = {};
    for (const rm of rooms) {
      roomUsageMap[rm.id] = {
        roomNumber: rm.roomNumber,
        name: rm.name,
        count: 0,
        hoursBooked: 0,
      };
    }

    let activeNowRooms = 0;
    let upcomingHourReservations = 0;
    let upcomingHourStudents = 0;
    let totalDurationHoursSum = 0;
    let totalGroupMembersSum = 0;

    const totalResCount = Math.max(1, reservations.length);
    const completedCount = reservations.filter((r) => ["COMPLETED", "CHECKED_IN", "CONFIRMED"].includes(r.status)).length;
    const cancelledCount = reservations.filter((r) => r.status === "CANCELLED").length;
    const noShowCount = reservations.filter((r) => r.status === "NO_SHOW" || r.noShow).length;

    const validReservations = reservations.filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status));

    for (const r of validReservations) {
      const sH = new Date(r.startTime).getUTCHours();
      const sM = new Date(r.startTime).getUTCMinutes();
      const endDt = new Date(r.endTime);
      const eH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
      const durationH = Math.max(1, eH - sH);

      totalDurationHoursSum += durationH;
      const acceptedMembersCount = 1 + (r.participants || []).filter((p) => p.status === "ACCEPTED").length;
      totalGroupMembersSum += acceptedMembersCount;

      if (r.room?.id && roomUsageMap[r.room.id]) {
        roomUsageMap[r.room.id].count += 1;
        roomUsageMap[r.room.id].hoursBooked += durationH;
      }

      for (let h = sH; h < eH; h++) {
        if (h >= 0 && h < 24) {
          hourlyHeatmap[h].count += 1;
        }
      }

      const orgDept = r.user?.department?.trim() || "Belirtilmemiş";
      deptCounts[orgDept] = (deptCounts[orgDept] || 0) + 1;

      for (const p of r.participants || []) {
        if (p.status === "ACCEPTED") {
          const pDept = p.user?.department?.trim() || "Belirtilmemiş";
          deptCounts[pDept] = (deptCounts[pDept] || 0) + 1;
        }
      }

      const rDateStr = new Date(r.reservationDate).toISOString().split("T")[0];
      if (rDateStr === todayIsoStr) {
        const startMins = sH * 60 + sM;
        const endMins = eH * 60;

        if (r.status === "CHECKED_IN" || (nowTotalMins >= startMins && nowTotalMins < endMins)) {
          activeNowRooms += 1;
        }

        const diffToStart = startMins - nowTotalMins;
        if (diffToStart >= 0 && diffToStart <= 60 && ["CONFIRMED", "PENDING"].includes(r.status)) {
          upcomingHourReservations += 1;
          upcomingHourStudents += acceptedMembersCount;
        }
      }
    }

    const totalDeptUsage = Object.values(deptCounts).reduce((a, b) => a + b, 0) || 1;
    const departmentBreakdown = Object.entries(deptCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalDeptUsage) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    const totalValidCount = Math.max(1, validReservations.length);
    const roomBreakdown = Object.values(roomUsageMap).map((rm) => ({
      ...rm,
      percentage: Math.round((rm.count / totalValidCount) * 100),
    }));

    const peakHourObj = [...hourlyHeatmap].sort((a, b) => b.count - a.count)[0] || {
      hour: "14:00",
      count: 0,
    };

    return NextResponse.json({
      rooms,
      reservations,
      users,
      rules,
      announcements,
      auditLogs,
      adminActions,
      logRetentionPolicy: {
        activeDisplayDays: 180,
        archiveRetentionDays: 365,
        archivedRecordsCount: archivedAuditCount + archivedAdminCount,
      },
      analytics: {
        hourlyHeatmap,
        departmentBreakdown,
        roomBreakdown,
        peakHour: peakHourObj.hour,
        activeNowRooms,
        upcomingHourReservations,
        upcomingHourStudents,
        avgDurationHours: (totalDurationHoursSum / totalValidCount).toFixed(1),
        avgGroupSize: (totalGroupMembersSum / totalValidCount).toFixed(1),
        completionRate: Math.round((completedCount / totalResCount) * 100),
        cancellationRate: Math.round((cancelledCount / totalResCount) * 100),
        noShowRate: Math.round((noShowCount / totalResCount) * 100),
        completedCount,
        cancelledCount,
        noShowCount,
      },
    });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json({ error: "Veriler alınamadı." }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const currentRole = session?.user?.role;
  const adminId = session?.user?.id;

  if (!adminId || !ALLOWED_ROLES.includes(currentRole)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, payload } = body;

    const handler = ADMIN_ACTION_HANDLERS[action];
    if (!handler) {
      return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
    }

    return await handler({ payload, adminId, currentRole, session });
  } catch (error) {
    console.error("Admin POST error:", error);
    return NextResponse.json({ error: "İşlem sırasında hata oluştu." }, { status: 500 });
  }
}