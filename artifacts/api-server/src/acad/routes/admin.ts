import { db } from "@workspace/db";
import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import {
  usersTable,
  examTemplatesTable,
  examSessionsTable,
  questionBankTable,
  studioAssessmentsTable,
  studioAttemptsTable,
} from "@workspace/db/acad";
import { eq, sql, desc } from "drizzle-orm";
import {
  requireAdminUser,
  hashPassword,
  toSafeUser,
  getRouteUser,
} from "../lib/auth";
import { getExamAiUsage } from "../lib/ai";
import { getStudioAiUsage } from "../lib/studio-ai";

const router: Router = Router();

/** Express's req.params types entries as `string | string[]`. Narrow it. */
function pathId(req: Request): string {
  const v = req.params["id"];
  return typeof v === "string" ? v : "";
}

// Lock the entire /admin/* surface to admin users.
router.use("/admin", requireAdminUser());

router.get("/admin/users", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json({ users: rows.map(toSafeUser) });
});

router.patch(
  "/admin/users/:id",
  async (req: Request, res: Response): Promise<void> => {
    const me = getRouteUser(res);
    const id = pathId(req);
    const body = (req.body ?? {}) as { role?: unknown; status?: unknown };

    const patch: { role?: string; status?: string } = {};
    if (typeof body.role === "string") {
      if (body.role !== "teacher" && body.role !== "admin") {
        res.status(400).json({ error: "role must be 'teacher' or 'admin'" });
        return;
      }
      patch.role = body.role;
    }
    if (typeof body.status === "string") {
      if (body.status !== "active" && body.status !== "suspended") {
        res
          .status(400)
          .json({ error: "status must be 'active' or 'suspended'" });
        return;
      }
      patch.status = body.status;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    if (id === me.id) {
      // Don't let the only admin demote/suspend themselves out of access.
      if (patch.role === "teacher" || patch.status === "suspended") {
        res.status(400).json({
          error:
            "You can't demote or suspend your own admin account. Promote another admin first.",
        });
        return;
      }
    }

    const updated = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: toSafeUser(updated[0]!) });
  },
);

router.post(
  "/admin/users/:id/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    const id = pathId(req);
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Generate a 16-char URL-safe temp password.
    const tempPassword = randomBytes(12).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, id));
    // Returned to the admin once — the admin must hand it to the user.
    res.json({ tempPassword });
  },
);

router.delete(
  "/admin/users/:id",
  async (req: Request, res: Response): Promise<void> => {
    const me = getRouteUser(res);
    const id = pathId(req);
    if (id === me.id) {
      res.status(400).json({ error: "You can't delete your own account." });
      return;
    }
    const deleted = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Templates owned by this user become orphaned (creator_user_id stays
    // pointing at the deleted id but the FK is informational; admins can
    // still see and delete them via /admin/exam-templates).
    res.json({ ok: true });
  },
);

router.get(
  "/admin/exam-templates",
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select({
        id: examTemplatesTable.id,
        code: examTemplatesTable.code,
        title: examTemplatesTable.title,
        examinerName: examTemplatesTable.examinerName,
        creatorUserId: examTemplatesTable.creatorUserId,
        creatorEmail: usersTable.email,
        creatorName: usersTable.name,
        appSlugs: examTemplatesTable.appSlugs,
        totalQuestions: examTemplatesTable.totalQuestions,
        difficulty: examTemplatesTable.difficulty,
        timeLimitMinutes: examTemplatesTable.timeLimitMinutes,
        status: examTemplatesTable.status,
        createdAt: examTemplatesTable.createdAt,
      })
      .from(examTemplatesTable)
      .leftJoin(
        usersTable,
        eq(examTemplatesTable.creatorUserId, usersTable.id),
      )
      .orderBy(desc(examTemplatesTable.createdAt));

    // Attach attempt counts in a second query (cheap, avoids a complex group-by).
    const counts = await db
      .select({
        templateId: examSessionsTable.examTemplateId,
        c: sql<number>`count(*)::int`,
      })
      .from(examSessionsTable)
      .groupBy(examSessionsTable.examTemplateId);
    const countByTpl = new Map(counts.map((r) => [r.templateId, r.c]));

    res.json({
      templates: rows.map((r) => ({
        ...r,
        attemptCount: countByTpl.get(r.id) ?? 0,
      })),
    });
  },
);

