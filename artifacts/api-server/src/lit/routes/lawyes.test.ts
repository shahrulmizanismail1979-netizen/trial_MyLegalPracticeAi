import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

const aiCalls = vi.hoisted(() => ({
  research: 0,
  drafting: 0,
  emitCitations: true,
  draftingPrompts: [] as string[],
}));
vi.mock("../lib/aiProvider", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/aiProvider")>();
  return {
    ...original,
    streamChat: vi.fn(async function* () {
      aiCalls.research += 1;
      yield { text: "Grounded proposition from the source." };
      if (aiCalls.emitCitations) {
        yield {
          citations: [{
            title: "Federal Court source",
            uri: "https://example.test/federal-court",
          }],
        };
      }
    }),
    generateChat: vi.fn(async (messages: Array<{ text: string }>) => {
      aiCalls.drafting += 1;
      aiCalls.draftingPrompts.push(messages[0]?.text ?? "");
      return { text: "## Matter-aware draft\n\nDrafted answer [VERIFY].", citations: [] };
    }),
  };
});

const { default: app } = await import("../../app");
const { db, pool, litAccessCodes, litMatters, litMatterDeadlines, litSavedWork } =
  await import("@workspace/db");
const { inArray } = await import("drizzle-orm");
const { ensureDocumentTables } = await import("../../lib/caseDocuments");
const { ensureDraftTables } = await import("../../lib/caseDrafts");
const { ensureCaseIntelligenceTables } = await import("../../lib/ensureCaseIntelligenceTables");

const suffix = randomUUID().slice(0, 8).toUpperCase();
const codeA = `LAWYES-A-${suffix}`;
const codeB = `LAWYES-B-${suffix}`;
let ownerIds: number[] = [];
let matterId = 0;
let otherMatterId = 0;
let agentA: request.Agent;
let agentB: request.Agent;

