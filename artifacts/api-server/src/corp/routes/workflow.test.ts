/**
 * Corporate workflow integration coverage:
 * - matter-scoped compliance obligations create corresponding deadlines;
 * - transaction approvals and final review persist;
 * - a second subscriber cannot inspect another subscriber's workflow.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

const { default: app } = await import("../../app");
const { db, corpAccessCodes, corpSessions, pool } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");
const { ensureMatterFileTables } = await import("../../lib/matterFiles");
const { ensureCorpWorkflowTables } = await import("./workflow");

const RUN_ID = `corp-wf-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE_A = `CWFA${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const CODE_B = `CWFB${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

let ownerA = 0;
let ownerB = 0;
let tokenA = "";
let tokenB = "";
let matterId = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function isoDate(value: unknown): string {
  return new Date(value as string | number | Date).toISOString().slice(0, 10);
}

beforeAll(async () => {
  await ensureMatterFileTables();
  await ensureCorpWorkflowTables();

  const codes = await db
    .insert(corpAccessCodes)
    .values([
      { code: CODE_A, label: `Corporate workflow A ${RUN_ID}`, isActive: true },
      { code: CODE_B, label: `Corporate workflow B ${RUN_ID}`, isActive: true },
    ])
    .returning();
  ownerA = codes[0]!.id;
  ownerB = codes[1]!.id;

  const [loginA, loginB] = await Promise.all([
    request(app).post("/api/corp/legal/verify-password").send({ password: CODE_A }),
    request(app).post("/api/corp/legal/verify-password").send({ password: CODE_B }),
  ]);
  expect(loginA.body.success).toBe(true);
  expect(loginB.body.success).toBe(true);
  tokenA = loginA.body.token as string;
  tokenB = loginB.body.token as string;

  const matter = await request(app)
    .post("/api/corp/matters")
    .set(auth(tokenA))
    .send({ title: `e-BOS compliance ${RUN_ID}` });
  expect(matter.status).toBe(201);
  matterId = matter.body.id as number;
});

afterAll(async () => {
  if (ownerA || ownerB) {
    await pool.query(
      "DELETE FROM case_events WHERE portal = 'corp' AND owner_key = ANY($1::text[])",
      [[String(ownerA), String(ownerB)]],
    );
    await pool.query("DELETE FROM corp_compliance_obligations WHERE access_code_id = ANY($1::int[])", [[ownerA, ownerB]]);
    await pool.query("DELETE FROM corp_transaction_items WHERE access_code_id = ANY($1::int[])", [[ownerA, ownerB]]);
    await pool.query("DELETE FROM corp_matter_reviews WHERE access_code_id = ANY($1::int[])", [[ownerA, ownerB]]);
    await pool.query("DELETE FROM corp_matters WHERE access_code_id = ANY($1::int[])", [[ownerA, ownerB]]);
    await db.delete(corpSessions).where(inArray(corpSessions.accessCodeId, [ownerA, ownerB]));
    await db.delete(corpAccessCodes).where(inArray(corpAccessCodes.id, [ownerA, ownerB]));
  }
});

describe("corporate workflow", () => {
  it("tracks obligations, transaction approval and evidence-gated finalisation", async () => {
    const base = `/api/corp/matters/${matterId}/workflow`;
    const obligation = await request(app)
      .post(`${base}/obligations`)
      .set(auth(tokenA))
      .send({
        title: "Confirm beneficial ownership information",
        authority: "Companies Act 2016",
        source_reference: "e-BOS filing record",
        owner_name: "Company secretary",
        due_date: "2027-03-14",
        status: "open",
        risk: "high",
      });
    expect(obligation.status).toBe(201);
    expect(obligation.body.deadline_id).toBeTypeOf("number");

    const transaction = await request(app)
      .post(`${base}/transactions`)
      .set(auth(tokenA))
      .send({
        title: "Shareholders' agreement",
        item_type: "contract",
        target_date: "2027-03-20",
        status: "open",
        approval_status: "pending",
        deviation: "Investor consent right requested",
        fallback_position: "Consent limited to reserved matters",
      });
    expect(transaction.status).toBe(201);
    expect(transaction.body.deadline_id).toBeTypeOf("number");

    const approval = await request(app)
      .patch(`${base}/transactions/${transaction.body.id}`)
      .set(auth(tokenA))
      .send({ approval_status: "approved", approved_by: "General counsel" });
    expect(approval.status, JSON.stringify(approval.body)).toBe(200);
    expect(approval.body.approval_status).toBe("approved");

    const rejectedReview = await request(app)
      .put(`${base}/review`)
      .set(auth(tokenA))
      .send({ reviewer_name: "General counsel", evidence_status: "needs_review", finalised: true });
    expect(rejectedReview.status).toBe(400);

    const finalReview = await request(app)
      .put(`${base}/review`)
      .set(auth(tokenA))
      .send({ reviewer_name: "General counsel", evidence_status: "verified", finalised: true });
    expect(finalReview.status).toBe(200);
    expect(finalReview.body.finalised).toBe(true);

    const workflow = await request(app).get(base).set(auth(tokenA));
    expect(workflow.status).toBe(200);
    expect(workflow.body.obligations).toHaveLength(1);
    expect(workflow.body.transactions[0].approval_status).toBe("approved");
    expect(workflow.body.review.finalised).toBe(true);
  });

  it("keeps obligation and transaction deadlines and chronology synchronized", async () => {
    const matter = await request(app)
      .post("/api/corp/matters")
      .set(auth(tokenA))
      .send({ title: `Workflow synchronization ${RUN_ID}` });
    expect(matter.status).toBe(201);
    const syncMatterId = matter.body.id as number;
    const base = `/api/corp/matters/${syncMatterId}/workflow`;

    const obligation = await request(app)
      .post(`${base}/obligations`)
      .set(auth(tokenA))
      .send({ title: "Submit annual return", due_date: "2027-04-01" });
    expect(obligation.status, JSON.stringify(obligation.body)).toBe(201);
    const obligationId = obligation.body.id as number;
    const initialObligationDeadlineId = obligation.body.deadline_id as number;
    expect(initialObligationDeadlineId).toBeTypeOf("number");

    let deadline = await pool.query(
      "SELECT due_date, status FROM corp_matter_deadlines WHERE id = $1",
      [initialObligationDeadlineId],
    );
    let event = await pool.query(
      "SELECT event_date FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `compliance-obligation:${obligationId}`],
    );
    expect(isoDate(deadline.rows[0].due_date)).toBe("2027-04-01");
    expect(deadline.rows[0].status).toBe("pending");
    expect(isoDate(event.rows[0].event_date)).toBe("2027-04-01");

    const rescheduledObligation = await request(app)
      .patch(`${base}/obligations/${obligationId}`)
      .set(auth(tokenA))
      .send({ due_date: "2027-05-02" });
    expect(rescheduledObligation.status, JSON.stringify(rescheduledObligation.body)).toBe(200);
    expect(rescheduledObligation.body.deadline_id).toBe(initialObligationDeadlineId);

    deadline = await pool.query(
      "SELECT due_date, status FROM corp_matter_deadlines WHERE id = $1",
      [initialObligationDeadlineId],
    );
    event = await pool.query(
      "SELECT event_date FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `compliance-obligation:${obligationId}`],
    );
    expect(isoDate(deadline.rows[0].due_date)).toBe("2027-05-02");
    expect(isoDate(event.rows[0].event_date)).toBe("2027-05-02");

    const fulfilledObligation = await request(app)
      .patch(`${base}/obligations/${obligationId}`)
      .set(auth(tokenA))
      .send({ status: "fulfilled" });
    expect(fulfilledObligation.status).toBe(200);
    deadline = await pool.query(
      "SELECT status FROM corp_matter_deadlines WHERE id = $1",
      [initialObligationDeadlineId],
    );
    expect(deadline.rows[0].status).toBe("completed");

    const clearedObligation = await request(app)
      .patch(`${base}/obligations/${obligationId}`)
      .set(auth(tokenA))
      .send({ due_date: null });
    expect(clearedObligation.status).toBe(200);
    expect(clearedObligation.body.due_date).toBeNull();
    expect(clearedObligation.body.deadline_id).toBeNull();
    deadline = await pool.query(
      "SELECT 1 FROM corp_matter_deadlines WHERE id = $1",
      [initialObligationDeadlineId],
    );
    event = await pool.query(
      "SELECT 1 FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `compliance-obligation:${obligationId}`],
    );
    expect(deadline.rows).toHaveLength(0);
    expect(event.rows).toHaveLength(0);

    const restoredObligation = await request(app)
      .patch(`${base}/obligations/${obligationId}`)
      .set(auth(tokenA))
      .send({ due_date: "2027-06-03" });
    expect(restoredObligation.status).toBe(200);
    expect(restoredObligation.body.deadline_id).toBeTypeOf("number");
    expect(restoredObligation.body.deadline_id).not.toBe(initialObligationDeadlineId);
    const restoredObligationDeadlineId = restoredObligation.body.deadline_id as number;
    event = await pool.query(
      "SELECT event_date FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `compliance-obligation:${obligationId}`],
    );
    expect(isoDate(event.rows[0].event_date)).toBe("2027-06-03");

    const transaction = await request(app)
      .post(`${base}/transactions`)
      .set(auth(tokenA))
      .send({ title: "Complete acquisition agreement", target_date: "2027-07-10" });
    expect(transaction.status, JSON.stringify(transaction.body)).toBe(201);
    const transactionId = transaction.body.id as number;
    const transactionDeadlineId = transaction.body.deadline_id as number;
    expect(transactionDeadlineId).toBeTypeOf("number");

    const rescheduledTransaction = await request(app)
      .patch(`${base}/transactions/${transactionId}`)
      .set(auth(tokenA))
      .send({ target_date: "2027-08-11" });
    expect(rescheduledTransaction.status).toBe(200);
    deadline = await pool.query(
      "SELECT due_date FROM corp_matter_deadlines WHERE id = $1",
      [transactionDeadlineId],
    );
    event = await pool.query(
      "SELECT event_date FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `transaction-item:${transactionId}`],
    );
    expect(isoDate(deadline.rows[0].due_date)).toBe("2027-08-11");
    expect(isoDate(event.rows[0].event_date)).toBe("2027-08-11");

    const completedTransaction = await request(app)
      .patch(`${base}/transactions/${transactionId}`)
      .set(auth(tokenA))
      .send({ status: "complete" });
    expect(completedTransaction.status).toBe(200);
    deadline = await pool.query(
      "SELECT status FROM corp_matter_deadlines WHERE id = $1",
      [transactionDeadlineId],
    );
    expect(deadline.rows[0].status).toBe("completed");

    const clearedTransaction = await request(app)
      .patch(`${base}/transactions/${transactionId}`)
      .set(auth(tokenA))
      .send({ target_date: null });
    expect(clearedTransaction.status).toBe(200);
    expect(clearedTransaction.body.target_date).toBeNull();
    expect(clearedTransaction.body.deadline_id).toBeNull();
    deadline = await pool.query(
      "SELECT 1 FROM corp_matter_deadlines WHERE id = $1",
      [transactionDeadlineId],
    );
    event = await pool.query(
      "SELECT 1 FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `transaction-item:${transactionId}`],
    );
    expect(deadline.rows).toHaveLength(0);
    expect(event.rows).toHaveLength(0);

    const deletedObligation = await request(app)
      .delete(`${base}/obligations/${obligationId}`)
      .set(auth(tokenA));
    expect(deletedObligation.status).toBe(200);
    deadline = await pool.query(
      "SELECT 1 FROM corp_matter_deadlines WHERE id = $1",
      [restoredObligationDeadlineId],
    );
    event = await pool.query(
      "SELECT 1 FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `compliance-obligation:${obligationId}`],
    );
    expect(deadline.rows).toHaveLength(0);
    expect(event.rows).toHaveLength(0);

    const restoredTransaction = await request(app)
      .patch(`${base}/transactions/${transactionId}`)
      .set(auth(tokenA))
      .send({ target_date: "2027-09-12" });
    expect(restoredTransaction.status).toBe(200);
    const restoredTransactionDeadlineId = restoredTransaction.body.deadline_id as number;
    expect(restoredTransactionDeadlineId).toBeTypeOf("number");

    const deletedTransaction = await request(app)
      .delete(`${base}/transactions/${transactionId}`)
      .set(auth(tokenA));
    expect(deletedTransaction.status).toBe(200);
    deadline = await pool.query(
      "SELECT 1 FROM corp_matter_deadlines WHERE id = $1",
      [restoredTransactionDeadlineId],
    );
    event = await pool.query(
      "SELECT 1 FROM case_events WHERE portal = 'corp' AND matter_id = $1 AND owner_key = $2 AND source = $3",
      [syncMatterId, String(ownerA), `transaction-item:${transactionId}`],
    );
    expect(deadline.rows).toHaveLength(0);
    expect(event.rows).toHaveLength(0);
  });

  it("returns 404 for another subscriber's matter workflow", async () => {
    const response = await request(app)
      .get(`/api/corp/matters/${matterId}/workflow`)
      .set(auth(tokenB));
    expect(response.status).toBe(404);
  });
});