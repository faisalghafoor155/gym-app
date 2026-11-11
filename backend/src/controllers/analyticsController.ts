import type { Response } from "express";
import prisma from "../db.js";
import type { AuthedRequest } from "../types.js";
import { memberStatusWhere } from "../services/membership.js";
import { GYM_TIME_ZONE, gymDay, gymDayBounds } from "../services/dates.js";

const DAY = 24 * 60 * 60 * 1000;

export const getAttendanceAnalytics = async (
  req: AuthedRequest,
  res: Response,
): Promise<void> => {
  try {
    const gymId = req.gymId;

    // Last 30 days, pre-populated with 0 so quiet days still show. Keyed by the
    // gym's own calendar day, the same one `checkedInOn` is computed in.
    const now = new Date();
    const today = gymDay(now);
    const thirtyDaysAgo = new Date(gymDayBounds(now).start.getTime() - 29 * DAY);

    const dailyCountsMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const dateStr = new Date(today.getTime() - i * DAY).toISOString().split("T")[0];
      dailyCountsMap.set(dateStr, 0);
    }

    const dailyAttendanceRaw = await prisma.attendance.groupBy({
      by: ["checkedInOn"],
      where: {
        gymId,
        checkedInAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        checkedInOn: "asc",
      },
    });

    dailyAttendanceRaw.forEach((row) => {
      const dateStr = row.checkedInOn.toISOString().split("T")[0];
      if (dailyCountsMap.has(dateStr)) {
        dailyCountsMap.set(dateStr, row._count._all);
      }
    });

    const dailyTrends = Array.from(dailyCountsMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // Peak hours in the gym's own clock, not the server's: on a cloud host the
    // server's zone is UTC and the evening rush would read as early afternoon.
    const peakHoursRaw = await prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM "checkedInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${GYM_TIME_ZONE})::int as hour, COUNT(*)::bigint as count
      FROM "Attendance"
      WHERE "gymId" = ${gymId}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const hourlyCounts = new Array(24).fill(0);
    peakHoursRaw.forEach((row) => {
      const hour = row.hour;
      if (hour >= 0 && hour < 24) {
        hourlyCounts[hour] = Number(row.count);
      }
    });

    const peakHours = hourlyCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count,
    }));

    // General stats: active members (using same criteria as members page) & today's checkins

    const [activeMembersCount, todayCheckinsCount] = await Promise.all([
      prisma.member.count({
        where: {
          gymId,
          ...memberStatusWhere("active"),
        },
      }),
      prisma.attendance.count({
        where: {
          gymId,
          checkedInOn: today,
        },
      }),
    ]);

    const attendanceRate =
      activeMembersCount > 0
        ? Math.round((todayCheckinsCount / activeMembersCount) * 100)
        : 0;

    res.json({
      dailyTrends,
      peakHours,
      stats: {
        activeMembers: activeMembersCount,
        todayCheckins: todayCheckinsCount,
        attendanceRate,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