router.delete(
  "/admin/exam-templates/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = pathId(req);
    // Wipe related rows first to keep the DB tidy. We don't have FKs with
    // cascade configured, so do this explicitly.
    const sessionRows = await db
      .select({ id: examSessionsTable.id })
      .from(examSessionsTable)
      .where(eq(examSessionsTable.examTemplateId, id));
    const sessionIds = sessionRows.map((r) => r.id);
    if (sessionIds.length > 0) {
      // Sessions stay so candidate history is preserved; we just unhook them
      // from the template by setting examTemplateId to null.
      await db
        .update(examSessionsTable)
        .set({ examTemplateId: null })
        .where(eq(examSessionsTable.examTemplateId, id));
    }
    const deleted = await db
      .delete(examTemplatesTable)
      .where(eq(examTemplatesTable.id, id))
      .returning({ id: examTemplatesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ ok: true, detachedSessions: sessionIds.length });
  },
);

// Admin overview stats (counts only; cheap aggregate).
router.get(
  "/admin/stats",
  async (_req: Request, res: Response): Promise<void> => {
    const [u] = await db
      .select({
        total: sql<number>`count(*)::int`,
        admins: sql<number>`sum(case when role='admin' then 1 else 0 end)::int`,
        suspended: sql<number>`sum(case when status='suspended' then 1 else 0 end)::int`,
      })
      .from(usersTable);
    const [t] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(examTemplatesTable);
    const [s] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`sum(case when status='completed' then 1 else 0 end)::int`,
      })
      .from(examSessionsTable);
    res.json({
      users: u ?? { total: 0, admins: 0, suspended: 0 },
      templates: t?.c ?? 0,
      sessions: s ?? { total: 0, completed: 0 },
    });
  },
);

// ─────────────── platform health (admin-only) ───────────────
//
// Operational dashboard data: AI usage counters split by fast vs full model,
// LRU cache hit rates, question-bank coverage per app, and row counts for
// the major tables. Pure read-only aggregation — no AI calls, cheap to poll.
router.get(
  "/admin/health",
  async (_req: Request, res: Response): Promise<void> => {
    const [
      userRows,
      tplRows,
      sessRows,
      studioARows,
      studioAtRows,
      bankRows,
    ] = await Promise.all([
      db
        .select({
          role: usersTable.role,
          status: usersTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(usersTable)
        .groupBy(usersTable.role, usersTable.status),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(examTemplatesTable),
      db
        .select({
          status: examSessionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(examSessionsTable)
        .groupBy(examSessionsTable.status),
      db
        .select({
          status: studioAssessmentsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(studioAssessmentsTable)
        .groupBy(studioAssessmentsTable.status),
      db
        .select({
          status: studioAttemptsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(studioAttemptsTable)
        .groupBy(studioAttemptsTable.status),
      db
        .select({
          appSlug: questionBankTable.appSlug,
          appName: questionBankTable.appName,
          count: sql<number>`count(*)::int`,
        })
        .from(questionBankTable)
        .where(eq(questionBankTable.active, true))
        .groupBy(questionBankTable.appSlug, questionBankTable.appName),
    ]);

    const exam = getExamAiUsage();
    const studio = getStudioAiUsage();
    const totalCalls =
      exam.callsFast + exam.callsFull + studio.callsFast + studio.callsFull;
    const totalHits = exam.cacheHits + studio.cacheHits;
    const cacheHitRate =
      totalCalls + totalHits > 0
        ? Math.round((totalHits / (totalCalls + totalHits)) * 1000) / 10
        : null;
    const fastShare =
      exam.callsFast + studio.callsFast + exam.callsFull + studio.callsFull > 0
        ? Math.round(
            ((exam.callsFast + studio.callsFast) /
              (exam.callsFast +
                studio.callsFast +
                exam.callsFull +
                studio.callsFull)) *
              1000,
          ) / 10
        : null;

    res.json({
      generatedAt: new Date().toISOString(),
      ai: {
        exam,
        studio,
        totals: {
          callsFast: exam.callsFast + studio.callsFast,
          callsFull: exam.callsFull + studio.callsFull,
          cacheHits: totalHits,
          failures: exam.failures + studio.failures,
          cacheHitRatePercent: cacheHitRate,
          fastModelSharePercent: fastShare,
        },
      },
      questionBank: {
        totalQuestions: bankRows.reduce((s, r) => s + Number(r.count), 0),
        perApp: bankRows.map((r) => ({
          appSlug: r.appSlug,
          appName: r.appName,
          count: Number(r.count),
        })),
      },
      users: {
        breakdown: userRows.map((r) => ({
          role: r.role,
          status: r.status,
          count: Number(r.count),
        })),
      },
      examHall: {
        templates: Number(tplRows[0]?.count ?? 0),
        sessions: sessRows.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
      },
      studio: {
        assessments: studioARows.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
        attempts: studioAtRows.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
      },
    });
  },
);

export default router;
