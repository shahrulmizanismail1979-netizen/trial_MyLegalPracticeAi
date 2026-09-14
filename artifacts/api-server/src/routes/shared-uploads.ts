/**
 * Shared file-extraction endpoint — accepts multipart file uploads and returns
 * extracted plain text. Requires an authenticated portal session (any portal).
 * Mounted at /api/shared/uploads/extract.
 *
 * Auth order (first to pass wins):
 *  1. Corp opaque Bearer token    → corp_sessions JOIN corp_access_codes, is_active=true,
 *                                   expiry check, idle-TTL check (mirrors requireSession).
 *  2. CCB JWT Bearer              → jwt.verify(SESSION_SECRET) + role=practitioner|admin
 *                                   (mirrors requirePractitioner JWT path).
 *  3. Convey JWT Bearer           → jwt.verify(SESSION_SECRET) + DB user active + code expiry
 *                                   (mirrors attachUser/requireAuth).
 *  4. Session-cookie portals      → real DB session-store lookup, not just cookie presence:
 *       lit.sid  → lit_sessions  (sess.authenticated)
 *       crim.sid → user_sessions (sess.authenticated)
 *       sya.sid  → user_sessions (sess.userId)
 *       acad.sid → acad_user_sessions (sess.acadUserId)
 *  5. Accident `session_id` cookie → master-token HMAC validation OR
 *                                    access_code_usage DB lookup (mirrors check-session).
 *
 * Resource limits:
 *  - 5 MB per file, max 5 files per request.
 *  - 8-second extraction timeout per file.
 *  - Files processed sequentially (not concurrently) to bound peak CPU/memory.
 *  - Per-file text cap: 15 000 chars.
 *  - Combined cap: 18 000 chars (fits the 20 000-char matter notes limit).
 *
 * Supported: PDF (text-based), DOCX, TXT, MD. Images return an error entry.
 */
import crypto from "node:crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { eq, and, gt } from "drizzle-orm";
import { Router, type Request, type Response, type NextFunction } from "express";
import mammoth from "mammoth";
import { db, pool, corpSessions, corpAccessCodes, ccbAccessCodes } from "@workspace/db";
import { accessCodeUsageTable } from "@workspace/db/schema";
import { isConveyCodeExpired } from "../middlewares/conveyAuth.js";
import { SEAT_TTL_MS, claimSeat, deviceSeatKey } from "../lib/seatLimits.js";
import { logger } from "../lib/logger.js";
import {
  getMasterAccessFingerprint,
  isMasterAccessCode,
} from "../lib/masterAccess.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES = 5;
/** Maximum milliseconds to spend parsing a single file. */
const EXTRACTION_TIMEOUT_MS = 8_000;
/** Per-file character cap — keeps individual file previews readable. */
const MAX_CHARS_PER_FILE = 15_000;
/**
 * Combined cap across all files in one request.
 * Aligned with the matter `notes` field limit (20 000 chars) so that
 * the extracted context actually fits when persisted.
 */
const TOTAL_CHARS_CAP = 18_000;

// Shared SESSION_SECRET — all portals sign their sessions/tokens with this.
const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();
const CCB_MASTER_TOKEN_ID = "ccb-master-session";

// ── Per-portal auth helpers ────────────────────────────────────────────────────

/**
 * Corp: validates an opaque Bearer session token against corp_sessions.
 * Replicates requireSession's active-flag, expiry, and idle-TTL checks.
 */
async function tryCorpAuth(token: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ session: corpSessions, code: corpAccessCodes })
      .from(corpSessions)
      .innerJoin(corpAccessCodes, eq(corpSessions.accessCodeId, corpAccessCodes.id))
      .where(and(eq(corpSessions.sessionToken, token), eq(corpSessions.isActive, true)));
    if (!row) return false;
    if (row.code.expiresAt && new Date(row.code.expiresAt) < new Date()) return false;
    if (row.session.lastSeenAt.getTime() < Date.now() - SEAT_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

// ── CCB static-code set (mirrors ccb/routes/auth.ts STATIC_CODES) ─────────────
// Evaluated once at module load so the cost is paid once, not per request.
const CCB_STATIC_CODES: ReadonlySet<string> = (() => {
  const envList = process.env.CCB_ACCESS_CODES
    ? process.env.CCB_ACCESS_CODES.split(",")
    : ["CCBLIT2024", "MYCCBLIT", "UKM2024", "PRACTITIONER"];
  return new Set(
    envList
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0),
  );
})();

