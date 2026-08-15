/**
 * Integration tests for the shared file-extraction endpoint:
 *   POST /api/shared/uploads/extract
 *
 * Covers:
 *  - Auth gate: 401 for no auth, bad token, revoked/inactive/expired sessions.
 *  - Portal-specific auth paths:
 *      • CCB JWT Bearer (role=practitioner) — JWT-only, no DB.
 *      • Corp opaque Bearer token — DB lookup against corp_sessions.
 *      • Lit session cookie — DB lookup against lit_sessions.
 *      • Accident master token — HMAC validation, no DB.
 *      • Accident DB session — lookup against access_code_usage.
 *  - Input validation: no files (400), file too large (413).
 *  - Extraction: TXT, MD, unsupported image.
 *  - Character caps: per-file (15 000) and combined (18 000).
 *  - Rate limit: 429 after 10 requests per IP.
 */
import crypto from "node:crypto";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";

// ── Mock Clerk so app.ts initialises without real credentials ─────────────────
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => { throw new Error("not found"); } } },
}));

const { default: app } = await import("../app");

// ── Auth helpers ──────────────────────────────────────────────────────────────

const TEST_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

/** CCB JWT: role=practitioner, no DB lookup required. */
const CCB_TOKEN = jwt.sign({ role: "practitioner", code: "TEST" }, TEST_SECRET, {
  expiresIn: "1h",
});

/**
 * Replicate cookie-signature's sign() output so tests can create valid signed
 * cookies without importing an additional package.
 * Format: `${value}.${HMAC-SHA256(value, secret).base64url}`
 */
function signCookieValue(value: string, secret: string): string {
  return (
    value +
    "." +
    crypto.createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, "")
  );
}

/**
 * Build the raw Cookie header value for an express-session signed cookie.
 * cookie-parser expects: `s:<value>.<hmac>` — percent-encoded in the header.
 */
