import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, subscribersTable, kohortsTable, vouchersTable, activityTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  GetRevenueByAppResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  const allSubscribers = await db.select().from(subscribersTable);
  const confirmedSubs = allSubscribers.filter(s => s.paymentStatus === "confirmed");
  const pendingSubs = allSubscribers.filter(s => s.paymentStatus === "pending");

  const totalRevenue = confirmedSubs.reduce((sum, s) => sum + parseFloat(s.paymentAmount || "0"), 0);

  const activeKohorts = await db.select().from(kohortsTable).where(eq(kohortsTable.isActive, true));
  const kohortSlotsRemaining = activeKohorts.reduce((sum, k) => sum + (k.maxSlots - k.filledSlots), 0);

  const activeVouchers = await db.select().from(vouchersTable).where(eq(vouchersTable.isActive, true));

  const subscribersByApp: Record<string, number> = {};
  for (const sub of confirmedSubs) {
    if (sub.apps) {
      for (const app of sub.apps) {
        subscribersByApp[app] = (subscribersByApp[app] || 0) + 1;
      }
    }
  }

  res.json(GetDashboardStatsResponse.parse({
    totalSubscribers: allSubscribers.length,
    confirmedSubscribers: confirmedSubs.length,
    pendingSubscribers: pendingSubs.length,
    totalRevenue: totalRevenue.toFixed(2),
    kohortSlotsRemaining,
    activeVouchers: activeVouchers.length,
    subscribersByApp,
  }));
});

router.get("/recent-activity", async (req, res): Promise<void> => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 10;

  const activity = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(limit);

  res.json(GetRecentActivityResponse.parse(activity));
});

router.get("/revenue-by-app", async (_req, res): Promise<void> => {
  const confirmedSubs = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.paymentStatus, "confirmed"));

  const revenueMap: Record<string, { totalRevenue: number; subscriberCount: number }> = {};

  for (const sub of confirmedSubs) {
    if (sub.apps) {
      const perAppRevenue = parseFloat(sub.paymentAmount || "0") / sub.apps.length;
      for (const app of sub.apps) {
        if (!revenueMap[app]) {
          revenueMap[app] = { totalRevenue: 0, subscriberCount: 0 };
        }
        revenueMap[app].totalRevenue += perAppRevenue;
        revenueMap[app].subscriberCount += 1;
      }
    }
  }

  const result = Object.entries(revenueMap).map(([appName, data]) => ({
    appName,
    totalRevenue: data.totalRevenue.toFixed(2),
    subscriberCount: data.subscriberCount,
  }));

  res.json(GetRevenueByAppResponse.parse(result));
});

export default router;
