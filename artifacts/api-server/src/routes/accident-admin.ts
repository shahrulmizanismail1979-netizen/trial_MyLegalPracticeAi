import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { accessCodesTable, accessCodeUsageTable } from "@workspace/db/schema";
import {
  AccidentAdminLoginBody,
  AccidentAdminLoginResponse,
  AccidentAdminCheckResponse,
  AccidentListAccessCodesResponse,
  AccidentCreateAccessCodeBody,
  AccidentDeleteAccessCodeParams,
  AccidentUpdateAccessCodeParams,
  AccidentUpdateAccessCodeBody,
  AccidentUpdateAccessCodeResponse,
  AccidentGetAdminDashboardResponse,
} from "@workspace/api-zod";
import crypto from "crypto";
import { logger } from "../lib/logger";
import {
  isAdminCredential,
  isAdminCredentialConfigured,
} from "../lib/masterAccess";

const router: IRouter = Router();

if (!isAdminCredentialConfigured()) {
  logger.error(
    "ADMIN_PASSWORD and MASTER_ACCESS_CODE are not set — MyAccidentAI admin endpoints are disabled until one is configured",
  );
}

const adminTokens = new Set<string>();

function isAdmin(req: { cookies?: Record<string, string> }): boolean {
  const token = req.cookies?.admin_session;
  return !!token && adminTokens.has(token);
}

router.post("/admin/login", async (req, res): Promise<void> => {
  if (!isAdminCredentialConfigured()) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }

  const parsed = AccidentAdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!isAdminCredential(parsed.data.password)) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.add(token);

  res.cookie("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });

  res.json(AccidentAdminLoginResponse.parse({ message: "Admin authenticated" }));
});

router.get("/admin/check", async (req, res): Promise<void> => {
  res.json(AccidentAdminCheckResponse.parse({ isAdmin: isAdmin(req) }));
});

router.get("/admin/codes", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const codes = await db
    .select()
    .from(accessCodesTable)
    .orderBy(desc(accessCodesTable.createdAt));

  res.json(AccidentListAccessCodesResponse.parse(codes));
});

router.post("/admin/codes", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const parsed = AccidentCreateAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = (parsed.data.code || crypto.randomBytes(4).toString("hex"))
    .trim()
    .toUpperCase();

  try {
    const [created] = await db
      .insert(accessCodesTable)
      .values({
        code,
        label: parsed.data.label,
        maxUsers: parsed.data.maxUsers,
        isActive: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning();

    res.status(201).json(AccidentUpdateAccessCodeResponse.parse(created));
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "An access code with this value already exists" });
      return;
    }
    throw err;
  }
});

router.patch("/admin/codes/:id", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const params = AccidentUpdateAccessCodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AccidentUpdateAccessCodeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.isActive !== undefined) updateData.isActive = body.data.isActive;
  if (body.data.maxUsers !== undefined) updateData.maxUsers = body.data.maxUsers;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(accessCodesTable)
    .set(updateData)
    .where(eq(accessCodesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Access code not found" });
    return;
  }

  res.json(AccidentUpdateAccessCodeResponse.parse(updated));
});

router.delete("/admin/codes/:id", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const params = AccidentDeleteAccessCodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(accessCodeUsageTable)
    .where(eq(accessCodeUsageTable.accessCodeId, params.data.id));

  const [deleted] = await db
    .delete(accessCodesTable)
    .where(eq(accessCodesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Access code not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/admin/dashboard", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const allCodes = await db.select().from(accessCodesTable);
  const totalCodes = allCodes.length;
  const activeCodes = allCodes.filter((c) => c.isActive).length;

  const usageRows = await db
    .select({
      codeLabel: accessCodesTable.label,
      sessionId: accessCodeUsageTable.sessionId,
      usedAt: accessCodeUsageTable.usedAt,
    })
    .from(accessCodeUsageTable)
    .innerJoin(
      accessCodesTable,
      eq(accessCodeUsageTable.accessCodeId, accessCodesTable.id),
    )
    .orderBy(desc(accessCodeUsageTable.usedAt))
    .limit(20);

  const totalUsage = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessCodeUsageTable);

  res.json(
    AccidentGetAdminDashboardResponse.parse({
      totalCodes,
      activeCodes,
      totalUsage: totalUsage[0]?.count || 0,
      recentUsage: usageRows,
    }),
  );
});

export default router;
