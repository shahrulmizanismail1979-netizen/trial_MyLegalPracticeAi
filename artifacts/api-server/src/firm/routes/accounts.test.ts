/**
 * Accounts module integration tests.
 *
 * Tests:
 *  1. Unauthenticated access is rejected on every sensitive route.
 *  2. Overdraft (client-debit > balance) is rejected with 422.
 *  3. Report totals are consistent after deposits, disbursements, and trust→office transfers.
 *  4. A trust→office transfer atomically creates an office income entry.
 */
import { describe, it, test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import firmRouter from "../index";

// ── DB cleanup helpers ─────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RUN_ID = `accts-test-${process.pid}-${Date.now()}`;

async function cleanupTestData() {
  // Delete by reference pattern to avoid touching real data.
  await db.execute(sql`
    DELETE FROM firm_accounts_client_entries
    WHERE description LIKE ${`%${RUN_ID}%`}
  `);
  await db.execute(sql`
    DELETE FROM firm_accounts_office_entries
    WHERE description LIKE ${`%${RUN_ID}%`}
       OR reference LIKE ${`%${RUN_ID}%`}
  `);
  // Remove any JV-linked office entries created by transfer
  await db.execute(sql`
    DELETE FROM firm_accounts_office_entries
    WHERE reference IN (
      SELECT 'JV-CA-' || LPAD(id::text, 6, '0')
      FROM firm_accounts_client_entries
      WHERE description LIKE ${`%${RUN_ID}%`}
    )
  `);
  await db.execute(sql`
    DELETE FROM firm_accounts_client_ledgers
    WHERE client_name LIKE ${`%${RUN_ID}%`}
  `);
}

// ── App bootstrap ──────────────────────────────────────────────────────────────

let app: express.Express;
let mgrCookie: string;

beforeAll(async () => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/firm", firmRouter);

  // Obtain a manager session using the master access code.
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE not set");
  const loginRes = await request(app)
    .post("/api/firm/auth/manager")
    .send({ passcode: masterCode });
  expect(loginRes.status).toBe(200);
  mgrCookie = loginRes.headers["set-cookie"]?.[0] ?? "";
  if (!mgrCookie) throw new Error("No manager cookie returned");

  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
});

// ── Helper ─────────────────────────────────────────────────────────────────────

const authed = (r: request.Test) => r.set("Cookie", mgrCookie);

// ══════════════════════════════════════════════════════════════════════════════
// 1. Authentication gate
// ══════════════════════════════════════════════════════════════════════════════

