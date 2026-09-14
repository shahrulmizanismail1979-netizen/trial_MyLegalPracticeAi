import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { aiUsageTable, usersTable } from "@workspace/db/schema";
import { sql, desc, eq, or, count, sum, avg } from "drizzle-orm";
import { generateAccessCode } from "../lib/access";
import {
  isAdminCredential,
  isAdminCredentialConfigured,
} from "../lib/masterAccess";

const router: IRouter = Router();

if (!isAdminCredentialConfigured()) {
  logger.error(
    "ADMIN_PASSWORD and MASTER_ACCESS_CODE are not set — convey admin endpoints are disabled until one is configured",
  );
}

// Generate an access code guaranteed unique against the users table.
async function uniqueAccessCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateAccessCode();
    const clash = await db.select().from(usersTable).where(eq(usersTable.accessCode, code));
    if (clash.length === 0) return code;
  }
  throw new Error("Could not generate a unique access code");
}

function requireAdmin(req: any, res: any, next: any) {
  if (!isAdminCredentialConfigured()) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }
  const authHeader = req.headers["x-admin-token"];
  if (!isAdminCredential(authHeader)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/convey-admin/auth", (req, res) => {
  if (!isAdminCredentialConfigured()) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }
  const { password } = req.body;
  if (isAdminCredential(password)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid admin password" });
  }
});

router.get("/convey-admin/stats", requireAdmin, async (_req, res) => {
  try {
    const totalQueries = await db.select({ count: count() }).from(aiUsageTable);

    const toolBreakdown = await db
      .select({
        tool: aiUsageTable.tool,
        count: count(),
        avgDuration: avg(aiUsageTable.durationMs),
        totalInputChars: sum(aiUsageTable.inputLength),
        totalOutputChars: sum(aiUsageTable.outputLength),
      })
      .from(aiUsageTable)
      .groupBy(aiUsageTable.tool)
      .orderBy(desc(count()));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayQueries = await db
      .select({ count: count() })
      .from(aiUsageTable)
      .where(sql`${aiUsageTable.createdAt} >= ${todayStart}`);

    const last7days = new Date();
    last7days.setDate(last7days.getDate() - 7);
    const dailyUsage = await db
      .select({
        date: sql<string>`DATE(${aiUsageTable.createdAt})`.as("date"),
        count: count(),
      })
      .from(aiUsageTable)
      .where(sql`${aiUsageTable.createdAt} >= ${last7days}`)
      .groupBy(sql`DATE(${aiUsageTable.createdAt})`)
      .orderBy(sql`DATE(${aiUsageTable.createdAt})`);

    const recentLogs = await db
      .select()
      .from(aiUsageTable)
      .orderBy(desc(aiUsageTable.createdAt))
      .limit(50);

    const totalUsers = await db.select({ count: count() }).from(usersTable);

    res.json({
      totalQueries: totalQueries[0]?.count ?? 0,
      todayQueries: todayQueries[0]?.count ?? 0,
      totalUsers: totalUsers[0]?.count ?? 0,
      toolBreakdown,
      dailyUsage,
      recentLogs,
    });
  } catch (error) {
    logger.error({ err: error }, "Convey admin stats error");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/convey-admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        accessCode: usersTable.accessCode,
        email: usersTable.email,
        displayName: usersTable.displayName,
        role: usersTable.role,
        isActive: usersTable.isActive,
        subscriptionTier: usersTable.subscriptionTier,
        subscriptionStatus: usersTable.subscriptionStatus,
        grandfathered: usersTable.grandfathered,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json({ users });
  } catch (error) {
    logger.error({ err: error }, "Convey list users error");
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/convey-admin/users", requireAdmin, async (req, res) => {
  const { email, displayName, role } = req.body;
  if (!displayName) {
    res.status(400).json({ error: "Display name is required" });
    return;
  }
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }
  try {
    if (mail) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.email, mail));
      if (existing.length > 0) {
        res.status(409).json({ error: "An account already exists for that email" });
        return;
      }
    }
    const accessCode = await uniqueAccessCode();
    const [user] = await db.insert(usersTable).values({
      accessCode,
      email: mail || null,
      displayName,
      role: role || "user",
      isActive: true,
    }).returning({
      id: usersTable.id,
      accessCode: usersTable.accessCode,
      email: usersTable.email,
      displayName: usersTable.displayName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });
    res.json({ success: true, user });
  } catch (error) {
    logger.error({ err: error }, "Convey create user error");
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/convey-admin/users/:id/toggle", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [updated] = await db.update(usersTable)
      .set({ isActive: !users[0].isActive })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        accessCode: usersTable.accessCode,
        isActive: usersTable.isActive,
      });
    res.json({ success: true, user: updated });
  } catch (error) {
    logger.error({ err: error }, "Convey toggle user error");
    res.status(500).json({ error: "Failed to toggle user" });
  }
});

router.patch("/convey-admin/users/:id/reset-password", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const accessCode = await uniqueAccessCode();
    await db.update(usersTable).set({ accessCode }).where(eq(usersTable.id, id));
    res.json({ success: true, accessCode });
  } catch (error) {
    logger.error({ err: error }, "Convey regenerate access code error");
    res.status(500).json({ error: "Failed to regenerate access code" });
  }
});

