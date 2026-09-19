/**
 * MyLawFirmAi — HR module routes
 * Mounted at /hr (under the firm session gate in routes/index.ts).
 *
 * Auth model:
 *   Manager-only routes:  requireManagerSession() → 403 if absent
 *   Self-service routes:  any valid firm session; userId comes from the
 *                         client (consistent with actingUserId elsewhere).
 */
import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  usersTable,
  hrProfilesTable,
  hrLeaveEntitlementsTable,
  hrLeaveRequestsTable,
  hrAttendanceTable,
  hrPayrollRunsTable,
  hrPayslipsTable,
} from "../db";
import { requireManagerSession } from "../lib/managerSession";
import { calcPayroll, generatePayslipPDF } from "../lib/payroll";
import { currentFirmWorkspaceId, firmScope, firmValues } from "../lib/workspace";

export async function ensureHrTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_profiles (
      user_id          integer PRIMARY KEY REFERENCES firm_users(id) ON DELETE CASCADE,
      workspace_id     integer NOT NULL DEFAULT 0,
      ic_number        text,
      position         text,
      department       text,
      employment_type  text NOT NULL DEFAULT 'full_time',
      employment_start text,
      employment_end   text,
      salary           double precision NOT NULL DEFAULT 0,
      epf_number       text,
      socso_number     text,
      pcb_number       text,
      bank_name        text,
      bank_account     text,
      emergency_name   text,
      emergency_phone  text,
      notes            text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_leave_entitlements (
      id           serial PRIMARY KEY,
      workspace_id integer NOT NULL DEFAULT 0,
      user_id      integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
      year         integer NOT NULL,
      leave_type   text NOT NULL,
      entitlement  double precision NOT NULL DEFAULT 0,
      used         double precision NOT NULL DEFAULT 0,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, user_id, year, leave_type)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_leave_requests (
      id             serial PRIMARY KEY,
      workspace_id   integer NOT NULL DEFAULT 0,
      user_id        integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
      leave_type     text NOT NULL,
      start_date     text NOT NULL,
      end_date       text NOT NULL,
      days_requested double precision NOT NULL,
      reason         text,
      status         text NOT NULL DEFAULT 'pending',
      manager_notes  text,
      reviewed_by    integer REFERENCES firm_users(id),
      reviewed_at    timestamptz,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_hr_leave_req_user_idx ON firm_hr_leave_requests(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_hr_leave_req_status_idx ON firm_hr_leave_requests(status)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_attendance (
      id         serial PRIMARY KEY,
      workspace_id integer NOT NULL DEFAULT 0,
      user_id    integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
      work_date  text NOT NULL,
      clock_in   text,
      clock_out  text,
      status     text NOT NULL DEFAULT 'present',
      notes      text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, user_id, work_date)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_hr_att_user_date_idx ON firm_hr_attendance(user_id, work_date)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_payroll_runs (
      id         serial PRIMARY KEY,
      workspace_id integer NOT NULL DEFAULT 0,
      month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
      year       integer NOT NULL,
      run_by     integer REFERENCES firm_users(id),
      status     text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, month, year)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_hr_payslips (
      id               serial PRIMARY KEY,
      workspace_id     integer NOT NULL DEFAULT 0,
      run_id           integer NOT NULL REFERENCES firm_hr_payroll_runs(id) ON DELETE CASCADE,
      user_id          integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
      gross_salary     double precision NOT NULL,
      allowances       jsonb NOT NULL DEFAULT '[]',
      epf_employee     double precision NOT NULL DEFAULT 0,
      epf_employer     double precision NOT NULL DEFAULT 0,
      socso_employee   double precision NOT NULL DEFAULT 0,
      socso_employer   double precision NOT NULL DEFAULT 0,
      eis_employee     double precision NOT NULL DEFAULT 0,
      eis_employer     double precision NOT NULL DEFAULT 0,
      pcb              double precision NOT NULL DEFAULT 0,
      other_deductions jsonb NOT NULL DEFAULT '[]',
      total_deductions double precision NOT NULL,
      net_pay          double precision NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, run_id, user_id)
    )
  `);
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

const ProfileBody = z.object({
  icNumber:        z.string().optional(),
  position:        z.string().optional(),
  department:      z.string().optional(),
  employmentType:  z.enum(["full_time","part_time","contract"]).optional(),
  employmentStart: z.string().optional(),
  employmentEnd:   z.string().optional().nullable(),
  salary:          z.number().min(0).optional(),
  epfNumber:       z.string().optional(),
  socsoNumber:     z.string().optional(),
  pcbNumber:       z.string().optional(),
  bankName:        z.string().optional(),
  bankAccount:     z.string().optional(),
  emergencyName:   z.string().optional(),
  emergencyPhone:  z.string().optional(),
  notes:           z.string().optional(),
});

const LeaveApplyBody = z.object({
  userId:        z.number().int().positive(),
  leaveType:     z.enum(["annual","medical","maternity","paternity","unpaid"]),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysRequested: z.number().positive(),
  reason:        z.string().optional(),
});

const LeaveReviewBody = z.object({
  status:       z.enum(["approved","rejected"]),
  managerNotes: z.string().optional(),
});

const EntitlementBody = z.object({
  userId:      z.number().int().positive(),
  year:        z.number().int().min(2020).max(2099),
  leaveType:   z.enum(["annual","medical","maternity","paternity","unpaid"]),
  entitlement: z.number().min(0),
});

const AttendanceBody = z.object({
  userId:   z.number().int().positive(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:   z.enum(["present","absent","leave","half_day"]),
  clockIn:  z.string().optional(),
  clockOut: z.string().optional(),
  notes:    z.string().optional(),
});

const PayrollRunBody = z.object({
  month: z.number().int().min(1).max(12),
  year:  z.number().int().min(2020).max(2099),
});

// ── Helper ─────────────────────────────────────────────────────────────────────

async function requireMgr(req: Parameters<typeof requireManagerSession>[0], res: import("express").Response): Promise<number | null> {
  const uid = await requireManagerSession(req);
  if (uid == null) {
    res.status(403).json({ error: "Manager authentication required." });
    return null;
  }
  if (!await workspaceUserExists(uid)) {
    res.status(403).json({ error: "Manager is not a member of this workspace." });
    return null;
  }
  return uid;
}

/** User IDs are global primary keys, so never accept one from another workspace. */
async function workspaceUserExists(userId: number): Promise<boolean> {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), firmScope(usersTable)));
  return !!user;
}

// ── Router ─────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MANAGER — Employee profiles
// ══════════════════════════════════════════════════════════════════════════════

/** GET /hr/employees — list all users with their HR profile (or null). */
router.get("/hr/employees", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const users    = await db.select().from(usersTable).where(firmScope(usersTable)).orderBy(usersTable.name);
  const profiles = await db.select().from(hrProfilesTable).where(firmScope(hrProfilesTable));
  const pm = new Map(profiles.map(p => [p.userId, p]));
  res.json({ employees: users.map(u => ({ user: u, profile: pm.get(u.id) ?? null })) });
});

/** POST /hr/employees/:userId — upsert HR profile. */
router.post("/hr/employees/:userId", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const rawUserId = [req.params.userId].flat()[0] ?? "";
  const uid = parseInt(rawUserId, 10);
  if (Number.isNaN(uid)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const b = ProfileBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  if (!await workspaceUserExists(uid)) { res.status(404).json({ error: "User not found." }); return; }
  const values = {
    ...firmValues(),
    userId:          uid,
    icNumber:        b.data.icNumber ?? null,
    position:        b.data.position ?? null,
    department:      b.data.department ?? null,
    employmentType:  b.data.employmentType ?? "full_time",
    employmentStart: b.data.employmentStart ?? null,
    employmentEnd:   b.data.employmentEnd ?? null,
    salary:          b.data.salary ?? 0,
    epfNumber:       b.data.epfNumber ?? null,
    socsoNumber:     b.data.socsoNumber ?? null,
    pcbNumber:       b.data.pcbNumber ?? null,
    bankName:        b.data.bankName ?? null,
    bankAccount:     b.data.bankAccount ?? null,
    emergencyName:   b.data.emergencyName ?? null,
    emergencyPhone:  b.data.emergencyPhone ?? null,
    notes:           b.data.notes ?? null,
    updatedAt:       new Date(),
  };
  const [row] = await db
    .insert(hrProfilesTable)
    .values(values)
    .onConflictDoUpdate({ target: hrProfilesTable.userId, set: { ...values, userId: undefined, workspaceId: undefined } })
    .returning();
  res.status(201).json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// MANAGER — Leave management
// ══════════════════════════════════════════════════════════════════════════════

/** GET /hr/leave — all leave requests with employee name. */
router.get("/hr/leave", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const { status, userId } = req.query;
  const rows = await db.select().from(hrLeaveRequestsTable).where(firmScope(hrLeaveRequestsTable)).orderBy(hrLeaveRequestsTable.createdAt);
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  const um = new Map(users.map(u => [u.id, u]));
  let filtered = rows;
  if (status && typeof status === "string") filtered = filtered.filter(r => r.status === status);
  if (userId && !Number.isNaN(parseInt(userId as string))) {
    filtered = filtered.filter(r => r.userId === parseInt(userId as string));
  }
  res.json({ requests: filtered.map(r => ({ ...r, userName: um.get(r.userId)?.name ?? "?" })) });
});

/** GET /hr/leave/balances?year= — leave balances for all employees. */
router.get("/hr/leave/balances", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const year = parseInt((req.query.year as string) ?? String(new Date().getFullYear()), 10);
  const ents  = await db.select().from(hrLeaveEntitlementsTable).where(and(firmScope(hrLeaveEntitlementsTable), eq(hrLeaveEntitlementsTable.year, year)));
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  const um    = new Map(users.map(u => [u.id, u]));
  res.json({ year, balances: ents.map(e => ({ ...e, userName: um.get(e.userId)?.name ?? "?" })) });
});

/** POST /hr/leave/entitlements — upsert a leave entitlement for an employee. */
router.post("/hr/leave/entitlements", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const b = EntitlementBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  if (!await workspaceUserExists(b.data.userId)) { res.status(404).json({ error: "User not found." }); return; }
  const [row] = await db
    .insert(hrLeaveEntitlementsTable)
    .values({ ...firmValues(), userId: b.data.userId, year: b.data.year, leaveType: b.data.leaveType, entitlement: b.data.entitlement, used: 0 })
    .onConflictDoUpdate({
      target: [hrLeaveEntitlementsTable.workspaceId, hrLeaveEntitlementsTable.userId, hrLeaveEntitlementsTable.year, hrLeaveEntitlementsTable.leaveType],
      set: { entitlement: b.data.entitlement, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(row);
});

/** PATCH /hr/leave/:id — approve or reject a leave request. */
router.patch("/hr/leave/:id", async (req, res): Promise<void> => {
  const mgr = await requireMgr(req, res);
  if (mgr == null) return;
  const id = parseInt([req.params.id].flat()[0] ?? "", 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const b = LeaveReviewBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }

  const [existing] = await db.select().from(hrLeaveRequestsTable).where(and(eq(hrLeaveRequestsTable.id, id), firmScope(hrLeaveRequestsTable)));
  if (!existing) { res.status(404).json({ error: "Leave request not found." }); return; }

  const previousStatus = existing.status;
  const [updated] = await db
    .update(hrLeaveRequestsTable)
    .set({
      status: b.data.status,
      managerNotes: b.data.managerNotes ?? null,
      reviewedBy:   mgr,
      reviewedAt:   new Date(),
    })
    .where(and(eq(hrLeaveRequestsTable.id, id), firmScope(hrLeaveRequestsTable)))
    .returning();

  // Update leave balance: increment used on approve; decrement on reject-after-approve.
  const year = parseInt(existing.startDate.slice(0, 4), 10);
  if (b.data.status === "approved" && previousStatus !== "approved") {
    await db.execute(sql`
      UPDATE firm_hr_leave_entitlements
         SET used = used + ${existing.daysRequested}, updated_at = now()
       WHERE workspace_id = ${currentFirmWorkspaceId()} AND user_id = ${existing.userId} AND year = ${year} AND leave_type = ${existing.leaveType}
    `);
  } else if (b.data.status === "rejected" && previousStatus === "approved") {
    await db.execute(sql`
      UPDATE firm_hr_leave_entitlements
         SET used = GREATEST(0, used - ${existing.daysRequested}), updated_at = now()
       WHERE workspace_id = ${currentFirmWorkspaceId()} AND user_id = ${existing.userId} AND year = ${year} AND leave_type = ${existing.leaveType}
    `);
  }

  res.json(updated);
});

// ══════════════════════════════════════════════════════════════════════════════
// MANAGER — Attendance
// ══════════════════════════════════════════════════════════════════════════════

/** GET /hr/attendance?month=&year= — attendance records for a month. */
router.get("/hr/attendance", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const now   = new Date();
  const month = String(parseInt((req.query.month as string) ?? String(now.getMonth() + 1), 10)).padStart(2, "0");
  const year  = (req.query.year as string) ?? String(now.getFullYear());
  const prefix = `${year}-${month}`;
  const rows = await db.select().from(hrAttendanceTable).where(and(firmScope(hrAttendanceTable), sql`work_date LIKE ${prefix + "-%"}`));
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  const um    = new Map(users.map(u => [u.id, u]));
  res.json({ records: rows.map(r => ({ ...r, userName: um.get(r.userId)?.name ?? "?" })) });
});

/** POST /hr/attendance — upsert a daily attendance record. */
router.post("/hr/attendance", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const b = AttendanceBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  if (!await workspaceUserExists(b.data.userId)) { res.status(404).json({ error: "User not found." }); return; }
  const values = {
    ...firmValues(),
    userId:   b.data.userId,
    workDate: b.data.workDate,
    status:   b.data.status,
    clockIn:  b.data.clockIn ?? null,
    clockOut: b.data.clockOut ?? null,
    notes:    b.data.notes ?? null,
  };
  const [row] = await db
    .insert(hrAttendanceTable)
    .values(values)
    .onConflictDoUpdate({ target: [hrAttendanceTable.workspaceId, hrAttendanceTable.userId, hrAttendanceTable.workDate], set: { ...values, userId: undefined, workDate: undefined, workspaceId: undefined } })
    .returning();
  res.json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// MANAGER — Payroll
// ══════════════════════════════════════════════════════════════════════════════

/** GET /hr/payroll/runs — list payroll runs newest first. */
router.get("/hr/payroll/runs", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const runs = await db.select().from(hrPayrollRunsTable).where(firmScope(hrPayrollRunsTable)).orderBy(hrPayrollRunsTable.year, hrPayrollRunsTable.month);
  res.json({ runs });
});

/** POST /hr/payroll/run — generate payslips for a month. Idempotent: errors if run exists. */
router.post("/hr/payroll/run", async (req, res): Promise<void> => {
  const mgr = await requireMgr(req, res);
  if (mgr == null) return;
  const b = PayrollRunBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const { month, year } = b.data;

  // Employees with an HR profile and non-zero salary
  const profiles = await db.select().from(hrProfilesTable).where(and(firmScope(hrProfilesTable), sql`salary > 0`));
  if (profiles.length === 0) {
    res.status(422).json({ error: "No employees with salary configured." });
    return;
  }
  const users  = await db.select().from(usersTable).where(firmScope(usersTable));
  const um     = new Map(users.map(u => [u.id, u]));

  // Insert run (unique constraint catches duplicates)
  let run: typeof hrPayrollRunsTable.$inferSelect;
  try {
    const [r] = await db
      .insert(hrPayrollRunsTable)
      .values({ ...firmValues(), month, year, runBy: mgr, status: "draft" })
      .returning();
    run = r;
  } catch {
    res.status(409).json({ error: `A payroll run for ${month}/${year} already exists.` });
    return;
  }

  const payslips = [];
  for (const profile of profiles) {
    const result = calcPayroll(profile.salary ?? 0);
    const [slip] = await db
      .insert(hrPayslipsTable)
      .values({
          ...firmValues(),
        runId:           run.id,
        userId:          profile.userId,
        grossSalary:     result.grossSalary,
        epfEmployee:     result.epfEmployee,
        epfEmployer:     result.epfEmployer,
        socsoEmployee:   result.socsoEmployee,
        socsoEmployer:   result.socsoEmployer,
        eisEmployee:     result.eisEmployee,
        eisEmployer:     result.eisEmployer,
        pcb:             result.pcb,
        totalDeductions: result.totalDeductions,
        netPay:          result.netPay,
      })
      .returning();
    payslips.push({ ...slip, userName: um.get(profile.userId)?.name ?? "?" });
  }

  res.status(201).json({ run, payslips });
});

/** GET /hr/payroll/runs/:runId/payslips — list payslips for a run. */
router.get("/hr/payroll/runs/:runId/payslips", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const runId = parseInt([req.params.runId].flat()[0] ?? "", 10);
  if (Number.isNaN(runId)) { res.status(400).json({ error: "Invalid runId" }); return; }
  const [run] = await db.select({ id: hrPayrollRunsTable.id }).from(hrPayrollRunsTable)
    .where(and(eq(hrPayrollRunsTable.id, runId), firmScope(hrPayrollRunsTable)));
  if (!run) { res.status(404).json({ error: "Payroll run not found." }); return; }
  const slips = await db.select().from(hrPayslipsTable)
    .where(and(eq(hrPayslipsTable.runId, runId), firmScope(hrPayslipsTable)));
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  const um    = new Map(users.map(u => [u.id, u]));
  res.json({ payslips: slips.map(s => ({ ...s, userName: um.get(s.userId)?.name ?? "?" })) });
});

/** GET /hr/payroll/payslips/:id/pdf — download a payslip PDF (manager). */
router.get("/hr/payroll/payslips/:id/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  await servePayslipPDF(req, res, null);
});

// ══════════════════════════════════════════════════════════════════════════════
// SELF-SERVICE — managers view their own HR records (server-derived identity)
//
// Security: every /hr/me/* route requires a valid manager session.  The user
// ID is read from the server-signed session cookie — never from a client-
// supplied query parameter.  This prevents IDOR: a staff-only session holder
// cannot call these routes at all, and a manager can only see records that
// belong to their own verified user ID.
// ══════════════════════════════════════════════════════════════════════════════

/** GET /hr/me/profile — authenticated manager's own HR profile. */
router.get("/hr/me/profile", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const [profile] = await db.select().from(hrProfilesTable).where(and(eq(hrProfilesTable.userId, uid), firmScope(hrProfilesTable)));
  const [user]    = await db.select().from(usersTable).where(and(eq(usersTable.id, uid), firmScope(usersTable)));
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  res.json({ user, profile: profile ?? null });
});

/** GET /hr/me/leave — authenticated manager's own leave requests + balances. */
router.get("/hr/me/leave", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const requests = await db.select().from(hrLeaveRequestsTable).where(and(eq(hrLeaveRequestsTable.userId, uid), firmScope(hrLeaveRequestsTable)));
  const year = new Date().getFullYear();
  const balances = await db.select().from(hrLeaveEntitlementsTable)
    .where(and(firmScope(hrLeaveEntitlementsTable), eq(hrLeaveEntitlementsTable.userId, uid), eq(hrLeaveEntitlementsTable.year, year)));
  res.json({ requests, balances });
});

/** POST /hr/me/leave — submit a leave request as the authenticated manager. */
router.post("/hr/me/leave", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const SelfLeaveBody = z.object({
    leaveType:     z.enum(["annual","medical","maternity","paternity","unpaid"]),
    startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    daysRequested: z.number().positive(),
    reason:        z.string().optional(),
  });
  const b = SelfLeaveBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const [row] = await db
    .insert(hrLeaveRequestsTable)
    .values({
      ...firmValues(),
      userId:        uid,           // server-derived from session, not client-supplied
      leaveType:     b.data.leaveType,
      startDate:     b.data.startDate,
      endDate:       b.data.endDate,
      daysRequested: b.data.daysRequested,
      reason:        b.data.reason ?? null,
      status:        "pending",
    })
    .returning();
  res.status(201).json(row);
});

/** GET /hr/me/attendance?month=&year= — authenticated manager's own attendance. */
router.get("/hr/me/attendance", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const now   = new Date();
  const month = String(parseInt((req.query.month as string) ?? String(now.getMonth() + 1), 10)).padStart(2, "0");
  const year  = (req.query.year as string) ?? String(now.getFullYear());
  const prefix = `${year}-${month}`;
  const records = await db.select().from(hrAttendanceTable)
    .where(and(firmScope(hrAttendanceTable), eq(hrAttendanceTable.userId, uid), sql`work_date LIKE ${prefix + "-%"}`));
  res.json({ records });
});

/** GET /hr/me/payslips — authenticated manager's own payslips. */
router.get("/hr/me/payslips", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const slips = await db.select().from(hrPayslipsTable).where(and(eq(hrPayslipsTable.userId, uid), firmScope(hrPayslipsTable)));
  const runs  = await db.select().from(hrPayrollRunsTable).where(firmScope(hrPayrollRunsTable));
  const rm    = new Map(runs.map(r => [r.id, r]));
  res.json({ payslips: slips.map(s => ({ ...s, run: rm.get(s.runId) ?? null })) });
});

/** GET /hr/me/payslips/:id/pdf — download own payslip PDF with ownership check. */
router.get("/hr/me/payslips/:id/pdf", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  // Ownership is verified inside servePayslipPDF: slip.userId must equal uid.
  await servePayslipPDF(req, res, uid);
});

// ── Shared PDF helper ──────────────────────────────────────────────────────────

async function servePayslipPDF(
  req: import("express").Request,
  res: import("express").Response,
  /** When non-null, the slip's owner is verified against this value before
   *  generating the PDF.  The manager-only route passes null (any payslip);
   *  the self-service route passes the authenticated manager's uid. */
  ownerUid: number | null,
): Promise<void> {
  const rawId = [req.params["id"]].flat()[0] ?? "";
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [slip] = await db.select().from(hrPayslipsTable).where(and(eq(hrPayslipsTable.id, id), firmScope(hrPayslipsTable)));
  if (!slip) { res.status(404).json({ error: "Payslip not found." }); return; }

  // Ownership gate for self-service downloads.
  if (ownerUid != null && slip.userId !== ownerUid) {
    res.status(403).json({ error: "You can only download your own payslips." });
    return;
  }
  const [run]  = await db.select().from(hrPayrollRunsTable).where(and(eq(hrPayrollRunsTable.id, slip.runId), firmScope(hrPayrollRunsTable)));
  if (!run) { res.status(404).json({ error: "Payroll run not found." }); return; }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, slip.userId), firmScope(usersTable)));
  const [profile] = await db.select().from(hrProfilesTable).where(and(eq(hrProfilesTable.userId, slip.userId), firmScope(hrProfilesTable)));

  const buf = await generatePayslipPDF({
    firmName:         "MyLawFirmAi",
    employeeName:     user?.name ?? "Employee",
    employeeTitle:    user?.title ?? null,
    employeePosition: profile?.position ?? null,
    epfNumber:        profile?.epfNumber ?? null,
    socsoNumber:      profile?.socsoNumber ?? null,
    month:            run?.month ?? 1,
    year:             run?.year ?? new Date().getFullYear(),
    result: {
      grossSalary:     slip.grossSalary,
      epfEmployee:     slip.epfEmployee,
      epfEmployer:     slip.epfEmployer,
      socsoEmployee:   slip.socsoEmployee,
      socsoEmployer:   slip.socsoEmployer,
      eisEmployee:     slip.eisEmployee,
      eisEmployer:     slip.eisEmployer,
      pcb:             slip.pcb,
      totalDeductions: slip.totalDeductions,
      netPay:          slip.netPay,
    },
  });

  const safeName = (user?.name ?? "employee").replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 50);
  const fileName = `payslip-${safeName}-${run?.year ?? ""}-${String(run?.month ?? "").padStart(2,"0")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
}

export default router;