function makeSignedCookieHeader(name: string, sessionId: string, secret: string): string {
  const signed = `s:${signCookieValue(sessionId, secret)}`;
  return `${name}=${encodeURIComponent(signed)}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUpload(
  files: Array<{ name: string; content: Buffer; mime?: string }>,
  opts: {
    authHeader?: string;
    cookie?: string;
    ip?: string;
    noAuth?: boolean;
  } = {},
) {
  const req = request(app).post("/api/shared/uploads/extract");
  if (opts.authHeader) req.set("Authorization", opts.authHeader);
  if (opts.cookie) req.set("Cookie", opts.cookie);
  if (opts.ip) req.set("X-Forwarded-For", opts.ip);
  for (const f of files) {
    req.attach("files", f.content, { filename: f.name, contentType: f.mime ?? "text/plain" });
  }
  return req;
}

const txt = (s: string) => Buffer.from(s, "utf-8");
const HELLO = [{ name: "test.txt", content: txt("Hello") }];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/shared/uploads/extract", () => {
  // Pin every non-rate-limit test to a dedicated TEST-NET IP so it never
  // bleeds into the rate-limit test's bucket (203.0.113.77).
  const MAIN_IP = "198.51.100.99";
  const auth = { authHeader: `Bearer ${CCB_TOKEN}`, ip: MAIN_IP };

  // ── Auth gate (existing JWT path) ─────────────────────────────────────────

  it("returns 401 when the request has no portal auth", async () => {
    const res = await request(app)
      .post("/api/shared/uploads/extract")
      .set("X-Forwarded-For", MAIN_IP)
      .attach("files", txt("hello"), { filename: "hi.txt", contentType: "text/plain" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it("returns 401 for an expired or invalid JWT Bearer token", async () => {
    const badToken = jwt.sign({ role: "practitioner" }, "wrong-secret");
    const res = await buildUpload(HELLO, { authHeader: `Bearer ${badToken}`, ip: MAIN_IP });
    expect(res.status).toBe(401);
  });

  it("CCB JWT Bearer (role=practitioner) → 200", async () => {
    const res = await buildUpload(HELLO, auth);
    expect(res.status).toBe(200);
  });

  // ── Input validation ───────────────────────────────────────────────────────

  it("returns 400 when no files are uploaded (auth passes)", async () => {
    const res = await request(app)
      .post("/api/shared/uploads/extract")
      .set("Authorization", `Bearer ${CCB_TOKEN}`)
      .set("X-Forwarded-For", MAIN_IP);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no files/i);
  });

  it("returns 413 for a file that exceeds the per-file size limit (5 MB)", async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, "A");
    const res = await buildUpload([{ name: "big.txt", content: bigBuffer }], auth);
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/file too large/i);
  });

  // ── Extraction ────────────────────────────────────────────────────────────

  it("extracts text from a plain-text file", async () => {
    const content = "Hello, this is a test document for extraction.";
    const res = await buildUpload([{ name: "doc.txt", content: txt(content) }], auth);
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].text).toBe(content);
    expect(res.body.files[0].chars).toBe(content.length);
    expect(res.body.files[0].error).toBeUndefined();
  });

  it("extracts text from a markdown file", async () => {
    const content = "# Title\n\nBody paragraph.";
    const res = await buildUpload(
      [{ name: "notes.md", content: txt(content), mime: "text/markdown" }],
      auth,
    );
    expect(res.status).toBe(200);
    expect(res.body.files[0].text).toContain("Title");
  });

  it("returns an error entry for unsupported image files", async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = await buildUpload(
      [{ name: "photo.jpg", content: fakeJpeg, mime: "image/jpeg" }],
      auth,
    );
    expect(res.status).toBe(200);
    const f = res.body.files[0];
    expect(f.error).toBeTruthy();
    expect(f.text).toBe("");
  });

  // ── Character / size caps ─────────────────────────────────────────────────

  it("truncates a single file that exceeds MAX_CHARS_PER_FILE (15 000)", async () => {
    const longContent = "A".repeat(20_000);
    const res = await buildUpload([{ name: "big.txt", content: txt(longContent) }], auth);
    expect(res.status).toBe(200);
    const f = res.body.files[0];
    expect(f.truncated).toBe(true);
    expect(f.chars).toBeLessThanOrEqual(15_500);
    expect(f.text).toContain("truncated");
  });

  it("enforces TOTAL_CHARS_CAP (18 000) across multiple files", async () => {
    const chunk = "B".repeat(12_000);
    const res = await buildUpload(
      [{ name: "a.txt", content: txt(chunk) }, { name: "b.txt", content: txt(chunk) }],
      auth,
    );
    expect(res.status).toBe(200);
    const totalChars = (res.body.files as Array<{ chars: number }>).reduce(
      (s, f) => s + f.chars,
      0,
    );
    expect(totalChars).toBeLessThanOrEqual(18_500);
    const anyTruncated = (res.body.files as Array<{ truncated?: boolean; error?: string }>).some(
      (f) => f.truncated || (f.error ?? "").includes("limit"),
    );
    expect(anyTruncated).toBe(true);
  });

  it("accepts up to 5 files and returns a result for each", async () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      name: `file${i}.txt`,
      content: txt(`Content of file ${i}`),
    }));
    // Uses a distinct IP to avoid exhausting the MAIN_IP bucket (10 req/15 min).
    const res = await buildUpload(files, { authHeader: `Bearer ${CCB_TOKEN}`, ip: "198.51.100.98" });
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(5);
  });

  // ── Rate limit ────────────────────────────────────────────────────────────

  it("returns 429 after exceeding the IP rate limit (max=10)", async () => {
    const uniqueIp = "203.0.113.77";
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await buildUpload(HELLO, { authHeader: `Bearer ${CCB_TOKEN}`, ip: uniqueIp });
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});

// ── Portal-specific auth integration tests ─────────────────────────────────

describe("Portal-specific auth paths (DB-backed)", () => {
  // Each portal group gets its own TEST-NET IP so the 10 req/15 min bucket
  // is never exhausted within a group (max 4 requests per group).
  const CORP_IP     = "198.51.100.11";
  const LIT_IP      = "198.51.100.12";
  const ACCIDENT_IP = "198.51.100.13";

  const buildCorp     = (files: typeof HELLO, opts: { authHeader?: string } = {}) =>
    buildUpload(files, { ip: CORP_IP, ...opts });
  const buildLit      = (files: typeof HELLO, opts: { cookie?: string } = {}) =>
    buildUpload(files, { ip: LIT_IP, ...opts });
  const buildAccident = (files: typeof HELLO, opts: { cookie?: string } = {}) =>
    buildUpload(files, { ip: ACCIDENT_IP, ...opts });

  const RUN_ID = crypto.randomBytes(4).toString("hex");

  // Corp test data
  let corpCodeId: number;
  const CORP_ACTIVE_TOKEN = `tc-active-${RUN_ID}`;
  const CORP_INACTIVE_TOKEN = `tc-inactive-${RUN_ID}`;

  // Lit session test data
  const LIT_SESSION_ID = `tl-${RUN_ID}`;

  // Accident test data
  let accidentCodeId: number;
  const ACCIDENT_SESSION_ID = `ta-${RUN_ID}`;

  beforeAll(async () => {
    // Corp: insert an access code + one active and one inactive session.
    const { rows: codeRows } = await pool.query<{ id: number }>(
      `INSERT INTO corp_access_codes (code, is_active) VALUES ($1, true) RETURNING id`,
      [`TCTST${RUN_ID}`],
    );
    corpCodeId = codeRows[0].id;

    await pool.query(
      `INSERT INTO corp_sessions (access_code_id, session_token, is_active, logged_in_at, last_seen_at)
       VALUES ($1, $2, true,  NOW(), NOW()),
              ($1, $3, false, NOW(), NOW())`,
      [corpCodeId, CORP_ACTIVE_TOKEN, CORP_INACTIVE_TOKEN],
    );

    // Lit: insert a live session with authenticated=true.
    await pool.query(
      `INSERT INTO lit_sessions (sid, sess, expire)
       VALUES ($1, $2::jsonb, NOW() + interval '7 days')`,
      [LIT_SESSION_ID, JSON.stringify({ authenticated: true, accessCodeId: 1 })],
    );

    // Accident: insert an access code + usage row.
    const { rows: accRows } = await pool.query<{ id: number }>(
      `INSERT INTO access_codes (code, label, max_users, is_active)
       VALUES ($1, 'Test', 1, true) RETURNING id`,
      [`TATST${RUN_ID}`],
    );
    accidentCodeId = accRows[0].id;

    await pool.query(
      `INSERT INTO access_code_usage (access_code_id, session_id)
       VALUES ($1, $2)`,
      [accidentCodeId, ACCIDENT_SESSION_ID],
    );
  });

  afterAll(async () => {
    // Clean up in reverse FK dependency order.
    await pool.query(
      `DELETE FROM corp_sessions WHERE session_token IN ($1, $2)`,
      [CORP_ACTIVE_TOKEN, CORP_INACTIVE_TOKEN],
    );
    await pool.query(`DELETE FROM corp_access_codes WHERE id = $1`, [corpCodeId]);
    await pool.query(`DELETE FROM lit_sessions WHERE sid = $1`, [LIT_SESSION_ID]);
    await pool.query(`DELETE FROM access_code_usage WHERE session_id = $1`, [ACCIDENT_SESSION_ID]);
    await pool.query(`DELETE FROM access_codes WHERE id = $1`, [accidentCodeId]);
  });

  // ── Corp opaque Bearer token ──────────────────────────────────────────────

  it("Corp: active opaque session token → 200", async () => {
    const res = await buildCorp(HELLO, { authHeader: `Bearer ${CORP_ACTIVE_TOKEN}` });
    expect(res.status).toBe(200);
  });

  it("Corp: inactive session (is_active=false) → 401", async () => {
    const res = await buildCorp(HELLO, { authHeader: `Bearer ${CORP_INACTIVE_TOKEN}` });
    expect(res.status).toBe(401);
  });

  it("Corp: completely unknown token → 401", async () => {
    const res = await buildCorp(HELLO, { authHeader: `Bearer totally-unknown-${RUN_ID}` });
    expect(res.status).toBe(401);
  });

  it("Corp: expired access code → 401", async () => {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO corp_access_codes (code, is_active, expires_at)
       VALUES ($1, true, NOW() - interval '1 day') RETURNING id`,
      [`TCEXP${RUN_ID}`],
    );
    const expiredCodeId = rows[0].id;
    const expiredToken = `tc-expired-${RUN_ID}`;
    await pool.query(
      `INSERT INTO corp_sessions (access_code_id, session_token, is_active, logged_in_at, last_seen_at)
       VALUES ($1, $2, true, NOW(), NOW())`,
      [expiredCodeId, expiredToken],
    );
    try {
      const res = await buildCorp(HELLO, { authHeader: `Bearer ${expiredToken}` });
      expect(res.status).toBe(401);
    } finally {
      await pool.query(`DELETE FROM corp_sessions WHERE access_code_id = $1`, [expiredCodeId]);
      await pool.query(`DELETE FROM corp_access_codes WHERE id = $1`, [expiredCodeId]);
    }
  });

  // ── Lit session cookie ────────────────────────────────────────────────────

  it("Lit: valid signed session cookie (authenticated=true) → 200", async () => {
    const cookie = makeSignedCookieHeader("lit.sid", LIT_SESSION_ID, TEST_SECRET);
    const res = await buildLit(HELLO, { cookie });
    expect(res.status).toBe(200);
  });

  it("Lit: tampered cookie (bad signature) → 401", async () => {
    const res = await buildLit(HELLO, { cookie: "lit.sid=s%3Afake-session.badsignature" });
    expect(res.status).toBe(401);
  });

  it("Lit: valid signature but session not in DB → 401", async () => {
    const nonExistentId = `ghost-${RUN_ID}`;
    const cookie = makeSignedCookieHeader("lit.sid", nonExistentId, TEST_SECRET);
    const res = await buildLit(HELLO, { cookie });
    expect(res.status).toBe(401);
  });

  // ── Accident master token (HMAC only, no DB) ──────────────────────────────

  it("Accident: valid HMAC master token → 200", async () => {
    const nonce = crypto.randomBytes(8).toString("hex");
    const hmac = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`master:${nonce}`)
      .digest("hex");
    const masterToken = `master.${nonce}.${hmac}`;
    const res = await buildAccident(HELLO, { cookie: `session_id=${masterToken}` });
    expect(res.status).toBe(200);
  });

  it("Accident: tampered master token (wrong HMAC) → 401", async () => {
    const res = await buildAccident(HELLO, {
      cookie: "session_id=master.fakenonce.0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(res.status).toBe(401);
  });

  // ── Accident DB session ───────────────────────────────────────────────────

  it("Accident: valid session_id from access_code_usage → 200", async () => {
    const res = await buildAccident(HELLO, { cookie: `session_id=${ACCIDENT_SESSION_ID}` });
    expect(res.status).toBe(200);
  });

  it("Accident: unknown session_id → 401", async () => {
    const res = await buildAccident(HELLO, { cookie: `session_id=unknown-${RUN_ID}` });
    expect(res.status).toBe(401);
  });
});