router.delete("/convey-admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (users[0].role === "admin") {
      const adminCount = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "admin"));
      if ((adminCount[0]?.count ?? 0) <= 1) {
        res.status(400).json({ error: "Cannot delete the last admin user" });
        return;
      }
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Convey delete user error");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// One-time bulk import of legacy MyConveyAI accounts (exported from the old
// project). Idempotent: rows matching an existing access code, username, or
// email are skipped; nothing is updated or deleted. Old admin/master rows and
// Stripe IDs are never imported. Mirrors scripts/src/import-convey-users.ts
// so the same import can run against production through the deployed app.
router.post("/convey-admin/import-users", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  const rows: unknown = body.users;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Body must be { users: [...] } with at least one row" });
    return;
  }
  if (rows.length > 1000) {
    res.status(400).json({ error: "Too many rows (max 1000 per request)" });
    return;
  }

  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" || s === "NULL" || s === "\\N" ? null : s;
  };
  const bool = (v: unknown, dflt: boolean): boolean => {
    if (typeof v === "boolean") return v;
    const s = String(v ?? "").trim().toLowerCase();
    if (["t", "true", "1", "yes"].includes(s)) return true;
    if (["f", "false", "0", "no"].includes(s)) return false;
    return dflt;
  };
  const date = (v: unknown): Date | null => {
    const s = str(v);
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  let imported = 0;
  let skippedExisting = 0;
  let skippedAdmin = 0;
  let skippedInvalid = 0;
  let updatedPasswords = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  try {
    for (const [idx, raw] of rows.entries()) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const get = (camel: string, snake: string) => r[camel] ?? r[snake];

      const role = str(get("role", "role")) || "user";
      if (role === "admin") {
        skippedAdmin++;
        continue;
      }

      const accessCode = str(get("accessCode", "access_code"));
      const username = str(get("username", "username"));
      const passwordHash = str(get("passwordHash", "password_hash"));
      const email = str(get("email", "email"));

      if (!accessCode && !(username && passwordHash)) {
        skippedInvalid++;
        errors.push(`row ${idx + 1}: no access code and no username+password hash`);
        continue;
      }

      const keys = [accessCode && `c:${accessCode}`, username && `u:${username.toLowerCase()}`].filter(
        Boolean,
      ) as string[];
      if (keys.some((k) => seen.has(k))) {
        skippedInvalid++;
        errors.push(`row ${idx + 1}: duplicate access code or username within the request`);
        continue;
      }
      keys.forEach((k) => seen.add(k));

      const conditions = [];
      if (accessCode) conditions.push(eq(usersTable.accessCode, accessCode));
      if (username) conditions.push(eq(usersTable.username, username));
      if (email) conditions.push(eq(usersTable.email, email));
      const existing = await db
        .select({ id: usersTable.id, passwordHash: usersTable.passwordHash, username: usersTable.username })
        .from(usersTable)
        .where(or(...conditions))
        .limit(1);
      if (existing.length > 0) {
        // Fill in a missing password hash on an already-imported account
        // (follow-up export that includes password_hash). Never overwrite one.
        if (passwordHash && !existing[0].passwordHash) {
          await db
            .update(usersTable)
            .set({
              passwordHash,
              ...(username && !existing[0].username ? { username } : {}),
            })
            .where(eq(usersTable.id, existing[0].id));
          updatedPasswords++;
        } else {
          skippedExisting++;
        }
        continue;
      }

      const displayName =
        str(get("displayName", "display_name")) || username || email || accessCode || `Legacy user ${idx + 1}`;
      const createdAt = date(get("createdAt", "created_at"));

      try {
        await db.insert(usersTable).values({
          accessCode,
          email,
          username,
          passwordHash,
          displayName,
          role: "user",
          isActive: bool(get("isActive", "is_active"), true),
          grandfathered: bool(get("grandfathered", "grandfathered"), false),
          subscriptionTier: str(get("subscriptionTier", "subscription_tier")) || "free",
          subscriptionStatus: str(get("subscriptionStatus", "subscription_status")),
          currentPeriodEnd: date(get("currentPeriodEnd", "current_period_end")),
          ...(createdAt ? { createdAt } : {}),
          lastLoginAt: date(get("lastLoginAt", "last_login_at")),
        });
        imported++;
      } catch (e) {
        skippedInvalid++;
        errors.push(`row ${idx + 1}: insert failed — ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    logger.info(
      { total: rows.length, imported, updatedPasswords, skippedExisting, skippedAdmin, skippedInvalid },
      "Legacy user import completed",
    );
    res.json({
      success: true,
      total: rows.length,
      imported,
      updatedPasswords,
      skippedExisting,
      skippedAdmin,
      skippedInvalid,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    logger.error({ err: error }, "Convey import users error");
    res.status(500).json({ error: "Import failed" });
  }
});

router.post("/convey-admin/change-password", requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  res.json({ success: true, message: "Password change would require an environment variable update. Current session remains valid." });
});

export default router;
