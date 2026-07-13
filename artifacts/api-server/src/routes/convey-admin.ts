import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { aiUsageTable, usersTable } from "@workspace/db/schema";
import { sql, desc, eq, count, sum, avg } from "drizzle-orm";
import { generateAccessCode } from "../lib/access";

const router: IRouter = Router();

// Fail closed in production: without an ADMIN_PASSWORD secret the admin
// endpoints are disabled entirely. The insecure default only exists for
// local development and tests.
const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD: string | null =
  process.env.ADMIN_PASSWORD || (IS_PROD ? null : "admin2024");

if (!ADMIN_PASSWORD) {
  logger.error(
    "ADMIN_PASSWORD is not set — convey admin endpoints are disabled until it is configured",
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
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }
  const authHeader = req.headers["x-admin-token"];
  if (authHeader !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/convey-admin/auth", (req, res) => {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
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

router.post("/convey-admin/change-password", requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  res.json({ success: true, message: "Password change would require an environment variable update. Current session remains valid." });
});

export default router;