/**
 * CCB: validates a JWT Bearer token; requires role practitioner or admin AND
 * either membership in the canonical static-code set OR a live DB row in
 * ccb_access_codes (active=true, not expired, seat available).
 *
 * Fully mirrors requirePractitioner from ccb/routes/auth.ts:
 *  - Static/env codes → always allowed, no DB lookup.
 *  - DB codes → active check, expiry check, and claimSeat for capped codes.
 *  - Unknown code (no DB row, not static) → always denied (fail closed).
 *  - Missing/empty code field in the JWT → denied.
 *  - DB errors during seat claim → fail closed (deny).
 */
async function tryCCBAuth(
  payload: Record<string, unknown>,
  req: Request,
): Promise<boolean> {
  if (payload.role !== "practitioner" && payload.role !== "admin") return false;
  const rawCode = typeof payload.code === "string" ? payload.code : "";
  const code = rawCode.trim().toUpperCase();
  if (!code) return false; // No code field — not a standard practitioner JWT.
  const isMaster =
    payload.master === true &&
    rawCode === CCB_MASTER_TOKEN_ID &&
    payload.masterFingerprint === getMasterAccessFingerprint();
  // Legacy CCB owner JWTs contained the raw configured credential. They are
  // intentionally not accepted; the owner must sign in again for an opaque,
  // rotation-aware token.
  if (payload.master === true || rawCode === CCB_MASTER_TOKEN_ID || isMasterAccessCode(rawCode)) {
    return isMaster;
  }
  if (CCB_STATIC_CODES.has(code)) return true;
  try {
    const [row] = await db
      .select({
        active: ccbAccessCodes.active,
        expiresAt: ccbAccessCodes.expiresAt,
        maxSeats: ccbAccessCodes.maxSeats,
      })
      .from(ccbAccessCodes)
      .where(eq(ccbAccessCodes.code, code));
    if (!row) return false; // Unknown code — not static, no DB row → deny.
    if (!row.active) return false;
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return false;
    // Seat enforcement for capped codes — fail closed on errors.
    if (row.maxSeats != null) {
      let claim: Awaited<ReturnType<typeof claimSeat>>;
      try {
        claim = await claimSeat({
          portal: "ccb",
          code,
          maxSeats: row.maxSeats,
          seatKey: deviceSeatKey(req),
        });
      } catch {
        return false; // Seat registry error — deny to prevent oversubscription.
      }
      if (!claim.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Convey: verifies JWT uid + DB user active + code not expired + seat claim.
 * Uses raw SQL to avoid usersTable ambiguity in the schema barrel.
 * Replicates attachUser/requireAuth from conveyAuth middleware, including the
 * claimSeat guard for capped-seat (team-bundle) access codes.
 */
async function tryConveyAuth(uid: number, req: Request): Promise<boolean> {
  try {
    const { rows } = await pool.query<{
      access_code: string | null;
      is_active: boolean;
      max_seats: number | null;
    }>(
      `SELECT access_code, is_active, max_seats FROM users WHERE id = $1`,
      [uid],
    );
    const user = rows[0];
    if (!user || !user.is_active) return false;
    if (await isConveyCodeExpired(user.access_code)) return false;
    // Enforce seat limits for team-bundle codes (mirrors attachUser).
    if (user.access_code && user.max_seats != null) {
      const claim = await claimSeat({
        portal: "convey",
        code: user.access_code,
        maxSeats: user.max_seats,
        seatKey: deviceSeatKey(req),
      });
      if (!claim.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Session-cookie portals: looks up the session record in the portal's own
 * session store table, then checks the portal-specific auth field in the
 * stored JSON session object.
 *
 * This is stronger than checking the signed cookie alone: an expired or
 * server-side-invalidated session returns no row and is rejected.
 */
async function trySessionCookieAuth(req: Request): Promise<boolean> {
  // andField (optional): a second session field that must also be truthy.
  // For Lit we require accessCodeId in addition to authenticated so that only
  // subscription-bound sessions are accepted (mirrors requireAnyPortalAuth).
  const checks: Array<{ cookie: string; table: string; authField: string; andField?: string }> = [
    { cookie: "lit.sid",  table: "lit_sessions",       authField: "authenticated", andField: "accessCodeId" },
    { cookie: "crim.sid", table: "user_sessions",       authField: "authenticated" },
    { cookie: "sya.sid",  table: "user_sessions",       authField: "userId"        },
    { cookie: "acad.sid", table: "acad_user_sessions",  authField: "acadUserId"    },
  ];
  for (const { cookie, table, authField, andField } of checks) {
    // When cookieParser is initialised with SESSION_SECRET (as app.ts does), it
    // moves verified signed cookies from req.cookies into req.signedCookies and
    // deletes them from req.cookies.  Check req.signedCookies first (the fast,
    // already-verified path), then fall back to manual verification of whatever
    // remains in req.cookies (covers misconfigured or cookie-parser-less setups).
    const signedCookies = req.signedCookies as Record<string, string | false> | undefined;
    const alreadyVerified = signedCookies?.[cookie];
    let sessionId: string | false;
    if (alreadyVerified && typeof alreadyVerified === "string") {
      sessionId = alreadyVerified;
    } else {
      const rawVal = req.cookies?.[cookie] as string | undefined;
      if (!rawVal) continue;
      sessionId = unsignCookie(rawVal, SESSION_SECRET);
    }
    if (!sessionId) continue;
    try {
      const { rows } = await pool.query(
        `SELECT sess FROM "${table}" WHERE sid = $1 AND expire > NOW()`,
        [sessionId],
      );
      if (rows.length === 0) continue;
      const sess = rows[0].sess as Record<string, unknown> | null;
      if (sess && sess[authField] && (!andField || sess[andField])) return true;
    } catch (err) {
      logger.warn({ err, cookie }, "shared-uploads: session store lookup failed");
    }
  }
  return false;
}

/**
 * Accident master-token: replicates isMasterToken from accident routes.
 * Format: master.<nonce>.<issued-at-ms>.<master-fingerprint>.<HMAC-SHA256(
 * SESSION_SECRET, "master:"+nonce+":"+issued-at-ms+":"+master-fingerprint)>
 */
function isAccidentMasterToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "master") return false;
  const nonce = parts[1];
  const issuedAt = Number(parts[2]);
  const currentFingerprint = getMasterAccessFingerprint();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > Date.now() ||
    Date.now() - issuedAt > maxAgeMs ||
    !currentFingerprint ||
    parts[3] !== currentFingerprint
  ) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`master:${nonce}:${issuedAt}:${parts[3]}`)
    .digest("hex");
  try {
    const actualBuf = Buffer.from(parts[4], "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Accident: validates session_id cookie as either a master token or a live
 * DB session. Replicates the check-session endpoint logic.
 */
async function tryAccidentAuth(req: Request): Promise<boolean> {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (!sessionId) return false;
  if (isAccidentMasterToken(sessionId)) return true;
  try {
    const rows = await db
      .select({ id: accessCodeUsageTable.id })
      .from(accessCodeUsageTable)
      .where(eq(accessCodeUsageTable.sessionId, sessionId))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ── Signed-cookie helper ──────────────────────────────────────────────────────

/**
 * Manually unsign a cookie value using cookie-signature's format.
 *
 * The global app mounts `cookieParser()` (without secret), which populates
 * `req.cookies` and sets `req.signedCookies = {}`.  A second call to
 * `cookieParser(SECRET)` is a no-op because cookie-parser checks
 * `if (req.cookies) return next()` at the top.
 *
 * Instead we read the raw value from `req.cookies` (which contains the full
 * `s:val.hmac` string for signed cookies) and validate the HMAC ourselves.
 *
 * Format: `s:${value}.${HMAC-SHA256(value, secret).base64url}`
 * Returns the session ID string on success, `false` on invalid/unsigned.
 */
function unsignCookie(rawCookieVal: string, secret: string): string | false {
  if (typeof rawCookieVal !== "string" || !rawCookieVal.startsWith("s:")) return false;
  const val = rawCookieVal.slice(2); // strip 's:'
  const lastDot = val.lastIndexOf(".");
  if (lastDot < 0) return false;
  const sessionId = val.slice(0, lastDot);
  const receivedSig = val.slice(lastDot + 1);
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(sessionId)
    .digest("base64")
    .replace(/=+$/, "");
  // Timing-safe comparison against base64-decoded bytes.
  try {
    const a = Buffer.from(receivedSig, "base64");
    const b = Buffer.from(expectedSig, "base64");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b) ? sessionId : false;
  } catch {
    return false;
  }
}

// ── Auth middleware ───────────────────────────────────────────────────────────

async function requirePortalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // ── Bearer token paths ───────────────────────────────────────────────────
  if (bearerToken) {
    // Try to decode as a JWT first.
    let payload: Record<string, unknown> | null = null;
    try {
      payload = jwt.verify(bearerToken, SESSION_SECRET) as Record<string, unknown>;
    } catch {
      // Not a JWT — may be a Corp opaque token; fall through to Corp check.
    }

    if (payload !== null) {
      // CCB: JWT with role field + DB code verification + seat enforcement
      if (await tryCCBAuth(payload, req)) { next(); return; }
      // Convey: JWT with uid field + seat enforcement
      if (typeof payload.uid === "number") {
        if (await tryConveyAuth(payload.uid, req)) { next(); return; }
      }
    } else {
      // Corp: opaque session token (not a JWT)
      if (await tryCorpAuth(bearerToken)) { next(); return; }
    }
  }

  // ── Session-cookie portals ───────────────────────────────────────────────
  if (await trySessionCookieAuth(req)) { next(); return; }

  // ── Accident session_id cookie ───────────────────────────────────────────
  if (await tryAccidentAuth(req)) { next(); return; }

  res.status(401).json({
    error: "Authentication required. Please log in to your portal to upload files.",
  });
}

// ── Rate limit ────────────────────────────────────────────────────────────────

/**
 * IP-based rate limit: 10 requests per 15 minutes per IP.
 * validate.keyGeneratorIpFallback disabled to prevent ERR_ERL_KEY_GEN_IPV6.
 */
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many upload requests. Please try again in a few minutes." },
  keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? "__noip__",
  validate: { keyGeneratorIpFallback: false },
});

// ── Multer ────────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_FILES)(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "LIMIT_FILE_SIZE") {
        return void res.status(413).json({
          error: `File too large. Each file must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
        });
      }
      return void res.status(400).json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "shared upload middleware error");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

// ── Extraction ────────────────────────────────────────────────────────────────

async function extractFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();

  if (mimetype === "application/pdf" || lower.endsWith(".pdf")) {
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (opts: { data: Uint8Array }) => {
        getText: () => Promise<{ text?: string }>;
        destroy?: () => Promise<void>;
      };
    };
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      if (text.length < 20) {
        throw new Error(
          "This PDF appears to be scanned or image-based. Upload a text-based PDF, DOCX, or TXT.",
        );
      }
      return text;
    } finally {
      await parser.destroy?.();
    }
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (
    mimetype.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".rtf")
  ) {
    return buffer.toString("utf-8");
  }

  if (
    mimetype.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].some((ext) => lower.endsWith(`.${ext}`))
  ) {
    throw new Error(
      "Image files cannot be read as text. Please upload a PDF, DOCX, or TXT version of the document.",
    );
  }

  throw new Error(
    `Unsupported file type (${mimetype || filename}). Supported: PDF, DOCX, TXT, MD.`,
  );
}

type FileResult = {
  name: string;
  mimetype: string;
  size: number;
  chars: number;
  text: string;
  truncated: boolean;
  error?: string;
};

/** Extract one file with a hard timeout; apply per-file char cap. */
async function extractOneFile(file: Express.Multer.File): Promise<FileResult> {
  const base = {
    name: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            "Extraction timed out — the file may be too complex or heavily formatted.",
          ),
        ),
      EXTRACTION_TIMEOUT_MS,
    ),
  );

  try {
    const rawText = await Promise.race([
      extractFromBuffer(file.buffer, file.mimetype, file.originalname),
      timeoutPromise,
    ]);
    const trimmed = rawText.trim();
    const perFileTruncated = trimmed.length > MAX_CHARS_PER_FILE;
    const text = perFileTruncated
      ? trimmed.slice(0, MAX_CHARS_PER_FILE) +
        `\n\n[… truncated — ${(trimmed.length - MAX_CHARS_PER_FILE).toLocaleString()} characters omitted]`
      : trimmed;
    return { ...base, chars: text.length, text, truncated: perFileTruncated };
  } catch (err) {
    return {
      ...base,
      chars: 0,
      text: "",
      truncated: false,
      error: err instanceof Error ? err.message : "Failed to extract text",
    };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

router.post(
  "/shared/uploads/extract",
  uploadRateLimit,
  requirePortalAuth,
  uploadMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      return void res.status(400).json({ error: "No files uploaded" });
    }

    // Process files sequentially to bound peak CPU and memory usage.
    const extracted: FileResult[] = [];
    for (const file of files) {
      extracted.push(await extractOneFile(file));
    }

    // Apply the combined total cap so the whole payload fits in the matter
    // notes field. Walk files in order, truncating any that push over the cap.
    let remaining = TOTAL_CHARS_CAP;
    const results = extracted.map((file) => {
      if (file.error || !file.text) return file;
      if (remaining <= 0) {
        return {
          ...file,
          text: "",
          chars: 0,
          truncated: true,
          error: `Omitted — combined extraction limit (${TOTAL_CHARS_CAP.toLocaleString()} chars) reached.`,
        };
      }
      if (file.chars <= remaining) {
        remaining -= file.chars;
        return file;
      }
      const kept = file.text.slice(0, remaining);
      const omitted = file.chars - remaining;
      remaining = 0;
      return {
        ...file,
        text:
          kept +
          `\n\n[… truncated — ${omitted.toLocaleString()} characters omitted to fit the matter notes limit]`,
        chars: kept.length,
        truncated: true,
      };
    });

    return void res.json({ files: results });
  },
);

export default router;
