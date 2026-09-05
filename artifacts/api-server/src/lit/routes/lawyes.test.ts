import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

const aiCalls = vi.hoisted(() => ({
  webResearch: 0,
  drafting: 0,
  emitWebCitations: true,
  draftingPrompts: [] as string[],
}));
const researchCalls = vi.hoisted(() => ({
  count: 0,
  available: true,
}));
vi.mock("../lib/lawyesVerifiedResearch", () => ({
  retrieveVerifiedMalaysianAuthorities: vi.fn(async () => {
    researchCalls.count += 1;
    return researchCalls.available ? [{
      judgmentId: 91,
      title: "Verified Federal Court authority",
      citation: "[2026] LAWYES 91",
      court: "Federal Court",
      decisionDate: "2026-01-15",
      sourceUrl: "https://example.test/federal-court",
      verifiedAt: "2026-01-16T00:00:00.000Z",
      rightsStatus: "OFFICIAL_COURT_SOURCE",
      passages: [{
        paragraphRef: "[12]",
        pageNumber: 4,
        text: "Verified proposition from the judicial text.",
      }],
    }] : [];
  }),
}));
vi.mock("../lib/aiProvider", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/aiProvider")>();
  return {
    ...original,
    streamChat: vi.fn(async function* () {
      aiCalls.webResearch += 1;
      yield { text: "Public web proposition requiring verification." };
      if (aiCalls.emitWebCitations) {
        yield {
          citations: [{
            title: "Public source",
            uri: "https://example.test/public",
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

const {
  db,
  pool,
  litAccessCodes,
  litBundleDocuments,
  litBundles,
  litConversations,
  litMatters,
  litMatterDeadlines,
  litSavedWork,
} =
  await import("@workspace/db");
// Simulate an existing deployed database from before migration 0039. Importing
// the app must restore the additive column, FK, and index before routes use it.
await pool.query(`
  DROP INDEX IF EXISTS lit_conversations_owner_matter_idx;
  ALTER TABLE lit_conversations DROP COLUMN IF EXISTS matter_id CASCADE;
`);
const { default: app } = await import("../../app");
const { encryptGoogleTokens } = await import("../lib/lawyesGoogleCrypto");
const { ensureConversationMatterSchema } =
  await import("../lib/ensureConversationMatterSchema");
await ensureConversationMatterSchema();
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
let linkedConversationId = 0;
let exportOutputId = 0;
let agentA: request.Agent;
let agentB: request.Agent;
const googleEnvironment = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
] as const;
const previousGoogleEnvironment = googleEnvironment.map((name) => process.env[name]);

async function login(code: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/lit/auth/login").send({ password: code });
  expect(response.status).toBe(200);
  return agent;
}

async function connectGoogle(
  agent: request.Agent,
  subject: string,
  email: string,
  accessToken: string,
) {
  const started = await agent.get("/api/lit/lawyes/google/connect");
  const state = new URL(started.headers.location).searchParams.get("state");
  const fetchMock = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: `refresh-${subject}`,
      expires_in: 3600,
      token_type: "Bearer",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ].join(" "),
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      sub: subject,
      email,
      email_verified: true,
      name: subject,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const callback = await agent.get(`/api/lit/lawyes/google/callback?code=fake&state=${state}`);
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("google=connected");
  } finally {
    fetchMock.mockRestore();
  }
}

beforeAll(async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-encryption-key-at-least-thirty-two-characters";
  const compatibility = await pool.query<{
    column_exists: boolean;
    foreign_key_exists: boolean;
    index_exists: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'lit_conversations'
           AND column_name = 'matter_id'
      ) AS column_exists,
      EXISTS (
        SELECT 1
          FROM pg_constraint constraint_row
          JOIN pg_attribute column_row
            ON column_row.attrelid = constraint_row.conrelid
           AND column_row.attnum = ANY (constraint_row.conkey)
         WHERE constraint_row.conrelid = 'lit_conversations'::regclass
           AND constraint_row.contype = 'f'
           AND column_row.attname = 'matter_id'
      ) AS foreign_key_exists,
      to_regclass('lit_conversations_owner_matter_idx') IS NOT NULL AS index_exists
  `);
  expect(compatibility.rows[0]).toEqual({
    column_exists: true,
    foreign_key_exists: true,
    index_exists: true,
  });
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
  const conversations = await db.insert(litConversations).values([
    { accessCodeId: ownerIds[0]!, matterId, title: "Owned linked discussion" },
    { accessCodeId: ownerIds[0]!, matterId: otherMatterId, title: "Other matter discussion" },
    { accessCodeId: ownerIds[0]!, matterId: null, title: "Unlinked legacy discussion" },
    { accessCodeId: ownerIds[1]!, matterId, title: "Foreign tenant discussion" },
  ]).returning({ id: litConversations.id, title: litConversations.title });
  linkedConversationId = conversations.find((item) => item.title === "Owned linked discussion")!.id;
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
  const [exportOutput] = await db.insert(litSavedWork).values({
    accessCodeId: ownerIds[0]!,
    matterId,
    title: "Reviewed Drive output",
    kind: "lawyes-draft",
    content: "# Reviewed output\n\nConfidential content.",
    inputJson: { lawyes: true },
  }).returning({ id: litSavedWork.id });
  exportOutputId = exportOutput.id;
  // Canonical shared seams: one owned row plus rows which must not appear in
  // this workspace because they are owned by another access code or another matter.
  await pool.query(
    `INSERT INTO case_documents (portal, owner_key, matter_id, object_path, file_name, category)
     VALUES ($1, $2, $3, $4, $5, $6), ($1, $7, $3, $8, $9, $6), ($1, $2, $10, $11, $12, $6)`,
    ["lit", String(ownerIds[0]), matterId, `/lawyes/${suffix}/owned.pdf`, "Owned canonical document.pdf",
      "evidence", String(ownerIds[1]), `/lawyes/${suffix}/foreign.pdf`, "Foreign canonical document.pdf",
      otherMatterId, `/lawyes/${suffix}/other.pdf`, "Other matter document.pdf"],
  );
  const collisionResult = await pool.query<{ id: number }>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(id) FROM case_documents), 0),
       COALESCE((SELECT MAX(id) FROM lit_bundle_documents), 0)
     ) + 10000 AS id`,
  );
  const collisionId = collisionResult.rows[0]!.id;
  await pool.query(
    `INSERT INTO case_documents
       (id, portal, owner_key, matter_id, object_path, file_name, content_type, category)
     VALUES ($1, 'lit', $2, $3, $4, 'Collision canonical.pdf', 'application/pdf', 'evidence')`,
    [collisionId, String(ownerIds[0]), matterId, `/lawyes/${suffix}/collision-canonical.pdf`],
  );
  const [collisionBundle] = await db.insert(litBundles).values({
    accessCodeId: ownerIds[0]!,
    matterId,
    title: "Collision bundle",
  }).returning({ id: litBundles.id });
  await db.insert(litBundleDocuments).values({
    id: collisionId,
    bundleId: collisionBundle.id,
    accessCodeId: ownerIds[0]!,
    title: "Collision bundle document.pdf",
    objectPath: `/lawyes/${suffix}/collision-bundle.pdf`,
    fileName: "Collision bundle document.pdf",
    contentType: "application/pdf",
  });
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
  await connectGoogle(agentA, `google-a-${suffix}`, `google-a-${suffix}@test.invalid`, "access-a");
  await connectGoogle(agentB, `google-b-${suffix}`, `google-b-${suffix}@test.invalid`, "access-b");
});

afterAll(async () => {
  googleEnvironment.forEach((name, index) => {
    const value = previousGoogleEnvironment[index];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  });
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
  await db.delete(litConversations).where(inArray(litConversations.accessCodeId, ownerIds));
  await db.delete(litMatters).where(inArray(litMatters.accessCodeId, ownerIds));
  await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, ownerIds));
});

describe("MyLitAI Lawyes vertical slice", () => {
  it("requires authentication before the shared AI limiter/capabilities", async () => {
    const before = aiCalls.webResearch;
    const response = await request(app)
      .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
      .send({
        instruction: "Check current public sources and draft a short note.",
        researchMode: "web",
      });
    expect(response.status).toBe(401);
    expect(aiCalls.webResearch).toBe(before);
  });

  it("keeps subscriber Google connections unavailable until OAuth encryption is configured", async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
    ] as const;
    const previous = names.map((name) => process.env[name]);
    try {
      for (const name of names) delete process.env[name];
      const response = await agentA.get("/api/lit/lawyes/google/status");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ configured: false, connected: false });
    } finally {
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });

  it("starts per-lawyer Google OAuth with least-privilege Gmail and Drive scopes", async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
    ] as const;
    const previous = names.map((name) => process.env[name]);

    try {
      process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-encryption-key-at-least-thirty-two-characters";
      const response = await agentA.get("/api/lit/lawyes/google/connect");
      expect(response.status).toBe(302);
      const target = new URL(response.headers.location);
      expect(target.origin).toBe("https://accounts.google.com");
      expect(target.searchParams.get("scope")?.split(" ")).toEqual(expect.arrayContaining([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ]));
      expect(target.searchParams.get("scope")).not.toContain("gmail.send");
      expect(target.searchParams.has("include_granted_scopes")).toBe(false);
      expect(target.searchParams.get("access_type")).toBe("offline");
    } finally {
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });

  it("rejects an OAuth callback after the LAWYes tenant changes", async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
    ] as const;
    const previous = names.map((name) => process.env[name]);

    try {
      process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-encryption-key-at-least-thirty-two-characters";
      const switchingAgent = await login(codeA);
      const started = await switchingAgent.get("/api/lit/lawyes/google/connect");
      const state = new URL(started.headers.location).searchParams.get("state");
      expect((await switchingAgent.post("/api/lit/auth/login").send({ password: codeB })).status).toBe(200);
      const callback = await switchingAgent.get(`/api/lit/lawyes/google/callback?code=fake&state=${state}`);
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toContain("google=invalid_state");
    } finally {
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });

  it("rejects broader Google permissions instead of retaining incremental grants", async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
    ] as const;
    const previous = names.map((name) => process.env[name]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: "not-logged",
      refresh_token: "not-logged",
      expires_in: 3600,
      token_type: "Bearer",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/drive.file",
      ].join(" "),
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-encryption-key-at-least-thirty-two-characters";
      const scopedAgent = await login(codeA);
      const started = await scopedAgent.get("/api/lit/lawyes/google/connect");
      const state = new URL(started.headers.location).searchParams.get("state");
      const callback = await scopedAgent.get(`/api/lit/lawyes/google/callback?code=fake&state=${state}`);
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toContain("google=invalid_scopes");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchMock.mockRestore();
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });

  it("isolates and disconnects two lawyers' Google accounts inside one LAWYes tenant", async () => {
    const names = [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY",
    ] as const;
    const previous = names.map((name) => process.env[name]);
    const requiredScopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" ");
    const revokedTokens: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(String(init?.body));
        const code = body.get("code");
        return new Response(JSON.stringify({
          access_token: `access-${code}`,
          refresh_token: `refresh-${code}`,
          expires_in: 3600,
          token_type: "Bearer",
          scope: requiredScopes,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        const token = String((init?.headers as Record<string, string>)?.Authorization ?? "");
        const lawyer = token.includes("code-one")
          ? { sub: "google-subject-one", email: "lawyer.one@example.test", name: "Lawyer One" }
          : { sub: "google-subject-two", email: "lawyer.two@example.test", name: "Lawyer Two" };
        return new Response(JSON.stringify({ ...lawyer, email_verified: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://oauth2.googleapis.com/revoke") {
        const body = new URLSearchParams(String(init?.body));
        revokedTokens.push(body.get("token") ?? "");
        return new Response("", { status: 200 });
      }
      throw new Error(`Unexpected Google request: ${url}`);
    });
    try {
      process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-encryption-key-at-least-thirty-two-characters";

      const invitedOne = await agentA.post("/api/lit/lawyes/invite").send({
        name: `Google lawyer one ${suffix}`,
        role: "editor",
      });
      const invitedTwo = await agentA.post("/api/lit/lawyes/invite").send({
        name: `Google lawyer two ${suffix}`,
        role: "editor",
      });
      expect(invitedOne.status).toBe(201);
      expect(invitedTwo.status).toBe(201);
      const lawyerOne = await login(invitedOne.body.personalCode);
      const lawyerTwo = await login(invitedTwo.body.personalCode);
      for (const [agent, code] of [[lawyerOne, "code-one"], [lawyerTwo, "code-two"]] as const) {
        const started = await agent.get("/api/lit/lawyes/google/connect");
        const state = new URL(started.headers.location).searchParams.get("state");
        const callback = await agent.get(`/api/lit/lawyes/google/callback?code=${code}&state=${state}`);
        expect(callback.status).toBe(302);
        expect(callback.headers.location).toContain("google=connected");
      }

      expect((await lawyerOne.get("/api/lit/lawyes/google/status")).body.account.email)
        .toBe("lawyer.one@example.test");
      expect((await lawyerTwo.get("/api/lit/lawyes/google/status")).body.account.email)
        .toBe("lawyer.two@example.test");

      expect((await lawyerOne.post("/api/lit/auth/logout")).status).toBe(200);
      expect((await lawyerOne.post("/api/lit/auth/login")
        .send({ password: invitedOne.body.personalCode })).status).toBe(200);
      expect((await lawyerOne.get("/api/lit/lawyes/google/status")).body).toMatchObject({
        configured: true,
        connected: false,
      });
      expect((await lawyerTwo.get("/api/lit/lawyes/google/status")).body.account.email)
        .toBe("lawyer.two@example.test");

      expect((await lawyerTwo.delete("/api/lit/lawyes/google/connection")).body)
        .toEqual({ disconnected: true });
      expect(revokedTokens).toEqual(["refresh-code-two"]);

      const remaining = await pool.query<{ google_subject: string; email: string }>(
        `SELECT google_subject, email
           FROM lawyes_google_connections
          WHERE tenant_id = $1 AND lawyer_id IN ($2, $3)`,
        [
          ownerIds[0],
          `member:${invitedOne.body.member.id}`,
          `member:${invitedTwo.body.member.id}`,
        ],
      );
      expect(remaining.rows).toEqual([{
        google_subject: "google-subject-one",
        email: "lawyer.one@example.test",
      }]);
    } finally {
      fetchMock.mockRestore();
      await pool.query(`DELETE FROM lawyes_google_connections WHERE tenant_id = $1`, [ownerIds[0]]);
      names.forEach((name, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
      await connectGoogle(
        agentA,
        `google-a-${suffix}`,
        `google-a-${suffix}@test.invalid`,
        "access-a",
      );
    }
  });

  it("keeps named lawyers out of ungranted matters and enforces their granted role", async () => {
    const invited = await agentA.post("/api/lit/lawyes/invite").send({
      name: `Viewer ${suffix}`,
      email: `viewer-${suffix}@test.invalid`,
      role: "viewer",
    });
    expect(invited.status).toBe(201);
    expect(invited.body.personalCode).toMatch(/^LY-/);
    const memberId = invited.body.member.id as number;
    const memberAgent = await login(invited.body.personalCode);

    const beforeGrant = await memberAgent.get("/api/lit/lawyes/matters");
    expect(beforeGrant.status).toBe(200);
    expect(beforeGrant.body).toEqual([]);
    expect((await memberAgent.get(`/api/lit/lawyes/matters/${matterId}/workspace`)).status)
      .toBe(404);
    expect((await memberAgent.post(`/api/lit/lawyes/matters/${matterId}/save`).send({
      title: "Must not save",
      content: "No grant exists",
    })).status).toBe(404);

    expect((await agentA.put(`/api/lit/lawyes/matters/${matterId}/grants/${memberId}`)
      .send({ role: "viewer" })).status).toBe(200);
    expect((await memberAgent.get("/api/lit/lawyes/matters")).body.map(
      (matter: { id: number }) => matter.id,
    )).toEqual([matterId]);
    const viewerWorkspace = await memberAgent
      .get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(viewerWorkspace.status).toBe(200);
    expect(viewerWorkspace.body.permissions).toMatchObject({
      role: "viewer",
      canWrite: false,
      canUseConnectors: false,
    });
    const viewerResearch = viewerWorkspace.body.research[0] as { id: number; resourceType: string };
    expect((await memberAgent.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${viewerResearch.resourceType}/${viewerResearch.id}`,
    )).status).toBe(200);
    const viewerDocument = viewerWorkspace.body.documents[0] as { id: number };
    expect((await memberAgent.post(
      `/api/lit/lawyes/matters/${matterId}/evidence/${viewerDocument.id}/confirm`,
    )).status).toBe(404);
    expect((await memberAgent.post(`/api/lit/lawyes/matters/${matterId}/save`).send({
      title: "Viewer cannot save",
      content: "Still read-only",
    })).status).toBe(404);

    expect((await agentA.put(`/api/lit/lawyes/matters/${matterId}/grants/${memberId}`)
      .send({ role: "editor" })).status).toBe(200);
    expect((await memberAgent.post(`/api/lit/lawyes/matters/${matterId}/save`).send({
      title: "Editor output",
      content: "Granted editor work",
    })).status).toBe(201);

    expect((await agentA.delete(`/api/lit/lawyes/members/${memberId}`)).status).toBe(200);
    expect((await memberAgent.get("/api/lit/lawyes/identity")).status).toBe(401);
    expect((await request(app).post("/api/lit/auth/login")
      .send({ password: invited.body.personalCode })).status).toBe(401);
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
    expect(own.body.conversations.map((conversation: { id: number }) => conversation.id))
      .toEqual([linkedConversationId]);
    expect(own.body.conversations.map((conversation: { title: string }) => conversation.title))
      .not.toContain("Unlinked legacy discussion");
    const documentTitles = own.body.documents.map((document: { title: string }) => document.title);
    expect(documentTitles).toContain("Owned canonical document.pdf");
    expect(documentTitles).toContain("Collision canonical.pdf");
    expect(documentTitles).toContain("Collision bundle document.pdf");
    expect(documentTitles).not.toContain("Foreign canonical document.pdf");
    expect(documentTitles).not.toContain("Other matter document.pdf");
    expect(own.body.uploads.map((document: { title: string }) => document.title))
      .toEqual(expect.arrayContaining(["Owned canonical document.pdf", "Collision canonical.pdf"]));
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

    const research = own.body.research[0] as { id: number; resourceType: string };
    expect(research.resourceType).toBe("saved-work");
    const researchDetail = await agentA.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${research.resourceType}/${research.id}`,
    );
    expect(researchDetail.status).toBe(200);
    expect(researchDetail.body).toMatchObject({
      title: "Existing research",
      content: "Existing source-bearing work",
      readOnly: true,
      citations: [{ title: "Existing source", uri: "https://example.test/existing" }],
    });

    const draft = own.body.drafts.find(
      (item: { title: string }) => item.title === "Version two canonical draft",
    ) as { id: number; resourceType: string };
    expect(draft.resourceType).toBe("draft");
    const draftDetail = await agentA.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${draft.resourceType}/${draft.id}`,
    );
    expect(draftDetail.status).toBe(200);
    expect(draftDetail.body).toMatchObject({
      title: "Version two canonical draft",
      content: "v2",
      versionNumber: 2,
      readOnly: true,
    });

    const document = own.body.documents.find(
      (item: { title: string }) => item.title === "Owned canonical document.pdf",
    ) as { id: number; resourceType: string };
    expect(document.resourceType).toBe("case-document");
    const documentDetail = await agentA.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${document.resourceType}/${document.id}`,
    );
    expect(documentDetail.status).toBe(200);
    expect(documentDetail.body).toMatchObject({
      title: "Owned canonical document.pdf",
      originalFile: true,
      readOnly: true,
    });
    expect(documentDetail.body.fileUrl).toBe(
      `/api/lit/lawyes/matters/${matterId}/resources/case-document/${document.id}/file`,
    );
    expect((await agentA.get(
      `/api/lit/lawyes/matters/${otherMatterId}/resources/case-document/${document.id}`,
    )).status).toBe(404);
    expect((await agentB.get(
      `/api/lit/lawyes/matters/${matterId}/resources/case-document/${document.id}`,
    )).status).toBe(404);

    const collisionCanonical = own.body.documents.find(
      (item: { title: string }) => item.title === "Collision canonical.pdf",
    ) as { id: number; resourceType: string };
    const collisionBundle = own.body.documents.find(
      (item: { title: string }) => item.title === "Collision bundle document.pdf",
    ) as { id: number; resourceType: string };
    expect(collisionCanonical.id).toBe(collisionBundle.id);
    expect(collisionCanonical.resourceType).toBe("case-document");
    expect(collisionBundle.resourceType).toBe("bundle-document");
    expect((await agentA.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${collisionCanonical.resourceType}/${collisionCanonical.id}`,
    )).body.title).toBe("Collision canonical.pdf");
    expect((await agentA.get(
      `/api/lit/lawyes/matters/${matterId}/resources/${collisionBundle.resourceType}/${collisionBundle.id}`,
    )).body.title).toBe("Collision bundle document.pdf");

    const foreign = await agentB.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "Matter not found" });
  });

  it("keeps Gmail listing bound to the owned matter and connected account", async () => {
    const noGoogleCall = vi.spyOn(globalThis, "fetch");
    const foreign = await agentB.get(
      `/api/lit/lawyes/matters/${matterId}/google/gmail/messages?q=client`,
    );
    expect(foreign.status).toBe(404);
    expect(noGoogleCall).not.toHaveBeenCalled();
    noGoogleCall.mockRestore();

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        messages: [{ id: "gmail-owned-1" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "gmail-owned-1",
        snippet: "Matter correspondence",
        payload: {
          headers: [
            { name: "Subject", value: "Owned correspondence" },
            { name: "From", value: "client@test.invalid" },
          ],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      const own = await agentA.get(
        `/api/lit/lawyes/matters/${matterId}/google/gmail/messages?q=client`,
      );
      expect(own.status).toBe(200);
      expect(own.body.account).toBe(`google-a-${suffix.toLowerCase()}@test.invalid`);
      expect(own.body.messages[0]).toMatchObject({
        id: "gmail-owned-1",
        subject: "Owned correspondence",
        imported: false,
      });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/gmail/v1/users/me/messages?");
      expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(`google-b-${suffix}`);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("imports only selected Gmail IDs and deduplicates retries", async () => {
    const message = {
      id: "gmail-selected-1",
      threadId: "thread-1",
      snippet: "Selected snippet",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "Subject", value: "Selected evidence" },
          { name: "From", value: "client@test.invalid" },
          { name: "To", value: `google-a-${suffix}@test.invalid` },
          { name: "Date", value: "Tue, 2 Jan 2024 10:00:00 +0000" },
        ],
        parts: [{
          mimeType: "text/plain",
          body: { data: Buffer.from("Selected message body").toString("base64url") },
        }],
      },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify(message), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    try {
      const first = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/gmail/import`)
        .send({ messageIds: ["gmail-selected-1"] });
      expect(first.status).toBe(201);
      expect(first.body.createdCount).toBe(1);
      const retry = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/gmail/import`)
        .send({ messageIds: ["gmail-selected-1"] });
      expect(retry.status).toBe(200);
      expect(retry.body.createdCount).toBe(0);
      expect(fetchMock.mock.calls.every((call) =>
        String(call[0]).includes("/users/me/messages/gmail-selected-1"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("unselected"))).toBe(false);
      const workspace = await agentA.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
      expect(workspace.body.emails.filter(
        (email: { gmail_message_id: string }) => email.gmail_message_id === "gmail-selected-1",
      )).toHaveLength(1);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("rejects Drive writes without explicit reviewed confirmation and exports after confirmation", async () => {
    const preview = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-preview`)
      .send({ outputIds: [exportOutputId] });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({
      confirmationRequired: true,
      destination: {
        account: `google-a-${suffix.toLowerCase()}@test.invalid`,
        folderId: "root",
        folderName: "My Drive",
      },
      files: [{ outputId: exportOutputId, name: "Reviewed Drive output.md" }],
    });

    const noWrite = vi.spyOn(globalThis, "fetch");
    const rejected = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
      .send({ confirmationToken: preview.body.confirmationToken, confirmed: false });
    expect(rejected.status).toBe(400);
    expect(noWrite).not.toHaveBeenCalled();
    noWrite.mockRestore();

    const driveMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "drive-file-1",
        name: "Reviewed Drive output.md",
        webViewLink: "https://drive.google.test/file/drive-file-1",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      const exported = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
        .send({ confirmationToken: preview.body.confirmationToken, confirmed: true });
      expect(exported.status).toBe(201);
      expect(exported.body.files).toEqual([expect.objectContaining({ id: "drive-file-1" })]);
      expect(String(driveMock.mock.calls[1]?.[0])).toContain("/upload/drive/v3/files");

      const replay = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
        .send({ confirmationToken: preview.body.confirmationToken, confirmed: true });
      expect(replay.status).toBe(409);
      expect(driveMock).toHaveBeenCalledTimes(2);
    } finally {
      driveMock.mockRestore();
    }
  });

  it("rejects a changed output after review before making any Drive write", async () => {
    const preview = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-preview`)
      .send({ outputIds: [exportOutputId] });
    expect(preview.status).toBe(200);
    await pool.query(`UPDATE lit_saved_work SET content = $1 WHERE id = $2`, [
      "This content changed after the practitioner reviewed the export.",
      exportOutputId,
    ]);
    const noWrite = vi.spyOn(globalThis, "fetch");
    try {
      const stale = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
        .send({ confirmationToken: preview.body.confirmationToken, confirmed: true });
      expect(stale.status).toBe(409);
      expect(stale.body.error).toContain("selection has changed");
      expect(noWrite).not.toHaveBeenCalled();
    } finally {
      noWrite.mockRestore();
    }
  });

  it("resumes a failed two-file export without recreating completed files", async () => {
    const extra = await db.insert(litSavedWork).values({
      accessCodeId: ownerIds[0]!,
      matterId,
      title: "Second reviewed Drive output",
      kind: "lawyes-draft",
      content: "Second confidential output.",
      inputJson: { lawyes: true },
    }).returning({ id: litSavedWork.id });
    const preview = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-preview`)
      .send({ outputIds: [exportOutputId, extra[0]!.id] });
    expect(preview.status).toBe(200);
    const driveMock = vi.spyOn(globalThis, "fetch")
      // first item: no ambiguous prior file, then successful create
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "drive-first", name: "Reviewed Drive output.md",
      }), { status: 200 }))
      // second item: lookup passes, create fails
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("temporary failure", { status: 503 }))
      // retry skips first completed ledger item; only second is looked up/created
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "drive-second", name: "Second reviewed Drive output.md",
      }), { status: 200 }));
    try {
      const firstAttempt = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
        .send({ confirmationToken: preview.body.confirmationToken, confirmed: true });
      expect(firstAttempt.status).toBe(502);
      expect(firstAttempt.body).toMatchObject({ retryable: true });
      expect(firstAttempt.body.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "drive-first", status: "completed" }),
      ]));

      const retry = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`)
        .send({ confirmationToken: preview.body.confirmationToken, confirmed: true });
      expect(retry.status).toBe(201);
      expect(retry.body.files).toHaveLength(2);
      const uploadCalls = driveMock.mock.calls.filter((call) =>
        String(call[0]).includes("/upload/drive/v3/files"));
      expect(uploadCalls).toHaveLength(3);
      expect(String(uploadCalls[0]![0])).toContain("/upload/drive/v3/files");
    } finally {
      driveMock.mockRestore();
    }
  });

  it("creates and links conversations only when both conversation and matter are owned", async () => {
    const created = await agentA.post("/api/lit/gemini/litConversations").send({
      title: "Created for this matter",
      matterId,
    });
    expect(created.status).toBe(201);
    expect(created.body.matterId).toBe(matterId);

    const unlinked = await agentA.post("/api/lit/gemini/litConversations").send({
      title: "Explicitly linked later",
    });
    expect(unlinked.status).toBe(201);
    expect(unlinked.body.matterId).toBeNull();

    const linked = await agentA
      .patch(`/api/lit/gemini/litConversations/${unlinked.body.id}/matter`)
      .send({ matterId: otherMatterId });
    expect(linked.status).toBe(200);
    expect(linked.body.matterId).toBe(otherMatterId);

    const foreignConversation = await agentB
      .patch(`/api/lit/gemini/litConversations/${created.body.id}/matter`)
      .send({ matterId });
    expect(foreignConversation.status).toBe(404);

    const foreignMatter = await agentB.post("/api/lit/gemini/litConversations").send({
      title: "Must not cross tenant",
      matterId,
    });
    expect(foreignMatter.status).toBe(404);

    const matterOne = await agentA.get(`/api/lit/lawyes/matters/${matterId}/workspace`);
    expect(matterOne.body.conversations.map((item: { title: string }) => item.title))
      .toContain("Created for this matter");
    expect(matterOne.body.conversations.map((item: { title: string }) => item.title))
      .not.toContain("Explicitly linked later");

    const matterTwo = await agentA.get(`/api/lit/lawyes/matters/${otherMatterId}/workspace`);
    expect(matterTwo.body.conversations.map((item: { title: string }) => item.title))
      .toContain("Explicitly linked later");
    expect(matterTwo.body.conversations.map((item: { title: string }) => item.title))
      .not.toContain("Created for this matter");
  });

  it("denies evidence mutations to a viewer member before storage or verification work", async () => {
    const invited = await agentA.post("/api/lit/lawyes/invite").send({
      name: `Evidence viewer ${suffix}`,
      role: "viewer",
    });
    expect(invited.status).toBe(201);
    const memberAgent = await login(invited.body.personalCode);
    const granted = await agentA.put(`/api/lit/lawyes/matters/${matterId}/grants`).send({
      memberId: invited.body.member.id,
      role: "viewer",
    });
    expect(granted.status).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const upload = await memberAgent
        .post(`/api/lit/lawyes/matters/${matterId}/evidence/upload-url`).send({});
      const analyse = await memberAgent
        .post(`/api/lit/lawyes/matters/${matterId}/evidence/analyse`)
        .send({ objectPath: "/objects/never-claimed", fileName: "evidence.png", contentType: "image/png" });
      const confirm = await memberAgent
        .post(`/api/lit/lawyes/matters/${matterId}/evidence/1/confirm`).send({});

      expect(upload.status).toBe(404);
      expect(analyse.status).toBe(404);
      expect(confirm.status).toBe(404);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("runs research plus matter drafting, returns sources/verification, and reloads a retry-safe save", async () => {
    const body = {
      instruction: "Research the issue and draft a concise advice note.",
      researchMode: "verified_library",
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
      "verified_internal_legal_research",
      "matter_aware_review_or_drafting",
    ]);
    expect(first.body.citations[0].uri).toBe("https://example.test/federal-court");
    expect(first.body.citations[0]).toMatchObject({
      origin: "internal_verified",
      verified: true,
      judgmentId: 91,
      citation: "[2026] LAWYES 91",
      court: "Federal Court",
    });
    expect(first.body.citations[0].pinpoints[0]).toMatchObject({
      paragraphRef: "[12]",
      pageNumber: 4,
    });
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
    expect(researchCalls.count).toBeGreaterThanOrEqual(2);
    expect(aiCalls.drafting).toBeGreaterThanOrEqual(2);
    const prompt = aiCalls.draftingPrompts.at(-1) ?? "";
    expect(prompt).not.toContain("accessCodeId");
    expect(prompt).not.toContain(String(ownerIds[0]));
  });

  it("fails closed when the verified library returns no relevant authority", async () => {
    researchCalls.available = false;
    const draftingBefore = aiCalls.drafting;
    try {
      const response = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
        .send({
          instruction: "Research this issue and draft an advice note.",
          researchMode: "verified_library",
        });
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: "verified_sources_unavailable",
        verification: {
          status: "requires_independent_verification",
          verified: false,
        },
      });
      expect(aiCalls.drafting).toBe(draftingBefore);
    } finally {
      researchCalls.available = true;
    }
  });

  it("uses web research only when the lawyer explicitly selects it", async () => {
    const verifiedCallsBefore = researchCalls.count;
    const webCallsBefore = aiCalls.webResearch;
    const response = await agentA
      .post(`/api/lit/lawyes/matters/${matterId}/instructions`)
      .send({
        instruction: "Check current public sources and draft a short note.",
        researchMode: "web",
      });

    expect(response.status).toBe(200);
    expect(response.body.researchMode).toBe("web");
    expect(response.body.capabilities).toContain("explicit_web_legal_research");
    expect(response.body.citations[0]).toMatchObject({
      origin: "web",
      verified: false,
      uri: "https://example.test/public",
    });
    expect(researchCalls.count).toBe(verifiedCallsBefore);
    expect(aiCalls.webResearch).toBe(webCallsBefore + 1);
  });

  it("migrates only shared-code legacy Google rows and permits a same-subject reconnect", async () => {
    const subject = `legacy-google-${suffix}`;
    const email = `${subject}@test.invalid`;
    await pool.query(`DELETE FROM lawyes_google_connections WHERE tenant_id=$1`, [ownerIds[0]]);
    await connectGoogle(agentA, subject, email, "temporary-current-access");
    await pool.query(`DELETE FROM lawyes_google_connections WHERE tenant_id=$1`, [ownerIds[0]]);
    const legacyEncrypted = encryptGoogleTokens({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh",
      expiresAt: Date.now() + 3_600_000,
      tokenType: "Bearer",
    }, `lawyes:${ownerIds[0]}:${subject}`);
    await pool.query(
      `INSERT INTO lawyes_google_connections
        (tenant_id, lawyer_id, google_subject, email, encrypted_tokens, granted_scopes)
       VALUES ($1,$2,$2,$3,$4,$5)`,
      [ownerIds[0], subject, email, legacyEncrypted, [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ]],
    );
    await connectGoogle(agentA, subject, email, "direct-reconnect-access");
    const directlyReconnected = await pool.query<{ lawyer_id: string; encrypted_tokens: string }>(
      `SELECT lawyer_id, encrypted_tokens FROM lawyes_google_connections
        WHERE tenant_id=$1 AND google_subject=$2`,
      [ownerIds[0], subject],
    );
    expect(directlyReconnected.rows).toHaveLength(1);
    expect(directlyReconnected.rows[0]!.lawyer_id).toBe("legacy-owner");
    expect(directlyReconnected.rows[0]!.encrypted_tokens).not.toBe(legacyEncrypted);

    const migrationSubject = `status-legacy-google-${suffix}`;
    const migrationEmail = `${migrationSubject}@test.invalid`;
    await pool.query(`DELETE FROM lawyes_google_connections WHERE tenant_id=$1`, [ownerIds[0]]);
    await connectGoogle(agentA, migrationSubject, migrationEmail, "temporary-migration-access");
    await pool.query(`DELETE FROM lawyes_google_connections WHERE tenant_id=$1`, [ownerIds[0]]);
    const migrationEncrypted = encryptGoogleTokens({
      accessToken: "status-legacy-access",
      refreshToken: "status-legacy-refresh",
      expiresAt: Date.now() + 3_600_000,
      tokenType: "Bearer",
    }, `lawyes:${ownerIds[0]}:${migrationSubject}`);
    await pool.query(
      `INSERT INTO lawyes_google_connections
        (tenant_id, lawyer_id, google_subject, email, encrypted_tokens, granted_scopes)
       VALUES ($1,$2,$2,$3,$4,$5)`,
      [ownerIds[0], migrationSubject, migrationEmail, migrationEncrypted, [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ]],
    );
    const status = await agentA.get("/api/lit/lawyes/google/status");
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ connected: true, account: { email: migrationEmail } });
    const migrated = await pool.query<{ lawyer_id: string; encrypted_tokens: string }>(
      `SELECT lawyer_id, encrypted_tokens FROM lawyes_google_connections
        WHERE tenant_id=$1 AND google_subject=$2`,
      [ownerIds[0], migrationSubject],
    );
    expect(migrated.rows).toHaveLength(1);
    expect(migrated.rows[0]!.lawyer_id).toBe("legacy-owner");
    expect(migrated.rows[0]!.encrypted_tokens).not.toBe(migrationEncrypted);

    const googleMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    try {
      const gmail = await agentA.get(
        `/api/lit/lawyes/matters/${matterId}/google/gmail/messages?q=legacy`,
      );
      expect(gmail.status).toBe(200);
      expect(gmail.body.account).toBe(migrationEmail);
      const drive = await agentA
        .post(`/api/lit/lawyes/matters/${matterId}/google/drive/export-preview`)
        .send({ outputIds: [exportOutputId] });
      expect(drive.status).toBe(200);
      expect(drive.body.destination.account).toBe(migrationEmail);
    } finally {
      googleMock.mockRestore();
    }

    const invited = await agentA.post("/api/lit/lawyes/invite").send({
      name: `Legacy isolation member ${suffix}`,
      role: "editor",
    });
    const memberAgent = await login(invited.body.personalCode);
    await agentA.put(`/api/lit/lawyes/matters/${matterId}/grants`).send({
      memberId: invited.body.member.id,
      role: "editor",
    });
    const memberSubject = `member-legacy-${suffix}`;
    await connectGoogle(memberAgent, memberSubject, `${memberSubject}@test.invalid`, "member-access");
    await pool.query(
      `DELETE FROM lawyes_google_connections WHERE tenant_id=$1 AND lawyer_id=$2`,
      [ownerIds[0], `member:${invited.body.member.id}`],
    );
    const memberLegacy = encryptGoogleTokens({
      accessToken: "member-legacy-access",
      refreshToken: "member-legacy-refresh",
      expiresAt: Date.now() + 3_600_000,
      tokenType: "Bearer",
    }, `lawyes:${ownerIds[0]}:${memberSubject}`);
    await pool.query(
      `INSERT INTO lawyes_google_connections
        (tenant_id, lawyer_id, google_subject, email, encrypted_tokens, granted_scopes)
       VALUES ($1,$2,$2,$3,$4,'{}')`,
      [ownerIds[0], memberSubject, `${memberSubject}@test.invalid`, memberLegacy],
    );
    const memberStatus = await memberAgent.get("/api/lit/lawyes/google/status");
    expect(memberStatus.body).toMatchObject({ connected: false });
    const untouched = await pool.query<{ lawyer_id: string; encrypted_tokens: string }>(
      `SELECT lawyer_id, encrypted_tokens FROM lawyes_google_connections
        WHERE tenant_id=$1 AND google_subject=$2`,
      [ownerIds[0], memberSubject],
    );
    expect(untouched.rows[0]).toEqual({
      lawyer_id: memberSubject,
      encrypted_tokens: memberLegacy,
    });
  });
});
