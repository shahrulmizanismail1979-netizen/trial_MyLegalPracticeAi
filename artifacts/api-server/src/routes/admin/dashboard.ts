import { Router, type IRouter } from "express";
import { eq, desc, inArray, and } from "drizzle-orm";
import { db, subscribersTable, kohortsTable, vouchersTable, activityTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  GetRevenueByAppResponse,
  GetDeliveryFailuresResponse,
  ResolveDeliveryFailureResponse,
  ResendDeliveryFailureEmailResponse,
  ResendDeliveryFailureSmsResponse,
} from "@workspace/api-zod";
import { resendAccessCodeEmail, resendAccessCodeSms } from "../../lib/provisioning";

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

const DELIVERY_FAILURE_TYPES = ["sms_failed", "sms_skipped", "email_failed"] as const;

type FailureMeta = {
  accessCode?: string | null;
  email?: string | null;
  phone?: string | null;
  resolved?: boolean;
  resolvedAt?: string | null;
};

function parseFailureMeta(row: { description: string; metadata: string | null }): FailureMeta {
  let meta: FailureMeta = {};
  if (row.metadata) {
    try {
      meta = JSON.parse(row.metadata) as FailureMeta;
    } catch {
      meta = {};
    }
  }
  // Older rows have no metadata — best-effort recovery from the description.
  if (!meta.accessCode) {
    const m = row.description.match(/access code ([A-Za-z0-9-]+)/i);
    if (m) meta.accessCode = m[1];
  }
  if (!meta.email) {
    const m = row.description.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (m) meta.email = m[0];
  }
  if (!meta.phone) {
    const m = row.description.match(/(?:to|for) (\+?\d[\d\s-]{6,})/);
    if (m) meta.phone = m[1].trim();
  }
  return meta;
}

function toDeliveryFailure(row: {
  id: number;
  type: string;
  description: string;
  metadata: string | null;
  createdAt: Date;
}) {
  const meta = parseFailureMeta(row);
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    accessCode: meta.accessCode ?? null,
    email: meta.email ?? null,
    phone: meta.phone ?? null,
    resolved: meta.resolved === true,
    resolvedAt: meta.resolvedAt ?? null,
    createdAt: row.createdAt,
  };
}

router.get("/delivery-failures", async (req, res): Promise<void> => {
  // NOTE: don't use zod coerce.boolean here — it treats the string "false"
  // (which the generated client sends) as truthy. Parse the literal instead.
  const includeResolved = req.query.includeResolved === "true";

  const rows = await db
    .select()
    .from(activityTable)
    .where(inArray(activityTable.type, [...DELIVERY_FAILURE_TYPES]))
    .orderBy(desc(activityTable.createdAt));

  const failures = rows.map(toDeliveryFailure).filter((f) => includeResolved || !f.resolved);
  res.json(GetDeliveryFailuresResponse.parse(failures));
});

router.post("/delivery-failures/:id/resolve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.id, id), inArray(activityTable.type, [...DELIVERY_FAILURE_TYPES])));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const meta = parseFailureMeta(row);
  const updatedMeta = { ...meta, resolved: true, resolvedAt: new Date().toISOString() };
  const [updated] = await db
    .update(activityTable)
    .set({ metadata: JSON.stringify(updatedMeta) })
    .where(eq(activityTable.id, id))
    .returning();
  res.json(ResolveDeliveryFailureResponse.parse(toDeliveryFailure(updated)));
});

router.post("/delivery-failures/:id/resend-email", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.id, id), inArray(activityTable.type, [...DELIVERY_FAILURE_TYPES])));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const meta = parseFailureMeta(row);
  if (!meta.email || !meta.accessCode) {
    res.status(422).json({
      error: "This entry is missing the buyer's email or access code — send manually instead",
    });
    return;
  }
  const sent = await resendAccessCodeEmail({ accessCode: meta.accessCode, email: meta.email });
  if (!sent) {
    res.status(502).json({ error: `Email to ${meta.email} failed to send — try again or send manually` });
    return;
  }
  const updatedMeta = { ...meta, resolved: true, resolvedAt: new Date().toISOString() };
  const [updated] = await db
    .update(activityTable)
    .set({ metadata: JSON.stringify(updatedMeta) })
    .where(eq(activityTable.id, id))
    .returning();
  res.json(ResendDeliveryFailureEmailResponse.parse(toDeliveryFailure(updated)));
});

router.post("/delivery-failures/:id/resend-sms", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.id, id), inArray(activityTable.type, [...DELIVERY_FAILURE_TYPES])));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const meta = parseFailureMeta(row);
  if (!meta.phone || !meta.accessCode) {
    res.status(422).json({
      error: "This entry is missing the buyer's phone number or access code — send manually instead",
    });
    return;
  }
  const result = await resendAccessCodeSms({ accessCode: meta.accessCode, phone: meta.phone });
  if (result === "not_configured") {
    res.status(422).json({
      error: "SMS is not configured (Twilio secrets missing) — add them or send manually",
    });
    return;
  }
  if (result === "failed") {
    res.status(502).json({ error: `SMS to ${meta.phone} failed to send — try again or send manually` });
    return;
  }
  const updatedMeta = { ...meta, resolved: true, resolvedAt: new Date().toISOString() };
  const [updated] = await db
    .update(activityTable)
    .set({ metadata: JSON.stringify(updatedMeta) })
    .where(eq(activityTable.id, id))
    .returning();
  res.json(ResendDeliveryFailureSmsResponse.parse(toDeliveryFailure(updated)));
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
