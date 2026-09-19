/**
 * Live-database coverage for subscriber manager setup/reset.
 *
 * Fixtures are unique to this process and are removed by exact workspace id.
 * Email delivery and unrelated external providers are disabled.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../lib/mailer", () => ({ sendEmail }));
vi.mock("../../lib/virtualParalegal", () => ({
  attachVirtualParalegal: vi.fn(),
}));
vi.mock("../lib/aiService", () => ({
  AiProviderError: class AiProviderError extends Error {},
  generateTriage: vi.fn().mockRejectedValue(new Error("AI disabled in auth workspace tests")),
}));
vi.mock("../lib/googleDrive", () => ({ syncObjectToDrive: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  speechToText: vi.fn().mockRejectedValue(new Error("Provider calls disabled in auth workspace tests")),
  ensureCompatibleFormat: vi.fn(),
}));
vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  class ObjectStorageService {}
  return { ObjectNotFoundError, ObjectStorageService };
});

import firmRouter from "../index";
import {
  db,
  firmAccessCodesTable,
  firmWorkspaceCredentialsTable,
  usersTable,
} from "../db";

const RUN_ID = `firm-auth-${process.pid}-${Date.now()}`;
const CODE_A = `${RUN_ID}-A`;
const CODE_B = `${RUN_ID}-B`;
const EMAIL_A = `${RUN_ID}-registered-a@example.invalid`;
const EMAIL_B = `${RUN_ID}-registered-b@example.invalid`;
const PASSWORD_A = `${RUN_ID}-password-A!`;
const PASSWORD_A_RESET = `${RUN_ID}-password-A-reset!`;
const PASSWORD_B = `${RUN_ID}-password-B!`;

let app: express.Express;
let workspaceA: number;
let workspaceB: number;
let managerAId: number;
let managerBId: number;
let staffCookieA = "";
let staffCookieB = "";
let currentManagerCookieA = "";

const testLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function cookieFrom(res: request.Response, expectedName?: string): string {
  const values = res.headers["set-cookie"];
  const cookies = (Array.isArray(values) ? values : [values]).filter(
    (value): value is string => typeof value === "string",
  );
  const cookie = cookies.find((value) => {
    const pair = value.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator < 1 || pair.slice(separator + 1) === "") return false;
    if (/\bMax-Age=0\b/i.test(value)) return false;
    const name = pair.slice(0, separator);
    if ((name === "fm_manager" || name === "fm_mgr") && pair.endsWith("=")) return false;
    return expectedName ? name === expectedName : true;
  });
  if (!cookie) throw new Error(`Expected a non-clearing ${expectedName ?? "session"} cookie`);
  return cookie.split(";")[0];
}

function latestOtp(): string {
  const call = sendEmail.mock.calls.at(-1)?.[0] as { html?: string } | undefined;
  const match = call?.html?.match(/<strong>(\d{6})<\/strong>/);
  if (!match) throw new Error("Mocked verification email did not contain a six-digit code");
  return match[1];
}

async function ageChallenge(workspaceId: number): Promise<void> {
  await db
    .update(firmWorkspaceCredentialsTable)
    .set({ updatedAt: new Date(Date.now() - 61_000) })
    .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceId));
}

async function sendChallenge(
  staffCookie: string,
  workspaceId: number,
  callerEmail = `${RUN_ID}-caller-controlled@example.invalid`,
): Promise<{ response: request.Response; otp: string }> {
  await ageChallenge(workspaceId);
  const response = await request(app)
    .post("/api/firm/auth/manager/setup/send")
    .set("Cookie", staffCookie)
    .send({ email: callerEmail });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ sent: true });
  return { response, otp: latestOtp() };
}

beforeAll(async () => {
  const [firmA, firmB] = await db
    .insert(firmAccessCodesTable)
    .values([
      { code: CODE_A, label: `${RUN_ID} Firm A`, customerEmail: EMAIL_A, isActive: true },
      { code: CODE_B, label: `${RUN_ID} Firm B`, customerEmail: EMAIL_B, isActive: true },
    ])
    .returning();
  workspaceA = firmA.id;
  workspaceB = firmB.id;

  const [managerA, managerB] = await db
    .insert(usersTable)
    .values([
      {
        workspaceId: workspaceA,
        name: `${RUN_ID} manager A`,
        email: EMAIL_A,
        role: "manager",
        activeStatus: true,
      },
      {
        workspaceId: workspaceB,
        name: `${RUN_ID} manager B`,
        email: EMAIL_B,
        role: "manager",
        activeStatus: true,
      },
    ])
    .returning();
  managerAId = managerA.id;
  managerBId = managerB.id;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { log: typeof testLog }).log = testLog;
    next();
  });
  app.use("/api/firm", firmRouter);

  const [loginA, loginB] = await Promise.all([
    request(app).post("/api/firm/auth/staff").send({ passcode: CODE_A }),
    request(app).post("/api/firm/auth/staff").send({ passcode: CODE_B }),
  ]);
  expect(loginA.status).toBe(200);
  expect(loginB.status).toBe(200);
  staffCookieA = cookieFrom(loginA, "fm_staff");
  staffCookieB = cookieFrom(loginB, "fm_staff");
});

afterAll(async () => {
  if (workspaceA && workspaceB) {
    await db
      .delete(firmWorkspaceCredentialsTable)
      .where(inArray(firmWorkspaceCredentialsTable.workspaceId, [workspaceA, workspaceB]));
    await db.delete(usersTable).where(inArray(usersTable.workspaceId, [workspaceA, workspaceB]));
    await db.delete(firmAccessCodesTable).where(inArray(firmAccessCodesTable.id, [workspaceA, workspaceB]));
  }
  sendEmail.mockReset();
});

describe.sequential("firm manager setup/reset against the live database", () => {
  it("sends only to the registered firm email and enforces resend cooldown", async () => {
    const callerEmail = `${RUN_ID}-untrusted@example.invalid`;
    const { response } = await sendChallenge(staffCookieA, workspaceA, callerEmail);

    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({ to: EMAIL_A }));
    expect(sendEmail.mock.calls.at(-1)?.[0]).not.toEqual(
      expect.objectContaining({ to: callerEmail }),
    );
    expect(response.body).not.toHaveProperty("code");

    const resend = await request(app)
      .post("/api/firm/auth/manager/setup/send")
      .set("Cookie", staffCookieA)
      .send({ email: callerEmail });
    expect(resend.status).toBe(429);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("increments invalid OTP attempts and locks the challenge at five", async () => {
    const { otp } = await sendChallenge(staffCookieB, workspaceB);
    const invalidOtp = otp === "000000" ? "000001" : "000000";

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app)
        .post("/api/firm/auth/manager/setup/verify")
        .set("Cookie", staffCookieB)
        .send({ code: invalidOtp, password: PASSWORD_B });
      expect(response.status).toBe(400);
      const [stored] = await db
        .select({ attempts: firmWorkspaceCredentialsTable.challengeAttempts })
        .from(firmWorkspaceCredentialsTable)
        .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceB));
      expect(stored.attempts).toBe(attempt);
    }

    const locked = await request(app)
      .post("/api/firm/auth/manager/setup/verify")
      .set("Cookie", staffCookieB)
      .send({ code: otp, password: PASSWORD_B });
    expect(locked.status).toBe(400);
    expect(locked.body.error).toMatch(/too many attempts/i);
  });

  it("rejects an expired OTP without changing the password", async () => {
    const { otp } = await sendChallenge(staffCookieB, workspaceB);
    await db
      .update(firmWorkspaceCredentialsTable)
      .set({ challengeExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceB));

    const expired = await request(app)
      .post("/api/firm/auth/manager/setup/verify")
      .set("Cookie", staffCookieB)
      .send({ code: otp, password: PASSWORD_B });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toMatch(/expired/i);
    const [stored] = await db
      .select({ passwordHash: firmWorkspaceCredentialsTable.passwordHash })
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceB));
    expect(stored.passwordHash).toBeNull();
  });

  it("consumes a correct OTP once and stores a bcrypt password hash", async () => {
    const { otp } = await sendChallenge(staffCookieA, workspaceA);
    const verified = await request(app)
      .post("/api/firm/auth/manager/setup/verify")
      .set("Cookie", staffCookieA)
      .send({ code: otp, password: PASSWORD_A });
    expect(verified.status).toBe(200);
    expect(verified.body).toEqual({ updated: true });

    const [stored] = await db
      .select()
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceA));
    expect(stored.passwordHash).not.toBe(PASSWORD_A);
    expect(await bcrypt.compare(PASSWORD_A, stored.passwordHash!)).toBe(true);
    expect(stored.credentialVersion).toBe(1);
    expect(stored.challengeConsumedAt).toBeInstanceOf(Date);

    const reused = await request(app)
      .post("/api/firm/auth/manager/setup/verify")
      .set("Cookie", staffCookieA)
      .send({ code: otp, password: `${PASSWORD_A}-reuse` });
    expect(reused.status).toBe(400);
    expect(await bcrypt.compare(PASSWORD_A, stored.passwordHash!)).toBe(true);
  });

  it("increments credentialVersion and invalidates the old manager cookie on reset", async () => {
    const login = await request(app)
      .post("/api/firm/auth/manager")
      .set("Cookie", staffCookieA)
      .send({ passcode: PASSWORD_A });
    expect(login.status).toBe(200);
    const oldManagerCookie = cookieFrom(login, "fm_mgr");

    const { otp } = await sendChallenge(staffCookieA, workspaceA);
    const reset = await request(app)
      .post("/api/firm/auth/manager/setup/verify")
      .set("Cookie", `${staffCookieA}; ${oldManagerCookie}`)
      .send({ code: otp, password: PASSWORD_A_RESET });
    expect(reset.status).toBe(200);

    const [stored] = await db
      .select()
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceA));
    expect(stored.credentialVersion).toBe(2);
    expect(await bcrypt.compare(PASSWORD_A_RESET, stored.passwordHash!)).toBe(true);

    const staleSession = await request(app)
      .get("/api/firm/auth/session")
      .set("Cookie", `${staffCookieA}; ${oldManagerCookie}`);
    const staleHr = await request(app)
      .get("/api/firm/hr/employees")
      .set("Cookie", `${staffCookieA}; ${oldManagerCookie}`);
    expect(staleSession.status).toBe(401);
    expect(staleHr.status).toBe(401);

    const freshLogin = await request(app)
      .post("/api/firm/auth/manager")
      .set("Cookie", staffCookieA)
      .send({ passcode: PASSWORD_A_RESET });
    expect(freshLogin.status).toBe(200);
    currentManagerCookieA = cookieFrom(freshLogin, "fm_mgr");
  });

  it("denies expired and deactivated firms at session and manager-only HR routes", async () => {
    await db
      .update(firmAccessCodesTable)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(firmAccessCodesTable.id, workspaceA));
    const expiredCookie = `${staffCookieA}; ${currentManagerCookieA}`;
    const [expiredSession, expiredHr] = await Promise.all([
      request(app).get("/api/firm/auth/session").set("Cookie", expiredCookie),
      request(app).get("/api/firm/hr/employees").set("Cookie", expiredCookie),
    ]);
    expect(expiredSession.status).toBe(401);
    expect(expiredHr.status).toBe(401);

    const passwordHash = await bcrypt.hash(PASSWORD_B, 4);
    await db
      .insert(firmWorkspaceCredentialsTable)
      .values({ workspaceId: workspaceB, passwordHash, credentialVersion: 1 })
      .onConflictDoUpdate({
        target: firmWorkspaceCredentialsTable.workspaceId,
        set: { passwordHash, credentialVersion: 1 },
      });
    const managerLoginB = await request(app)
      .post("/api/firm/auth/manager")
      .set("Cookie", staffCookieB)
      .send({ passcode: PASSWORD_B });
    expect(managerLoginB.status).toBe(200);
    const managerCookieB = cookieFrom(managerLoginB, "fm_mgr");

    await db
      .update(firmAccessCodesTable)
      .set({ isActive: false })
      .where(eq(firmAccessCodesTable.id, workspaceB));
    const deactivatedCookie = `${staffCookieB}; ${managerCookieB}`;
    const [deactivatedSession, deactivatedHr] = await Promise.all([
      request(app).get("/api/firm/auth/session").set("Cookie", deactivatedCookie),
      request(app).get("/api/firm/hr/employees").set("Cookie", deactivatedCookie),
    ]);
    expect(deactivatedSession.status).toBe(401);
    expect(deactivatedHr.status).toBe(401);
    expect(managerAId).toBeGreaterThan(0);
    expect(managerBId).toBeGreaterThan(0);
  });
});