describe("auth gate", () => {
  const protectedGet = [
    "/api/firm/accounts/office/entries",
    "/api/firm/accounts/office/categories",
    "/api/firm/accounts/client/ledgers",
    "/api/firm/accounts/reports/pl",
    "/api/firm/accounts/reports/expenses",
    "/api/firm/accounts/reports/trust",
    "/api/firm/accounts/reports/cashflow",
    "/api/firm/accounts/reports/pl/pdf",
    "/api/firm/accounts/reports/expenses/pdf",
    "/api/firm/accounts/reports/trust/pdf",
    "/api/firm/accounts/reports/cashflow/pdf",
  ];

  test.each(protectedGet)("GET %s rejects without session", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it("POST /accounts/office/entries rejects without session", async () => {
    const res = await request(app).post("/api/firm/accounts/office/entries").send({});
    expect(res.status).toBe(401);
  });

  it("POST /accounts/client/ledgers rejects without session", async () => {
    const res = await request(app).post("/api/firm/accounts/client/ledgers").send({});
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Office ledger CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe("office ledger", () => {
  it("rejects an invalid entry body", async () => {
    const res = await authed(request(app).post("/api/firm/accounts/office/entries"))
      .send({ type: "income" }); // missing required fields
    expect(res.status).toBe(400);
  });

  it("creates an income entry and appears in the monthly summary", async () => {
    const body = {
      type: "income",
      category: "professional_fees",
      description: `Fees ${RUN_ID}`,
      amount: 7500,
      entryDate: "2026-08-10",
    };
    const create = await authed(request(app).post("/api/firm/accounts/office/entries")).send(body);
    expect(create.status).toBe(201);
    expect(create.body.amount).toBe(7500);

    const list = await authed(request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"));
    expect(list.status).toBe(200);
    const found = (list.body.entries as { description: string }[]).some(
      (e) => e.description === `Fees ${RUN_ID}`,
    );
    expect(found).toBe(true);
    expect(list.body.totalIncome).toBeGreaterThanOrEqual(7500);
  });

  it("creates an expense entry and subtracts from net", async () => {
    const create = await authed(request(app).post("/api/firm/accounts/office/entries")).send({
      type: "expense",
      category: "rent_expense",
      description: `Rent ${RUN_ID}`,
      amount: 2000,
      entryDate: "2026-08-10",
    });
    expect(create.status).toBe(201);
    const list = await authed(request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"));
    expect(list.body.net).toBeLessThan(list.body.totalIncome);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Client trust ledger and overdraft guard
// ══════════════════════════════════════════════════════════════════════════════

describe("client trust ledger", () => {
  let ledgerId: number;

  beforeAll(async () => {
    const res = await authed(request(app).post("/api/firm/accounts/client/ledgers")).send({
      clientName: `Test Client ${RUN_ID}`,
      matterRef:  "TEST/2026/001",
    });
    expect(res.status).toBe(201);
    ledgerId = res.body.id as number;
  });

  it("starts with zero balance", async () => {
    const res = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    expect(res.status).toBe(200);
    expect(res.body.ledger.balance).toBe(0);
  });

  it("accepts a deposit and updates balance", async () => {
    const res = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "deposit", description: `Deposit ${RUN_ID}`, amount: 15000, entryDate: "2026-08-11",
    });
    expect(res.status).toBe(201);
    expect(res.body.newBalance).toBe(15000);
  });

  it("accepts a disbursement within balance", async () => {
    const res = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "disbursement", description: `Filing fee ${RUN_ID}`, amount: 600, entryDate: "2026-08-12",
    });
    expect(res.status).toBe(201);
    expect(res.body.newBalance).toBe(14400);
  });

  it("handles fractional RM amounts with exact sen precision (no float drift)", async () => {
    // Read current balance before the test so the assertion is state-independent.
    const before = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    const balanceBefore: number = before.body.ledger.balance as number;

    // RM 0.30 deposit → RM 0.10 disbursement → net delta must be EXACTLY RM 0.20
    // (not 0.19999999999999998 which double-precision arithmetic produces).
    await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({ type: "deposit", description: `Frac deposit ${RUN_ID}`, amount: 0.30, entryDate: "2026-08-13" });
    const res = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({ type: "disbursement", description: `Frac disburse ${RUN_ID}`, amount: 0.10, entryDate: "2026-08-13" });
    expect(res.status).toBe(201);

    const expectedBalance = Math.round((balanceBefore + 0.30 - 0.10) * 100) / 100;
    expect(res.body.newBalance).toBe(expectedBalance);

    // Verify the ledger endpoint also returns a value with no floating-point residual.
    const detail = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    const balance: number = detail.body.ledger.balance as number;
    // balance * 100 must be an integer (no fractional sen).
    expect(balance * 100 - Math.round(balance * 100)).toBe(0);
  });

  it("rejects a disbursement that would overdraw (422)", async () => {
    // Snapshot the balance before attempting the overdraft.
    const before = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    const balanceBefore: number = before.body.ledger.balance as number;

    const res = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "disbursement", description: `Overdraft attempt ${RUN_ID}`, amount: 999999, entryDate: "2026-08-12",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/insufficient/i);
    expect(typeof res.body.available).toBe("number");

    // Balance must be unchanged after the rejected debit.
    const detail = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    expect(detail.body.ledger.balance).toBe(balanceBefore);
  });

  it("rejects a transfer_to_office that would overdraw (422)", async () => {
    const res = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "transfer_to_office", description: `Overdrawn transfer ${RUN_ID}`, amount: 999999, entryDate: "2026-08-12",
    });
    expect(res.status).toBe(422);
  });

  it("cannot delete the auto-generated JV office income entry (immutability guard)", async () => {
    // First create a fresh deposit so we have enough balance
    await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "deposit", description: `Pre-transfer deposit ${RUN_ID}`, amount: 3000, entryDate: "2026-08-13",
    });

    const txRes = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "transfer_to_office",
      description: `Immutability check transfer ${RUN_ID}`,
      amount: 1000,
      entryDate: "2026-08-13",
    });
    expect(txRes.status).toBe(201);

    // Find the office entry created by this transfer (reference = JV-CA-XXXXXX)
    const clientEntryId = (txRes.body.entry as { id: number }).id;
    const jvRef = `JV-CA-${String(clientEntryId).padStart(6, "0")}`;
    const officeList = await authed(
      request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"),
    );
    const jvEntry = (
      officeList.body.entries as { id: number; reference: string }[]
    ).find((e) => e.reference === jvRef);
    expect(jvEntry).toBeDefined();

    // Attempt to delete the JV entry — must be rejected with 409
    const delRes = await authed(request(app).delete(`/api/firm/accounts/office/entries/${jvEntry!.id}`));
    expect(delRes.status).toBe(409);
    expect(delRes.body.code).toBe("IMMUTABLE_JV_ENTRY");

    // The office entry must still exist after the rejected delete
    const afterList = await authed(
      request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"),
    );
    const stillThere = (
      afterList.body.entries as { id: number }[]
    ).some((e) => e.id === jvEntry!.id);
    expect(stillThere).toBe(true);
  });

  it("transfer_to_office atomically debits client and credits office income", async () => {
    // Snapshot the current ledger balance and office entry count before the transfer.
    const beforeDetail = await authed(request(app).get(`/api/firm/accounts/client/ledgers/${ledgerId}`));
    const balanceBefore: number = beforeDetail.body.ledger.balance as number;
    const transferAmount = 5000;

    const beforeOffice = await authed(
      request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"),
    );
    const beforeCount = (beforeOffice.body.entries as unknown[]).length;

    const transferRes = await authed(
      request(app).post(`/api/firm/accounts/client/ledgers/${ledgerId}/entries`),
    ).send({
      type: "transfer_to_office",
      description: `Bill transfer ${RUN_ID}`,
      amount: transferAmount,
      entryDate: "2026-08-13",
    });
    expect(transferRes.status).toBe(201);
    expect(transferRes.body.newBalance).toBe(balanceBefore - transferAmount);

    // Verify the office income entry was created atomically
    const afterOffice = await authed(
      request(app).get("/api/firm/accounts/office/entries?month=8&year=2026"),
    );
    expect((afterOffice.body.entries as unknown[]).length).toBe(beforeCount + 1);
    const officeEntry = (
      afterOffice.body.entries as { category: string; type: string; amount: number; reference: string }[]
    ).find((e) => e.category === "client_trust_transfer");
    expect(officeEntry).toBeDefined();
    expect(officeEntry?.amount).toBe(transferAmount);
    expect(officeEntry?.type).toBe("income");
    // JV reference must link back to client entry
    const clientEntryId = (transferRes.body.entry as { id: number }).id;
    expect(officeEntry?.reference).toBe(`JV-CA-${String(clientEntryId).padStart(6, "0")}`);

    // P&L should include the transferred amount in income
    const pl = await authed(request(app).get("/api/firm/accounts/reports/pl?year=2026"));
    expect(pl.status).toBe(200);
    expect(pl.body.totalIncome).toBeGreaterThanOrEqual(5000);

    // Trust report balance should reflect the debit
    const trust = await authed(request(app).get("/api/firm/accounts/reports/trust"));
    const ledgerRow = (trust.body.ledgers as { id: number; balance: number }[]).find(
      (l) => l.id === ledgerId,
    );
    expect(ledgerRow?.balance).toBe(balanceBefore - transferAmount);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Report PDF routes (smoke — verify they return valid PDFs)
// ══════════════════════════════════════════════════════════════════════════════

describe("report PDFs", () => {
  const pdfRoutes = [
    "/api/firm/accounts/reports/pl/pdf?year=2026",
    "/api/firm/accounts/reports/expenses/pdf?year=2026",
    "/api/firm/accounts/reports/trust/pdf",
    "/api/firm/accounts/reports/cashflow/pdf?months=6",
  ];

  test.each(pdfRoutes)("GET %s returns a non-empty PDF", async (path) => {
    const res = await authed(request(app).get(path)).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/pdf/);
    // PDF magic bytes: %PDF
    expect(res.body.slice(0, 4).toString()).toBe("%PDF");
  });
});
