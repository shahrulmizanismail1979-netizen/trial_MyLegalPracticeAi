import { Router, type Request, type Response } from "express";
import { loginRateLimit } from "../../lib/loginRateLimit";
import { randomUUID, createHash, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/acad";
import { and, eq, sql } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  toSafeUser,
  getSessionUser,
} from "../lib/auth";

// Arbitrary constant used as a postgres advisory-lock key so concurrent
// /auth/register calls serialize on the "is this the very first user?" check.
const REGISTER_BOOTSTRAP_LOCK = 7373731n;

// Owner master override. When MASTER_ACCESS_CODE is set, entering it as the
// password on the login form (any email) grants a full admin session backed by
// a dedicated master account. Fail-closed: unset secret disables the override.
const MASTER_ACCESS_CODE = (process.env.MASTER_ACCESS_CODE ?? "").trim();
const MASTER_EMAIL = "master-override@mylawacad.local";

function matchesMasterCode(submitted: string): boolean {
  if (!MASTER_ACCESS_CODE) return false;
  const a = createHash("sha256").update(submitted.trim()).digest();
  const b = createHash("sha256").update(MASTER_ACCESS_CODE).digest();
  return timingSafeEqual(a, b);
}

/**
 * Find-or-create the synthetic master admin account. It has no password hash,
 * so it can never be logged into via the normal password path — only via the
 * master override. Always healed back to active admin.
 */
async function ensureMasterUser() {
  const [row] = await db
    .insert(usersTable)
    .values({
      id: randomUUID(),
      email: MASTER_EMAIL,
      passwordHash: null,
      name: "Master Override",
      role: "admin",
      status: "active",
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      // Force the row back to a purely-synthetic admin so it can never be
      // logged into via the normal password/OAuth paths — even if someone
      // pre-registered this reserved email.
      set: {
        role: "admin",
        status: "active",
        passwordHash: null,
        oauthProvider: null,
        oauthSubject: null,
        name: "Master Override",
      },
    })
    .returning();
  return row!;
}

const router: Router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

class EmailTakenError extends Error {}

router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }
  if (email === MASTER_EMAIL) {
    res.status(400).json({ error: "That email address is reserved." });
    return;
  }
  if (password.length < MIN_PASSWORD_LEN) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
    });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "Name is required." });
    return;
  }

  // Hash before opening the transaction so we don't hold the advisory lock
  // for the ~100ms bcrypt cost.
  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  // We need three things to be atomic w.r.t. concurrent registrations:
  //   1. uniqueness check on email (defense in depth on top of the unique
  //      index, so we can return a friendly 409 instead of a constraint error)
  //   2. user-count check that decides whether this is the bootstrap admin
  //   3. the actual insert
  // A transaction-scoped advisory lock makes all three serialize, eliminating
  // the race where two simultaneous registrations on a fresh DB both see
  // userCount === 0 and both get the admin role.
  let isFirstUser = false;
  let userRow;
  try {
    userRow = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTER_BOOTSTRAP_LOCK})`);

      const existing = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (existing.length > 0) {
        throw new EmailTakenError();
      }

      const countRows = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(usersTable);
      isFirstUser = (countRows[0]?.c ?? 0) === 0;
      const role = isFirstUser ? "admin" : "teacher";

      const inserted = await tx
        .insert(usersTable)
        .values({ id, email, passwordHash, name, role, status: "active" })
        .returning();
      return inserted[0]!;
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw err;
  }

  const user = userRow;

  await regenerateSession(req);
  req.session.acadUserId = user.id;

  res.status(201).json({ user: toSafeUser(user), bootstrapped: isFirstUser });
});

router.post("/auth/login", loginRateLimit, async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  // Owner master override: master code as password grants a full admin session.
  if (matchesMasterCode(password)) {
    const master = await ensureMasterUser();
    await regenerateSession(req);
    req.session.acadUserId = master.id;
    res.json({ user: toSafeUser(master) });
    return;
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.status !== "active") {
    res
      .status(403)
      .json({ error: "Your account has been suspended. Contact an administrator." });
    return;
  }

  if (!user.passwordHash) {
    // OAuth-only account (Google / Facebook). They cannot password-login.
    res.status(401).json({
      error: `This account uses ${user.oauthProvider ?? "social"} sign-in. Please use that button to log in.`,
    });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: sql`now()` })
    .where(and(eq(usersTable.id, user.id)));

  await regenerateSession(req);
  req.session.acadUserId = user.id;

  res.json({ user: toSafeUser({ ...user, lastLoginAt: new Date() }) });
});

router.post("/auth/logout", async (req: Request, res: Response): Promise<void> => {
  await destroySession(req);
  res.clearCookie("acad.sid");
  res.json({ ok: true });
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: toSafeUser(user) });
});

export default router;