async function login(code: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/lit/auth/login").send({ password: code });
  expect(response.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  const owners = await db.insert(litAccessCodes).values([
    {
      code: codeA,
      recipientName: `Lawyes A ${suffix}`,
      recipientEmail: `lawyes-a-${suffix}@test.invalid`,
      status: "active",
    },
    {
      code: codeB,
      recipientName: `Lawyes B ${suffix}`,
      recipientEmail: `lawyes-b-${suffix}@test.invalid`,
      status: "active",
    },
  ]).returning({ id: litAccessCodes.id });
  ownerIds = owners.map((owner) => owner.id);
  const [matter] = await db.insert(litMatters).values({
    accessCodeId: ownerIds[0]!,
    title: `Owned Lawyes matter ${suffix}`,
    notes: "Owner-only facts",
  }).returning({ id: litMatters.id });
  matterId = matter.id;
  const [otherMatter] = await db.insert(litMatters).values({
    accessCodeId: ownerIds[0]!,
    title: `Other Lawyes matter ${suffix}`,
  }).returning({ id: litMatters.id });
  otherMatterId = otherMatter.id;
  await Promise.all([ensureDocumentTables(), ensureDraftTables(), ensureCaseIntelligenceTables()]);
  await db.insert(litMatterDeadlines).values({
    accessCodeId: ownerIds[0]!,
    matterId,
    title: "Owned deadline",
    dueDate: new Date("2030-01-02T00:00:00Z"),
  });
  await db.insert(litSavedWork).values({
    accessCodeId: ownerIds[0]!,
    matterId,
    title: "Existing research",
    kind: "case-law-research",
    content: "Existing source-bearing work",
    inputJson: {
      citations: [{ title: "Existing source", uri: "https://example.test/existing" }],
    },
  });
  // Canonical shared seams: one owned row plus rows which must not appear in
  // this workspace because they are owned by another access code or another matter.
  await pool.query(
    `INSERT INTO case_documents (portal, owner_key, matter_id, object_path, file_name, category)
     VALUES ($1, $2, $3, $4, $5, $6), ($1, $7, $3, $8, $9, $6), ($1, $2, $10, $11, $12, $6)`,
    ["lit", String(ownerIds[0]), matterId, `/lawyes/${suffix}/owned.pdf`, "Owned canonical document.pdf",
      "evidence", String(ownerIds[1]), `/lawyes/${suffix}/foreign.pdf`, "Foreign canonical document.pdf",
      otherMatterId, `/lawyes/${suffix}/other.pdf`, "Other matter document.pdf"],
  );
  await pool.query(
    `INSERT INTO case_tasks (portal, owner_key, matter_id, title)
     VALUES ($1, $2, $3, $4), ($1, $5, $3, $6), ($1, $2, $7, $8)`,
    ["lit", String(ownerIds[0]), matterId, "Owned canonical task", String(ownerIds[1]),
      "Foreign canonical task", otherMatterId, "Other matter task"],
  );
  const { rows: roots } = await pool.query(
    `INSERT INTO case_drafts (portal, owner_key, matter_id, title, content, version_number)
     VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
    ["lit", String(ownerIds[0]), matterId, "Version one canonical draft", "v1"],
  );
  const rootId = roots[0]!.id as number;
  await pool.query(`UPDATE case_drafts SET root_id = $1 WHERE id = $1`, [rootId]);
  await pool.query(
    `INSERT INTO case_drafts (portal, owner_key, matter_id, root_id, title, content, version_number)
     VALUES ($1, $2, $3, $4, $5, $6, 2),
            ($1, $7, $3, NULL, $8, $9, 1),
            ($1, $2, $10, NULL, $11, $12, 1)`,
    ["lit", String(ownerIds[0]), matterId, rootId, "Version two canonical draft", "v2",
      String(ownerIds[1]), "Foreign canonical draft", "foreign", otherMatterId,
      "Other matter draft", "other"],
  );
  agentA = await login(codeA);
  agentB = await login(codeB);
});

afterAll(async () => {
  if (!ownerIds.length) return;
  await pool.query(
    `DELETE FROM case_documents WHERE portal = $1 AND object_path LIKE $2`,
    ["lit", `/lawyes/${suffix}/%`],
  );
  await pool.query(
    `DELETE FROM case_tasks WHERE portal = $1 AND title IN ($2, $3, $4)`,
    ["lit", "Owned canonical task", "Foreign canonical task", "Other matter task"],
  );
  await pool.query(
    `DELETE FROM case_drafts WHERE portal = $1 AND title IN ($2, $3, $4, $5)`,
    ["lit", "Version one canonical draft", "Version two canonical draft", "Foreign canonical draft", "Other matter draft"],
  );
  await db.delete(litSavedWork).where(inArray(litSavedWork.accessCodeId, ownerIds));
  await db.delete(litMatters).where(inArray(litMatters.accessCodeId, ownerIds));
  await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, ownerIds));
});

describe("MyLitAI Lawyes vertical slice", () => {
  it("requires authentication before the shared AI limiter/capabilities", async () => {
    const before = aiCalls.research;
    const response = await request(app).get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(response.status).toBe(401);
    expect(aiCalls.research).toBe(before);
  });

  it("loads the same-owner aggregate and isolates foreign tenants with 404", async () => {
    const ownList = await agentA.get("/api/lit/lawyes/matters");
    expect(ownList.status).toBe(200);
    expect(ownList.body.map((matter: { id: number }) => matter.id)).toContain(matterId);

    const foreignList = await agentB.get("/api/lit/lawyes/matters");
    expect(foreignList.status).toBe(200);
    expect(foreignList.body.map((matter: { id: number }) => matter.id)).not.toContain(matterId);

    const own = await agentA.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(own.status).toBe(200);
    expect(own.body.matter.id).toBe(matterId);
    expect(own.body.deadlines).toHaveLength(1);
    expect(own.body.research).toHaveLength(1);
    expect(own.body.conversations).toEqual([]);
    const documentTitles = own.body.documents.map((document: { title: string }) => document.title);
    expect(documentTitles).toEqual(["Owned canonical document.pdf"]);
    expect(documentTitles).not.toContain("Foreign canonical document.pdf");
    expect(documentTitles).not.toContain("Other matter document.pdf");
    expect(own.body.uploads.map((document: { title: string }) => document.title))
      .toEqual(["Owned canonical document.pdf"]);
    const taskTitles = own.body.tasks.map((task: { title: string }) => task.title);
    expect(taskTitles).toEqual(["Owned canonical task"]);
    expect(taskTitles).not.toContain("Foreign canonical task");
    expect(taskTitles).not.toContain("Other matter task");
    const draftTitles = own.body.drafts.map((draft: { title: string }) => draft.title);
    expect(draftTitles).toContain("Version two canonical draft");
    expect(draftTitles).not.toContain("Version one canonical draft");
    expect(draftTitles).not.toContain("Foreign canonical draft");
    expect(draftTitles).not.toContain("Other matter draft");
    expect(own.body.checklists).toEqual([]);

    const foreign = await agentB.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "Matter not found" });
  });

  it("runs research plus matter drafting, returns sources/verification, and reloads a retry-safe save", async () => {
    const body = {
      instruction: "Research the issue and draft a concise advice note.",
      save: {
        title: "Lawyes advice note",
        kind: "lawyes-draft",
        idempotencyKey: `lawyes-${suffix}`,
      },
    };
    const first = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.capabilities).toEqual([
      "grounded_legal_research",
      "matter_aware_review_or_drafting",
    ]);
    expect(first.body.citations[0].uri).toBe("https://example.test/federal-court");
    expect(first.body.verification).toMatchObject({
      status: "requires_independent_verification",
      verified: false,
    });
    expect(first.body.saveCreated).toBe(true);
    const savedId = first.body.savedWork.id;

    const retry = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
      .send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.saveCreated).toBe(false);
    expect(retry.body.savedWork.id).toBe(savedId);

    const reload = await agentA.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(reload.status).toBe(200);
    expect(reload.body.drafts.some((draft: { id: number }) => draft.id === savedId)).toBe(true);
    expect(reload.body.outputs.some((output: { id: number }) => output.id === savedId)).toBe(true);
    expect(aiCalls.research).toBeGreaterThanOrEqual(2);
    expect(aiCalls.drafting).toBeGreaterThanOrEqual(2);
    const prompt = aiCalls.draftingPrompts.at(-1) ?? "";
    expect(prompt).not.toContain("accessCodeId");
    expect(prompt).not.toContain(String(ownerIds[0]));
  });

  it("fails closed when grounded research returns no verifiable sources", async () => {
    aiCalls.emitCitations = false;
    const draftingBefore = aiCalls.drafting;
    try {
      const response = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
        .send({ instruction: "Research this issue and draft an advice note." });
      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({
        code: "sources_unavailable",
        verification: {
          status: "requires_independent_verification",
          verified: false,
        },
      });
      expect(aiCalls.drafting).toBe(draftingBefore);
    } finally {
      aiCalls.emitCitations = true;
    }
  });
});