import { claimSeat, deviceSeatKey, seatLimitMessage } from "../lib/seatLimits";
import { Router, type IRouter } from "express";
import { loginRateLimit } from "../lib/loginRateLimit";
import { aiRateLimit } from "../lib/aiRateLimit";
import { logger } from "../lib/logger";
import { ai } from "@workspace/integrations-gemini-ai";
import { db, microsoftLinks } from "@workspace/db";
import { aiUsageTable, usersTable } from "@workspace/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../microsoft";
import { conveyGate } from "../middlewares/conveyGate";
import { isConveyCodeExpired } from "../middlewares/conveyAuth";
import { isMasterAccessCode } from "../lib/masterAccess";
import { accessSummary, isBeforeCutoff, generateAccessCode, PLANS, CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS } from "../lib/access";
import { synthesizeSpeech } from "../lib/elevenlabs";
import {
  SendChatMessageBody,
  GenerateDraftBody,
  ScanTransactionRiskBody,
  GenerateChecklistBody,
  CalculateDeadlinesBody,
  ReviewSpaClauseBody,
  CompareClausesBody,
  InterpretLandTitleBody,
  GenerateFeeQuotationBody,
  GenerateAdviceLetterBody,
  GenerateDueDiligenceBody,
  GenerateLegalOpinionBody,
  GenerateRequisitionBody,
  GenerateCompletionStatementBody,
  ResearchCaseLawBody,
  CalculateStampDutyBody,
  AnalyzeRPGTBody,
  DraftTenancyBody,
  DraftPowerOfAttorneyBody,
  AdviseCaveatBody,
  AnalyzeLandSearchBody,
  AdviseDeveloperClaimBody,
  AdviseBankruptcySearchBody,
  AdviseForeignPurchaseBody,
  ReviewLoanDocBody,
  AdviseTaxComplianceBody,
  AdviseStrataBody,
  DraftCorpResolutionBody,
  GenerateCorpPropertyDDBody,
  DraftJVAgreementBody,
  DraftGuaranteeBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Server-side paywall: enforce tier access on all POST /convey/* endpoints.
router.use(conveyGate);

// Per-subscriber AI rate limit — applied only on AI-generation POST routes.
// Auth/signup, plans, TTS, and export-docx are excluded because they are either
// public, non-AI, or use a separate billing/generation system.
const CONVEY_NON_AI_POSTS = new Set([
  "/convey/auth", "/convey/auth/sso", "/convey/signup",
  "/convey/tts", "/convey/export-docx",
]);
router.use((req, res, next) => {
  // This router is mounted at the API root, so it sees EVERY /api/* request.
  // Scope the limiter strictly to /convey/* — otherwise unauthenticated POSTs
  // to any other portal would drain the shared __noauth__ fallback bucket
  // (and rate-limit unrelated portals' traffic before their own auth runs).
  if (req.method !== "POST" || !req.path.startsWith("/convey/") || CONVEY_NON_AI_POSTS.has(req.path)) {
    return next();
  }
  return void aiRateLimit(req, res, next);
});

async function trackUsage(tool: string, inputLength: number, outputLength: number, durationMs: number, userId?: number | null) {
  try {
    await db.insert(aiUsageTable).values({ tool, inputLength, outputLength, durationMs, userId: userId ?? null });
  } catch (e) {
    logger.error({ err: e }, "Failed to track usage");
  }
}

// Never persist the owner credential itself. This stable synthetic account is
// only the tenant backing owner sessions and remains valid across rotation.
const MASTER_TENANT_CODE = "MASTER-OVERRIDE-CONVEY";
const LEGACY_MASTER_DISPLAY_NAME = "Master Access";

async function deactivateReservedMasterBindings(): Promise<void> {
  // The synthetic tenant is an internal owner-session identity, never a
  // Microsoft subscriber binding. Revoke any legacy binding in place before
  // rejecting the SSO request; do not delete audit history.
  await db
    .update(microsoftLinks)
    .set({ active: false })
    .where(sql`lower(${microsoftLinks.accessCode}) = lower(${MASTER_TENANT_CODE})`);
}

async function deactivateLegacyMasterUsers() {
  // The former implementation stored MASTER_ACCESS_CODE directly in a
  // normal user row. Preserve those rows for audit/history, but make every
  // such row inactive so rotation cannot leave a second owner credential.
  await db
    .update(usersTable)
    .set({ isActive: false })
    .where(and(
      eq(usersTable.displayName, LEGACY_MASTER_DISPLAY_NAME),
      eq(usersTable.role, "admin"),
      sql`${usersTable.accessCode} IS NOT NULL`,
      sql`${usersTable.accessCode} <> ${MASTER_TENANT_CODE}`,
    ));
}

async function ensureMasterUser() {
  try {
    await deactivateLegacyMasterUsers();
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.accessCode, MASTER_TENANT_CODE));
    if (existing.length === 0) {
      await db.insert(usersTable).values({
        accessCode: MASTER_TENANT_CODE,
        displayName: "Master Access",
        role: "admin",
        isActive: true,
        grandfathered: true,
        subscriptionTier: "firm",
        subscriptionStatus: "active",
      });
      logger.info("Master override account ready");
    } else {
      // Keep it omnipotent even if it was previously altered.
      await db
        .update(usersTable)
        .set({ role: "admin", isActive: true, grandfathered: true, subscriptionTier: "firm", subscriptionStatus: "active" })
        .where(eq(usersTable.accessCode, MASTER_TENANT_CODE));
    }
    const [master] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.accessCode, MASTER_TENANT_CODE))
      .limit(1);
    return master;
  } catch (e) {
    logger.error({ err: e }, "Failed to ensure master user");
    return undefined;
  }
}

async function ensureDefaultAdmin() {
  // Never seed a known hardcoded admin code in production.
  if (process.env.NODE_ENV === "production") return;
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length === 0) {
      await db.insert(usersTable).values({
        accessCode: "MYCV-ADMIN-2024",
        username: "admin",
        displayName: "Administrator",
        role: "admin",
        isActive: true,
        grandfathered: true,
        subscriptionTier: "firm",
        subscriptionStatus: "active",
      });
      logger.info("Default convey admin user created");
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to seed default convey admin");
  }
}

// Any account missing an access code (legacy rows) gets one generated so it can
// still log in under the access-code-only model.
async function backfillAccessCodes() {
  try {
    const missing = await db.select().from(usersTable).where(isNull(usersTable.accessCode));
    for (const u of missing) {
      let code = generateAccessCode();
      // Retry on the rare collision against the unique constraint.
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await db.select().from(usersTable).where(eq(usersTable.accessCode, code));
        if (clash.length === 0) break;
        code = generateAccessCode();
      }
      await db.update(usersTable).set({ accessCode: code }).where(eq(usersTable.id, u.id));
    }
    if (missing.length > 0) {
      logger.info({ count: missing.length }, "Backfilled access codes for legacy accounts");
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to backfill access codes");
  }
}

// Legacy (pre-migration) accounts authenticate with email + password and carry a
// passwordHash. They belong to the cohort created before the grandfather cutoff,
// so they retain full access for free. We also mirror their email (historically
// stored in the username column) into the email column for billing/receipts.
async function backfillLegacyAccounts() {
  try {
    await db
      .update(usersTable)
      .set({ grandfathered: true })
      .where(sql`${usersTable.passwordHash} IS NOT NULL AND ${usersTable.grandfathered} = false`);
    await db
      .update(usersTable)
      .set({ email: sql`${usersTable.username}` })
      .where(sql`${usersTable.email} IS NULL AND ${usersTable.username} LIKE '%@%'`);
  } catch (e) {
    logger.error({ err: e }, "Failed to backfill legacy accounts");
  }
}

async function initUsers() {
  await ensureDefaultAdmin();
  await backfillLegacyAccounts();
  await backfillAccessCodes();
  await ensureMasterUser();
}
initUsers();

// Generate an access code guaranteed unique against the users table.
async function uniqueAccessCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateAccessCode();
    const clash = await db.select().from(usersTable).where(eq(usersTable.accessCode, code));
    if (clash.length === 0) return code;
  }
  throw new Error("Could not generate a unique access code");
}

router.post("/convey/auth", loginRateLimit, async (req, res) => {
  const body = (req.body ?? {}) as { accessCode?: string; username?: string; password?: string };

  try {
    let user: (typeof usersTable.$inferSelect) | undefined;

    // Two supported login paths:
    //  1. Legacy accounts: email (stored in the username column) + password (bcrypt).
    //  2. New accounts / master / admin: a unique access code.
    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (username && password) {
      const rows = await db
        .select()
        .from(usersTable)
        .where(sql`lower(${usersTable.username}) = ${username}`);
      const candidate = rows[0];
      if (candidate?.passwordHash && (await bcrypt.compare(password, candidate.passwordHash))) {
        user = candidate;
      }
    } else {
      const rawCode = typeof body.accessCode === "string" ? body.accessCode : "";
      const code = rawCode.trim().toUpperCase();
      if (code) {
        if (isMasterAccessCode(rawCode)) {
          user = await ensureMasterUser();
        } else if (code === MASTER_TENANT_CODE) {
          // The synthetic owner tenant is an internal session identity, not a
          // subscriber credential. Only the configured owner flow may issue it.
          res.status(401).json({ error: "Invalid credentials" });
          return;
        } else {
          const rows = await db
            .select()
            .from(usersTable)
            .where(sql`upper(${usersTable.accessCode}) = ${code}`);
          user = rows[0];
          if (
            user &&
            user.displayName === LEGACY_MASTER_DISPLAY_NAME &&
            user.role === "admin"
          ) {
            await db
              .update(usersTable)
              .set({ isActive: false })
              .where(eq(usersTable.id, user.id));
            user = undefined;
          }
        }
      }
    }

    if (
      user &&
      user.displayName === LEGACY_MASTER_DISPLAY_NAME &&
      user.role === "admin" &&
      user.accessCode !== MASTER_TENANT_CODE
    ) {
      await db
        .update(usersTable)
        .set({ isActive: false })
        .where(eq(usersTable.id, user.id));
      user = undefined;
    }

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
      return;
    }
    if (await isConveyCodeExpired(user.accessCode)) {
      res.status(401).json({ error: "This access code has expired. Please renew your subscription." });
      return;
    }
    const bindErr = user.accessCode ? await codeLoginBindingError(user.accessCode) : null;
    if (bindErr) {
      res.status(403).json({ error: bindErr });
      return;
    }

    // Team-bundle seat limit: distinct concurrent devices per access code.
    if (user.accessCode && user.maxSeats != null) {
      const claim = await claimSeat({
        portal: "convey",
        code: user.accessCode,
        maxSeats: user.maxSeats,
        seatKey: deviceSeatKey(req),
      });
      if (!claim.ok) {
        res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
        return;
      }
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      token: signToken(user.id),
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        ...accessSummary(user),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "Convey auth error");
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/convey/auth/sso", loginRateLimit, async (req, res) => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "Ticket is required" });
    return;
  }
  const email = verifyMsTicket(ticket, "convey");
  if (!email) {
    res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
    return;
  }

  try {
    const providedRawCode = typeof code === "string" ? code.trim() : "";
    const providedCode = providedRawCode.toUpperCase();
    // Reject the synthetic owner tenant before either direct lookup or linked
    // Microsoft-code lookup. It must never become an SSO subscriber identity.
    if (providedCode === MASTER_TENANT_CODE) {
      await deactivateReservedMasterBindings();
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const linkedCode = providedCode ? null : await getLinkedCode(email, "convey");
    const codeToUse = providedCode || linkedCode;
    if (!codeToUse) {
      res.status(404).json({ needsLink: true });
      return;
    }
    if (codeToUse.trim().toUpperCase() === MASTER_TENANT_CODE) {
      await deactivateReservedMasterBindings();
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = isMasterAccessCode(providedRawCode || codeToUse)
      ? await ensureMasterUser()
      : (await db.select().from(usersTable).where(eq(usersTable.accessCode, codeToUse)))[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
      return;
    }
    if (await isConveyCodeExpired(user.accessCode)) {
      res.status(401).json({ error: "This access code has expired. Please renew your subscription." });
      return;
    }
    const bindErr = await ssoBindingError(email, codeToUse);
    if (bindErr) {
      res.status(403).json({ error: bindErr });
      return;
    }

    if (providedCode && !isMasterAccessCode(providedRawCode)) {
      const linkClaim = await saveLink(email, "convey", providedCode);
      if (!linkClaim.ok) {
        res.status(403).json({
          error: `This access code is linked to a different Microsoft account (${maskEmail(linkClaim.ownerEmail)}).`,
        });
        return;
      }
    }

    // Team-bundle seat limit: distinct concurrent devices per access code.
    if (user.accessCode && user.maxSeats != null) {
      const claim = await claimSeat({
        portal: "convey",
        code: user.accessCode,
        maxSeats: user.maxSeats,
        seatKey: deviceSeatKey(req),
      });
      if (!claim.ok) {
        res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
        return;
      }
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      token: signToken(user.id),
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        ...accessSummary(user),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "Convey SSO error");
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Public self-service sign-up. Accounts created on/before the grandfather cutoff
// get full (Firm) access for free, forever; later sign-ups start on the free tier.
router.post("/convey/signup", loginRateLimit, async (req, res) => {
  const { email, displayName } = (req.body ?? {}) as {
    email?: string;
    displayName?: string;
  };
  const mail = (email ?? "").trim().toLowerCase();
  const name = (displayName ?? "").trim();

  // Email is required for billing/receipts and as the human label for the account.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    if (mail) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.email, mail));
      if (existing.length > 0) {
        res.status(409).json({ error: "An account already exists for that email." });
        return;
      }
    }

    const grandfathered = isBeforeCutoff();
    const accessCode = await uniqueAccessCode();
    const inserted = await db
      .insert(usersTable)
      .values({
        accessCode,
        email: mail,
        displayName: name || mail,
        role: "user",
        isActive: true,
        grandfathered,
        subscriptionTier: grandfathered ? "firm" : "free",
        subscriptionStatus: grandfathered ? "active" : null,
        lastLoginAt: new Date(),
      })
      .returning();
    const user = inserted[0];

    res.status(201).json({
      success: true,
      token: signToken(user.id),
      // accessCode is returned ONCE here so the new user can save it — it is their
      // only credential going forward.
      accessCode: user.accessCode,
      user: {
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        accessCode: user.accessCode,
        email: user.email,
        ...accessSummary(user),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "Convey signup error");
    res.status(500).json({ error: "Sign-up failed" });
  }
});

// Returns the current user + live access summary (used to refresh after checkout).
router.get("/convey/me", async (req, res) => {
  if (!req.currentUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const u = req.currentUser;
  res.json({
    user: {
      id: u.id,
      displayName: u.displayName,
      role: u.role,
      email: u.email,
      ...accessSummary(u),
    },
  });
});

// Public pricing catalogue for the frontend pricing page.
router.get("/convey/plans", (_req, res) => {
  res.json({
    plans: PLANS,
    currencies: CURRENCIES,
    currencyLabels: CURRENCY_LABELS,
    currencySymbols: CURRENCY_SYMBOLS,
  });
});

// Firm-only: AI audio narration via ElevenLabs. Returns audio/mpeg bytes.
router.post("/convey/tts", async (req, res) => {
  const { text, voiceId } = (req.body ?? {}) as { text?: string; voiceId?: string };
  const input = (text ?? "").trim();
  if (!input) {
    res.status(400).json({ error: "No text provided." });
    return;
  }
  // ElevenLabs charges per character; cap input to keep narration affordable.
  const clipped = input.slice(0, 5000);
  try {
    const audio = await synthesizeSpeech(clipped, voiceId);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.send(audio);
  } catch (e) {
    req.log.error({ err: e }, "TTS generation failed");
    res.status(502).json({ error: "Audio narration failed. Please try again." });
  }
});

router.post("/convey/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { history, message } = parsed.data;
  const startTime = Date.now();

  try {
    const systemInstruction =
      "You are an expert Malaysian Conveyancing AI Tutor named MYConveyAI. Answer questions about Malaysian land law, the National Land Code, Housing Development Act, and conveyancing practice accurately, professionally, and simply for a beginner law student. Keep responses concise and clearly formatted. Do not use markdown headers, asterisks, or backticks in your responses. Use plain prose with numbered lists where helpful.";

    const contents = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "model",
        parts: [{ text: msg.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 3072,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const response = result.text ?? "No response generated.";
    const elapsed = Date.now() - startTime;
    trackUsage("tutor", message.length, response.length, elapsed, req.userId);
    res.json({ response });
  } catch (error) {
    req.log.error({ error }, "Gemini chat error");
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

router.post("/convey/draft", async (req, res) => {
  const parsed = GenerateDraftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { clauseType, variables, actingFor, tone, length } = parsed.data;
  const startTime = Date.now();

  try {
    const v = variables || "standard terms";
    const af = actingFor && actingFor.trim() ? actingFor.trim() : "neutral / both parties";
    const t = tone && tone.trim() ? tone.trim() : "Standard market position";
    const lengthGuidance = length === "Concise"
      ? "Keep the draft tight and focused — typically a single clause or short paragraph."
      : length === "Comprehensive"
        ? "Produce a comprehensive draft including all standard sub-clauses, schedules and protective provisions normally found in Malaysian practice. Add a 'Drafter's Note' section at the end with practical commentary."
        : "Use a balanced length appropriate to the clause/document type, with all material sub-provisions.";

    const prompt = `You are a senior Malaysian conveyancing partner drafting a legal clause/document for active law firm use.

DOCUMENT / CLAUSE TYPE: ${clauseType}
SPECIFIC VARIABLES / FACTS: ${v}
ACTING FOR (party whose interests must be protected): ${af}
DRAFTING POSITION / TONE: ${t}
LENGTH: ${lengthGuidance}

Drafting requirements:
- Use precise Malaysian legal English with correct citations to NLC 1965, Contracts Act 1950, Stamp Act 1949, HDA 1966, STA 1985, RPGTA 1976 or other relevant legislation where applicable.
- Reflect current SRO 2023 fee scales, current LHDN stamp duty rates and the latest Budget changes where relevant — never cite SRO 2005.
- Where the clause has standard market alternatives, choose language that is favourable but commercially reasonable for the party named in "ACTING FOR".
- If the clause involves a developer transaction, comply with Schedule G/H/I/J of the Housing Development (Control & Licensing) Regulations 1989 where applicable.
- Use numbered clauses and lettered sub-clauses (1, 1.1, 1.1.1, (a), (b)) — no markdown asterisks, hashes, backticks or code blocks.
- If the clause is a letter, format it as a proper firm letter (date, addressee, salutation, body, closing).
- End the draft with a short "Drafter's Notes" block (max 5 bullet points) flagging risks, missing facts the lawyer must verify, and stamp duty/registration follow-ups.

Return ONLY the draft text in plain prose — no markdown formatting characters whatsoever.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let draft = result.text ?? "Failed to generate draft.";
    draft = draft.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("drafter", prompt.length, draft.length, Date.now() - startTime);
    res.json({ draft });
  } catch (error) {
    req.log.error({ error }, "Gemini draft error");
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

router.post("/convey/risk-scan", async (req, res) => {
  const parsed = ScanTransactionRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { scenario, transactionType } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a senior Malaysian conveyancing lawyer conducting a risk assessment. Analyse the following transaction scenario and identify all potential legal risks, red flags, compliance issues, and recommended protective actions.

Transaction Type: ${transactionType || "General Conveyancing"}
Scenario: ${scenario}

Structure your response as follows (use plain text only, no markdown asterisks or backticks):

RISK LEVEL: [Low / Medium / High / Critical]

RED FLAGS:
List each red flag on a new line starting with a dash. Be specific and cite the relevant Malaysian law (NLC, HDA, SRA, CLRA, etc.) where applicable.

LEGAL RISKS:
List each legal risk on a new line starting with a dash. Include the specific legal provision or case law at risk.

COMPLIANCE CHECKLIST:
List items to verify on a new line starting with a dash.

RECOMMENDED PROTECTIVE ACTIONS:
List recommended actions the solicitor should take, numbered.

Be thorough, practical, and specific to Malaysian land law and conveyancing practice.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let analysis = result.text ?? "Failed to generate analysis.";
    analysis = analysis.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("risk", prompt.length, analysis.length, Date.now() - startTime);
    res.json({ analysis });
  } catch (error) {
    req.log.error({ error }, "Gemini risk scan error");
    res.status(500).json({ error: "Failed to generate risk analysis" });
  }
});

router.post("/convey/checklist", async (req, res) => {
  const parsed = GenerateChecklistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transactionType, details } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a highly experienced Malaysian conveyancing solicitor. Generate a comprehensive, step-by-step practitioner's checklist for the following transaction.

Transaction Type: ${transactionType}
Additional Details: ${details || "Standard transaction"}

Your checklist must cover ALL stages from initial instruction to completion. Include:
- Documents to obtain and verify
- Searches and enquiries to conduct
- Statutory deadlines and time limits with the specific legislation
- Letters and notices to send
- Registration steps
- Post-completion obligations

Format: Use numbered sections with sub-items using letters (a, b, c). Use plain text only — no markdown asterisks or backticks. Make it comprehensive enough to use as an actual working checklist in a Malaysian law firm. Cite the relevant Malaysian legislation (NLC 1965, HDA 1966, STA 1985, Stamp Act 1949, CKHT Act 1976, etc.) throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let checklist = result.text ?? "Failed to generate checklist.";
    checklist = checklist.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("checklist", prompt.length, checklist.length, Date.now() - startTime);
    res.json({ checklist });
  } catch (error) {
    req.log.error({ error }, "Gemini checklist error");
    res.status(500).json({ error: "Failed to generate checklist" });
  }
});

router.post("/convey/deadlines", async (req, res) => {
  const parsed = CalculateDeadlinesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transactionType, keyDate, additionalDates } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a Malaysian conveyancing solicitor specialising in compliance and deadlines. Calculate all statutory and contractual deadlines for the following transaction.

Transaction Type: ${transactionType}
Key Date (e.g. SPA signing date, completion date): ${keyDate}
Additional Dates Provided: ${additionalDates || "None"}

Today's date for reference: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })}

List EVERY relevant deadline in a table format using plain text. For each deadline include:
- The deadline name
- The calculated due date (work out the exact date)
- The number of days/months from the key date
- The legal source (legislation section or standard practice)
- Consequence if missed

Cover all applicable deadlines such as:
- Stamp duty payment deadlines (Stamp Act 1949 s.47A)
- SPA completion periods
- Notice to Complete (14+4 days rule)
- LAD calculation periods
- Vacant Possession deadline
- Defect liability period
- Caveat expiry (6 months under NLC)
- RPGT filing deadlines (s.13 CKHT Act)
- CKHT 502 retention obligation (60 days)
- Strata title application deadline
- Loan redemption deadlines
- Any other applicable deadlines for this transaction type

Format each as:
DEADLINE: [name]
DUE DATE: [calculated date]
PERIOD: [X days/months from key date]
LEGAL BASIS: [legislation / section]
CONSEQUENCE: [what happens if missed]

Separate each deadline with a blank line. Use plain text only.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let deadlines = result.text ?? "Failed to calculate deadlines.";
    deadlines = deadlines.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("deadlines", prompt.length, deadlines.length, Date.now() - startTime);
    res.json({ deadlines });
  } catch (error) {
    req.log.error({ error }, "Gemini deadlines error");
    res.status(500).json({ error: "Failed to calculate deadlines" });
  }
});

// ─── SPA / Contract Reviewer ───────────────────────────────────────────────
router.post("/convey/review-spa", async (req, res) => {
  const parsed = ReviewSpaClauseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { clauseText, actingFor, context } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a senior Malaysian conveyancing solicitor reviewing a Sale and Purchase Agreement or contract clause for a client. Perform a detailed, clause-by-clause legal review.

ACTING FOR: ${actingFor || "Purchaser"}
ADDITIONAL CONTEXT: ${context || "Standard sub-sale transaction"}

CLAUSE TEXT TO REVIEW:
"""
${clauseText}
"""

Provide a thorough review structured as follows (use plain text only, no markdown asterisks or backticks):

OVERALL ASSESSMENT: [Favorable / Neutral / Unfavorable for ${actingFor || "Purchaser"}]

CLAUSE-BY-CLAUSE ANALYSIS:
For each identifiable clause or provision in the text, provide:
- Clause description
- Assessment (Favorable / Neutral / Unfavorable / Risky)
- Why — cite relevant Malaysian legislation (NLC 1965, HDA 1966, Contracts Act 1950, etc.) or case law
- Any non-compliance with HDA Schedule G/H/I/J requirements where applicable

RED FLAGS & MISSING PROTECTIONS:
List any concerning terms, one-sided provisions, or important protections that are missing.

RECOMMENDED AMENDMENTS:
Suggest specific wording changes or additions that would better protect the ${actingFor || "Purchaser"}'s interest, with the legal basis for each recommendation.

COMPLIANCE NOTES:
Flag any potential non-compliance with mandatory statutory requirements (HDA schedules, Stamp Act, NLC, etc.).

Be specific, practical, and cite legislation throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let review = result.text ?? "Failed to generate review.";
    review = review.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("reviewer", prompt.length, review.length, Date.now() - startTime);
    res.json({ review });
  } catch (error) {
    req.log.error({ error }, "Gemini SPA review error");
    res.status(500).json({ error: "Failed to generate review" });
  }
});

// ─── Clause Comparator ──────────────────────────────────────────────────────
router.post("/convey/compare-clauses", async (req, res) => {
  const parsed = CompareClausesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { clauseA, clauseB, context } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a senior Malaysian conveyancing solicitor. Compare the following two versions of a legal clause and provide a detailed analysis.

CONTEXT: ${context || "Malaysian conveyancing transaction"}

VERSION A:
"""
${clauseA}
"""

VERSION B:
"""
${clauseB}
"""

Provide a detailed comparison structured as follows (use plain text only, no markdown asterisks or backticks):

SUMMARY OF DIFFERENCES:
List each material difference between Version A and Version B.

PARTY IMPACT ANALYSIS:
For each difference, explain:
- Which party does this favor? (Vendor / Purchaser / Financier / Neutral)
- Why — cite relevant Malaysian law (NLC, HDA, Contracts Act, case law)
- Risk level (Low / Medium / High)

WHICH VERSION IS MORE FAVORABLE:
- For Purchaser: Version [A/B] — explain why
- For Vendor: Version [A/B] — explain why
- Overall fairness: Which is more balanced?

LEGAL COMPLIANCE:
Do either version contain terms that may be void, unenforceable, or non-compliant with Malaysian law?

RECOMMENDED MERGED VERSION:
Draft a recommended clause that takes the best of both versions while being fair and legally compliant.

Be specific and cite legislation throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let comparison = result.text ?? "Failed to generate comparison.";
    comparison = comparison.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("comparator", prompt.length, comparison.length, Date.now() - startTime);
    res.json({ comparison });
  } catch (error) {
    req.log.error({ error }, "Gemini clause comparison error");
    res.status(500).json({ error: "Failed to generate comparison" });
  }
});

// ─── Land Title Interpreter ─────────────────────────────────────────────────
router.post("/convey/interpret-title", async (req, res) => {
  const parsed = InterpretLandTitleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { titleDetails, titleType } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a Malaysian conveyancing solicitor interpreting a land search result or issue document of title for a junior lawyer. The title details provided below may be in raw form as copied from the title or land search.

TITLE TYPE: ${titleType || "Not specified"}

TITLE DETAILS / LAND SEARCH RESULT:
"""
${titleDetails}
"""

Provide a comprehensive plain-language interpretation structured as follows (use plain text only, no markdown asterisks or backticks):

TITLE OVERVIEW:
- Type of title (Geran / Pajakan Negeri / Geran Mukim / Hakmilik Sementara / Strata Title)
- Freehold or Leasehold? If leasehold, how many years remaining?
- Lot number, Mukim, District, State

REGISTERED PROPRIETOR:
- Name(s) and manner of holding (sole / joint tenant / tenant in common)
- Any restrictions on capacity

LAND DETAILS:
- Area, land use category, express conditions
- Any express conditions that limit use or dealings

RESTRICTIONS IN INTEREST:
- List each restriction (e.g. s.120 NLC, Malay Reservation, Bumiputera restriction)
- Plain language explanation of what each restriction means for a buyer

ENDORSED MEMORIALS:
- List each memorial/endorsement and its meaning
- Charges (who is the chargee? which bank? what type of charge?)
- Caveats (private/registrar's? who lodged? when does it expire?)
- Liens, prohibitory orders, or any other endorsements

RED FLAGS & ISSUES:
- Any concerns a purchaser's solicitor should be aware of
- Issues that could delay or prevent registration of transfer
- Recommendations for searches or enquiries to make

PRACTICAL ADVICE:
What a conveyancing solicitor should do with this information — steps to take before completing the transaction.

Cite relevant NLC sections throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let interpretation = result.text ?? "Failed to interpret title.";
    interpretation = interpretation.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("title", prompt.length, interpretation.length, Date.now() - startTime);
    res.json({ interpretation });
  } catch (error) {
    req.log.error({ error }, "Gemini title interpretation error");
    res.status(500).json({ error: "Failed to interpret title" });
  }
});

// ─── Fee Quotation Generator ────────────────────────────────────────────────
router.post("/convey/fee-quotation", async (req, res) => {
  const parsed = GenerateFeeQuotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transactionType, purchasePrice, clientName, additionalInfo } = parsed.data;
  const startTime = Date.now();

  try {
    const prompt = `You are a Malaysian conveyancing solicitor preparing a professional fee quotation letter for a client. Generate a complete, formal fee quotation letter.

TRANSACTION TYPE: ${transactionType}
PURCHASE PRICE / LOAN AMOUNT: RM ${purchasePrice}
CLIENT NAME: ${clientName || "[Client Name]"}
ADDITIONAL INFO: ${additionalInfo || "Standard transaction"}
DATE: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })}

Generate a complete professional fee quotation letter that includes (use plain text only, no markdown asterisks or backticks):

1. LAW FIRM LETTERHEAD (use placeholder: [Firm Name, Address, Tel, Fax, Email])

2. FORMAL LETTER FORMAT addressed to the client

3. FEE BREAKDOWN — Calculate every item based on the Solicitors' Remuneration Order 2005 (as amended):
   a. Legal fees (based on the SRO scale for the purchase price/loan amount)
   b. Stamp duty on the instrument of transfer (Form 14A) — using the current Malaysian stamp duty scale:
      - First RM100,000: 1%
      - RM100,001 to RM500,000: 2%
      - RM500,001 to RM1,000,000: 3%
      - Above RM1,000,000: 4%
   c. Stamp duty on loan agreement (RM5 per RM1,000)
   d. Legal fees for loan documentation (SRO scale)
   e. Registration fees (Land Office / PTG)
   f. Land search fees
   g. Bankruptcy search fees
   h. Company search fees (if applicable)
   i. Disbursements (courier, photocopy, transport)
   j. SST on legal fees (8%)
   k. Any other applicable fees

4. TOTAL ESTIMATED COST (sum everything)

5. PAYMENT TERMS (standard: 50% upfront retainer)

6. NOTES AND DISCLAIMERS (estimates subject to change, additional charges for complex matters, government fees subject to revision)

Calculate all amounts accurately based on the Malaysian fee scales. Show the calculation working.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });

    let quotation = result.text ?? "Failed to generate quotation.";
    quotation = quotation.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("quotation", prompt.length, quotation.length, Date.now() - startTime);
    res.json({ quotation });
  } catch (error) {
    req.log.error({ error }, "Gemini fee quotation error");
    res.status(500).json({ error: "Failed to generate fee quotation" });
  }
});

// ─── Client Advice Letter ──────────────────────────────────────────────────
router.post("/convey/advice-letter", async (req, res) => {
  const parsed = GenerateAdviceLetterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { clientName, transactionType, keyFacts, adviceArea } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian conveyancing solicitor. Draft a professional client advice letter.

CLIENT NAME: ${clientName}
TRANSACTION TYPE: ${transactionType}
KEY FACTS: ${keyFacts}
AREA OF ADVICE: ${adviceArea || "General conveyancing advice"}
DATE: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })}

Draft a complete, formal letter of advice structured as follows (plain text only, no markdown):

1. Law firm letterhead placeholder [Firm Name, Address]
2. Date and client address
3. RE: line describing the matter
4. Opening — acknowledge instructions
5. SUMMARY OF FACTS as understood
6. LEGAL ANALYSIS — identify all relevant legal issues, cite Malaysian legislation (NLC 1965, HDA 1966, Contracts Act 1950, Stamp Act 1949, STA 1985, etc.) and relevant case law
7. RISKS AND CONCERNS — flag potential issues the client should be aware of
8. OUR ADVICE — clear, practical recommendations with step-by-step actions
9. COSTS ESTIMATE — general indication of fees and disbursements
10. NEXT STEPS — what the client needs to do
11. Standard disclaimers and professional sign-off

Be thorough, practical, and cite legislation throughout. Write as a senior partner would.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let letter = result.text ?? "Failed to generate letter.";
    letter = letter.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("advice", prompt.length, letter.length, Date.now() - startTime);
    res.json({ letter });
  } catch (error) {
    req.log.error({ error }, "Gemini advice letter error");
    res.status(500).json({ error: "Failed to generate advice letter" });
  }
});

// ─── Due Diligence Report ──────────────────────────────────────────────────
router.post("/convey/due-diligence", async (req, res) => {
  const parsed = GenerateDueDiligenceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { propertyDetails, transactionType, concerns } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian conveyancing solicitor conducting property due diligence. Generate a comprehensive due diligence report.

PROPERTY DETAILS: ${propertyDetails}
TRANSACTION TYPE: ${transactionType || "Sub-sale purchase"}
SPECIFIC CONCERNS: ${concerns || "None specified"}

Generate a thorough due diligence report structured as follows (plain text only, no markdown):

1. PROPERTY IDENTIFICATION
   - Verify title details, lot number, mukim, district, state
   - Type of title (Geran/Pajakan Negeri/Strata/Qualified)
   - Freehold vs Leasehold analysis

2. TITLE SEARCH FINDINGS
   - Registered proprietor verification
   - Manner of holding (sole/joint/tenant in common)
   - Existing encumbrances (charges, caveats, liens)
   - Restrictions in interest (s.120 NLC)
   - Express and implied conditions

3. PLANNING & ZONING
   - Land use category compliance
   - Local authority requirements
   - Development orders or restrictions

4. PHYSICAL DUE DILIGENCE
   - Site inspection recommendations
   - Boundary verification
   - Access and easement issues
   - Environmental concerns

5. LEGAL DUE DILIGENCE
   - Vendor's capacity and authority to sell
   - Outstanding rates, quit rent, assessments
   - Compliance with NLC transfer requirements
   - State Authority consent requirements
   - Bankruptcy and winding-up searches
   - Company searches (if applicable)

6. FINANCIAL DUE DILIGENCE
   - Outstanding charges and redemption
   - Stamp duty implications
   - RPGT/CKHT exposure
   - SST on legal fees

7. RED FLAGS AND RISKS
   - Issues that could delay or prevent completion
   - Litigation risks
   - Fraud indicators

8. RECOMMENDATIONS
   - Searches to conduct
   - Documents to obtain
   - Conditions precedent to include in SPA
   - Timeline for completion

Cite relevant NLC sections, HDA provisions, and case law throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let report = result.text ?? "Failed to generate report.";
    report = report.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("duediligence", prompt.length, report.length, Date.now() - startTime);
    res.json({ report });
  } catch (error) {
    req.log.error({ error }, "Gemini due diligence error");
    res.status(500).json({ error: "Failed to generate due diligence report" });
  }
});

// ─── Legal Opinion Generator ───────────────────────────────────────────────
router.post("/convey/legal-opinion", async (req, res) => {
  const parsed = GenerateLegalOpinionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { issue, facts, clientPosition } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian conveyancing solicitor drafting a formal legal opinion for internal use or for a client.

LEGAL ISSUE: ${issue}
RELEVANT FACTS: ${facts}
CLIENT'S POSITION: ${clientPosition || "Not specified"}

Draft a comprehensive legal opinion structured as follows (plain text only, no markdown):

1. HEADING — "LEGAL OPINION" with date and reference
2. ISSUE(S) FOR OPINION — clearly state the legal question(s)
3. BRIEF FACTS — summarize the relevant facts
4. APPLICABLE LAW
   - Relevant statutory provisions (NLC 1965, HDA 1966, Contracts Act 1950, STA 1985, Stamp Act 1949, etc.)
   - Relevant subsidiary legislation and rules
   - Relevant case law with full citations
5. ANALYSIS
   - Apply the law to the facts methodically
   - Consider arguments for and against each position
   - Address any conflicting authorities
   - Distinguish any cases that might be cited against your client
6. OPINION
   - Clear, definitive opinion on each issue
   - Confidence level (strong/moderate/weak)
   - Caveats and qualifications
7. RISKS
   - Litigation risks if the matter is contested
   - Regulatory risks
   - Commercial risks
8. RECOMMENDATIONS
   - Practical steps to take
   - Alternative courses of action
   - Protective measures

Write in formal legal English as a senior partner would for a significant matter. Cite all authorities with full citations.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let opinion = result.text ?? "Failed to generate opinion.";
    opinion = opinion.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("opinion", prompt.length, opinion.length, Date.now() - startTime);
    res.json({ opinion });
  } catch (error) {
    req.log.error({ error }, "Gemini legal opinion error");
    res.status(500).json({ error: "Failed to generate legal opinion" });
  }
});

// ─── Requisition Letter Generator ──────────────────────────────────────────
router.post("/convey/requisition", async (req, res) => {
  const parsed = GenerateRequisitionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { titleDetails, issues, vendorSolicitor } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a purchaser's solicitor in Malaysia drafting requisitions on title to the vendor's solicitor.

TITLE DETAILS / SEARCH RESULTS: ${titleDetails}
ISSUES IDENTIFIED: ${issues}
VENDOR'S SOLICITOR: ${vendorSolicitor || "[Vendor's Solicitors]"}
DATE: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })}

Draft a formal requisition letter structured as follows (plain text only, no markdown):

1. LAW FIRM LETTERHEAD placeholder
2. Formal letter addressed to the vendor's solicitors
3. RE: line with property description and title reference
4. Opening paragraph referencing the SPA and your client's purchase
5. REQUISITIONS ON TITLE — numbered list of all requisitions:
   - Each requisition should:
     a. State the issue found on the title or search
     b. Ask a specific question or demand a specific action
     c. Cite the relevant NLC section or legal basis
     d. Set a reasonable timeframe for reply
   - Cover typical requisitions:
     a. Confirmation of vendor's authority and capacity
     b. Outstanding encumbrances and plan for discharge
     c. Restrictions in interest — consent obtained?
     d. Express conditions — compliance confirmed?
     e. Outstanding rates, quit rent, assessment
     f. Caveats — explanation and undertaking to remove
     g. Physical inspection discrepancies
     h. Strata management issues (if strata)
     i. Developer's obligations (if applicable)
     j. Any specific issues from the title search
6. REQUEST FOR DOCUMENTS — list all documents required from vendor
7. DEADLINE for reply (typically 14 days)
8. Consequences of non-reply
9. Professional sign-off

Be thorough and precise. Cite NLC sections throughout.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let requisition = result.text ?? "Failed to generate requisition.";
    requisition = requisition.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("requisition", prompt.length, requisition.length, Date.now() - startTime);
    res.json({ requisition });
  } catch (error) {
    req.log.error({ error }, "Gemini requisition error");
    res.status(500).json({ error: "Failed to generate requisition letter" });
  }
});

// ─── Completion Statement Generator ────────────────────────────────────────
router.post("/convey/completion-statement", async (req, res) => {
  const parsed = GenerateCompletionStatementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { purchasePrice, transactionType, adjustments, completionDate } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian conveyancing solicitor preparing a completion statement (completion account) for a property transaction.

PURCHASE PRICE: RM ${purchasePrice}
TRANSACTION TYPE: ${transactionType}
COMPLETION DATE: ${completionDate || "To be determined"}
ADJUSTMENTS/NOTES: ${adjustments || "Standard adjustments"}
DATE: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })}

Generate a complete, professional completion statement showing ALL financial items. Structure as follows (plain text only, no markdown):

COMPLETION STATEMENT
Property: [Based on details provided]
Completion Date: ${completionDate || "[Date]"}

A. PURCHASE PRICE
   - Total purchase price
   - Less: Earnest deposit paid (typically 2-3%)
   - Less: Balance deposit paid (typically 7-8%)
   - Balance purchase price due on completion

B. VENDOR'S ACCOUNT (Amount due TO vendor)
   - Balance purchase price
   - Less: Redemption sum to vendor's bank (if applicable)
   - Less: RPGT retention (3% under CKHT Act, if applicable)
   - Less: Outstanding quit rent apportionment
   - Less: Outstanding assessment apportionment
   - Less: Outstanding maintenance/sinking fund (strata)
   - Less: Any agreed deductions
   - NET AMOUNT PAYABLE TO VENDOR

C. PURCHASER'S COSTS
   - Stamp duty on MOT (calculated on scale)
   - Legal fees — SPA (calculated on SRO 2023 scale)
   - SST on legal fees (8%)
   - Registration fees
   - Land search fees
   - Bankruptcy search fees
   - Disbursements
   
D. LOAN ACCOUNT (if financed)
   - Stamp duty on loan agreement (0.5%)
   - Legal fees — loan documentation (SRO scale)
   - SST on loan legal fees (8%)
   
E. SUMMARY
   - Total funds required from purchaser
   - Less: Loan amount (if applicable)
   - NET CASH REQUIRED FROM PURCHASER

Calculate all amounts accurately using the Malaysian fee scales. Show working for stamp duty and legal fee calculations.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let statement = result.text ?? "Failed to generate statement.";
    statement = statement.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("completion", prompt.length, statement.length, Date.now() - startTime);
    res.json({ statement });
  } catch (error) {
    req.log.error({ error }, "Gemini completion statement error");
    res.status(500).json({ error: "Failed to generate completion statement" });
  }
});

// ─── Case Law Research ─────────────────────────────────────────────────────
router.post("/convey/case-research", async (req, res) => {
  const parsed = ResearchCaseLawBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { topic, jurisdiction, specificIssue } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian legal researcher specializing in conveyancing and land law. Research and present the most relevant case law on the following topic.

RESEARCH TOPIC: ${topic}
JURISDICTION: ${jurisdiction || "Malaysia (Peninsular, Sabah & Sarawak)"}
SPECIFIC ISSUE: ${specificIssue || "General principles"}

Provide a comprehensive case law research memo structured as follows (plain text only, no markdown):

1. RESEARCH SUMMARY
   - Brief overview of the legal position on this topic
   - Key statutes involved (NLC 1965, HDA 1966, STA 1985, Contracts Act 1950, etc.)

2. LEADING CASES (present at least 8-10 cases)
   For each case provide:
   - CASE NAME & CITATION (full Malaysian Law Journal or Current Law Journal citation)
   - COURT (Federal Court / Court of Appeal / High Court)
   - FACTS (brief summary)
   - ISSUE (legal question before the court)
   - HELD (the court's decision)
   - RATIO DECIDENDI (the legal principle established)
   - RELEVANCE (how this case applies to the topic)

3. DEVELOPMENT OF THE LAW
   - How has the law evolved through these cases?
   - Are there any conflicting decisions?
   - What is the current settled position?

4. PRACTICAL APPLICATION
   - How should practitioners apply these principles?
   - What arguments can be made using these cases?
   - Draft key submissions based on these authorities

5. RELATED STATUTORY PROVISIONS
   - List all relevant sections with brief descriptions
   - Any recent amendments that affect the position

6. FURTHER RESEARCH SUGGESTIONS
   - Related topics to explore
   - Academic commentary to consider

Present cases in chronological order to show the development of the law. Use full and accurate citations. Focus on Malaysian authorities but note influential Commonwealth cases where relevant.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let research = result.text ?? "Failed to generate research.";
    research = research.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("caseresearch", prompt.length, research.length, Date.now() - startTime, req.userId);
    res.json({ research });
  } catch (error) {
    req.log.error({ error }, "Gemini case research error");
    res.status(500).json({ error: "Failed to generate case law research" });
  }
});

// ─── Stamp Duty Calculator ────────────────────────────────────────────────
router.post("/convey/stamp-duty", async (req, res) => {
  const parsed = CalculateStampDutyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { propertyPrice, propertyType, buyerProfile, isFirstHome } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian stamp duty expert. Calculate the exact stamp duty payable for this property transaction.

PROPERTY PRICE: RM ${propertyPrice}
PROPERTY TYPE: ${propertyType || "Residential"}
BUYER PROFILE: ${buyerProfile || "Malaysian citizen, individual"}
FIRST HOME: ${isFirstHome || "Not specified"}

Calculate using the Stamp Act 1949 (as amended) and provide:

1. MEMORANDUM OF TRANSFER (MOT) STAMP DUTY
   - Show the tiered calculation:
     First RM100,000: 1%
     RM100,001 - RM500,000: 2%
     RM500,001 - RM1,000,000: 3%
     RM1,000,001 - RM10,000,000: 4%
     Exceeding RM10,000,000: Refer to current rates
   - Show exact calculation for each tier

2. LOAN AGREEMENT STAMP DUTY
   - Standard rate: 0.5% of loan amount
   - Calculate based on typical 90% financing

3. AVAILABLE EXEMPTIONS
   - First-time homebuyer exemptions (if applicable)
   - HOC (Home Ownership Campaign) exemptions if current
   - Any state-specific exemptions
   - Bumiputera discounts if applicable

4. TOTAL STAMP DUTY PAYABLE
   - MOT stamp duty
   - Loan stamp duty
   - Less: Exemptions
   - NET STAMP DUTY

5. PAYMENT TIMELINE
   - When to pay (within 30 days of execution)
   - Late payment penalties
   - How to pay (LHDN STAMPS system)

Show all calculations step by step with exact RM amounts.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let calculation = result.text ?? "Failed to calculate.";
    calculation = calculation.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("stampduty", prompt.length, calculation.length, Date.now() - startTime);
    res.json({ calculation });
  } catch (error) {
    req.log.error({ error }, "Stamp duty calculation error");
    res.status(500).json({ error: "Failed to calculate stamp duty" });
  }
});

// ─── RPGT Advisor ─────────────────────────────────────────────────────────
router.post("/convey/rpgt", async (req, res) => {
  const parsed = AnalyzeRPGTBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { acquisitionDate, disposalDate, acquisitionPrice, disposalPrice, sellerProfile, expenses } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian RPGT (Real Property Gains Tax) expert. Analyze and calculate the RPGT liability for this property disposal.

ACQUISITION DATE: ${acquisitionDate}
DISPOSAL DATE: ${disposalDate}
ACQUISITION PRICE: RM ${acquisitionPrice}
DISPOSAL PRICE: RM ${disposalPrice}
SELLER PROFILE: ${sellerProfile || "Malaysian citizen, individual"}
ALLOWABLE EXPENSES: ${expenses || "Not specified"}

Provide a comprehensive RPGT analysis:

1. HOLDING PERIOD CALCULATION
   - Calculate exact years of holding
   - Determine applicable RPGT rate based on RPGT Act 1976 (Schedule 5)
   - Rates: Within 3 years (30%), 4th year (20%), 5th year (15%), 6th year onwards (0% for citizens, 10% for companies/foreigners)

2. CHARGEABLE GAIN CALCULATION
   - Disposal price
   - Less: Acquisition price
   - Less: Allowable expenses (renovation, legal fees, agent commission)
   - Less: Exemptions (RM10,000 or 10% of gain, whichever is greater — for individuals)
   - CHARGEABLE GAIN

3. RPGT PAYABLE
   - Apply the applicable rate to chargeable gain
   - Show exact RM amount

4. EXEMPTIONS AVAILABLE
   - Once-in-a-lifetime exemption (for individuals)
   - Transfer between spouses
   - Transfer to Malaysian-incorporated company
   - Other applicable exemptions

5. COMPLIANCE REQUIREMENTS
   - Filing Form CKHT 1A/1B within 60 days
   - 3% retention by purchaser's solicitor
   - Clearance letter from LHDN

Show all calculations step by step.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let analysis = result.text ?? "Failed to analyze.";
    analysis = analysis.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("rpgt", prompt.length, analysis.length, Date.now() - startTime);
    res.json({ analysis });
  } catch (error) {
    req.log.error({ error }, "RPGT analysis error");
    res.status(500).json({ error: "Failed to analyze RPGT" });
  }
});

// ─── Tenancy Agreement Drafter ────────────────────────────────────────────
router.post("/convey/tenancy", async (req, res) => {
  const parsed = DraftTenancyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { propertyDetails, tenancyTerms, specialConditions } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian conveyancing lawyer. Draft a comprehensive Tenancy Agreement for the following property.

PROPERTY DETAILS: ${propertyDetails}
TENANCY TERMS: ${tenancyTerms}
SPECIAL CONDITIONS: ${specialConditions || "None specified"}

Draft a complete tenancy agreement including:
1. PARTIES - Landlord and Tenant details
2. PROPERTY DESCRIPTION - Full address and description
3. TERM - Commencement and expiry, option to renew
4. RENTAL - Monthly amount, payment method, due date
5. SECURITY DEPOSIT - Amount (typically 2 months), utility deposit (half month)
6. LANDLORD'S COVENANTS - Quiet enjoyment, repairs, insurance
7. TENANT'S COVENANTS - Rent payment, maintenance, no subletting, permitted use
8. TERMINATION - Notice periods, forfeiture, early termination
9. STAMP DUTY - Obligation and calculation (RM1 per RM250 of annual rent above RM2,400 exemption)
10. GENERAL PROVISIONS - Governing law, notices, severability

Use plain professional legal language. Format as a proper legal document with numbered clauses.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let draft = result.text ?? "Failed to draft.";
    draft = draft.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("tenancy", prompt.length, draft.length, Date.now() - startTime);
    res.json({ draft });
  } catch (error) {
    req.log.error({ error }, "Tenancy drafting error");
    res.status(500).json({ error: "Failed to draft tenancy agreement" });
  }
});

// ─── Power of Attorney Drafter ────────────────────────────────────────────
router.post("/convey/power-of-attorney", async (req, res) => {
  const parsed = DraftPowerOfAttorneyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { donorDetails, doneeDetails, powers, purpose } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian conveyancing lawyer. Draft a Power of Attorney document.

DONOR (Principal): ${donorDetails}
DONEE (Attorney): ${doneeDetails}
POWERS TO BE GRANTED: ${powers}
PURPOSE: ${purpose || "Property transaction"}

Draft a proper Malaysian Power of Attorney under the Powers of Attorney Act 1949:

1. RECITALS - State the purpose and reason for the POA
2. APPOINTMENT - Formal appointment of the attorney
3. POWERS - Specific powers granted:
   - Execute transfers, charges, discharges
   - Sign documents at Land Office
   - Collect rents, manage property
   - Deal with government authorities
   - Any other specific powers as instructed
4. CONDITIONS - Any limitations or restrictions
5. DURATION - Effective period
6. IRREVOCABILITY clause (if applicable, e.g., for property secured by a charge)
7. INDEMNITY - Donor's indemnity to the donee
8. ATTESTATION - Proper execution requirements
9. REGISTRATION - Note requirement to register at High Court and Land Office
10. STAMP DUTY - RM10 stamp duty on POA

Note compliance requirements under NLC Section 310 for land dealings.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let draft = result.text ?? "Failed to draft.";
    draft = draft.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("poa", prompt.length, draft.length, Date.now() - startTime);
    res.json({ draft });
  } catch (error) {
    req.log.error({ error }, "POA drafting error");
    res.status(500).json({ error: "Failed to draft power of attorney" });
  }
});

// ─── Caveat Advisor ───────────────────────────────────────────────────────
router.post("/convey/caveat", async (req, res) => {
  const parsed = AdviseCaveatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { situation, caveatType, propertyDetails } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian land law expert specializing in caveats. Advise on the caveat situation described below.

SITUATION: ${situation}
CAVEAT TYPE: ${caveatType || "To be determined"}
PROPERTY: ${propertyDetails || "Not specified"}

Provide comprehensive caveat advice covering:

1. TYPE OF CAVEAT APPLICABLE
   - Private Caveat (s.323 NLC) - caveatable interest required
   - Registrar's Caveat (s.320 NLC) - by Registrar
   - Lien-holder's Caveat (s.330 NLC) - deposit of title
   - Which type is appropriate for this situation and why

2. CAVEATABLE INTEREST ANALYSIS
   - Does the client have a caveatable interest?
   - What constitutes a caveatable interest under NLC?
   - Key cases: Eng Mee Yong v Letchumanan, CIMB Bank v Maybank

3. PROCEDURE
   - How to lodge/remove the caveat
   - Required forms (Form 19B for private caveat)
   - Filing at Land Office
   - Registration fees

4. DURATION & RENEWAL
   - 6-year validity for private caveats
   - Extension procedures
   - Lapsing provisions

5. REMOVAL OF CAVEATS
   - Application to remove (s.326 NLC)
   - Court order to remove
   - Compensation for wrongful caveat (s.329 NLC)

6. RISKS & WARNINGS
   - Compensation liability for wrongful caveats
   - Effect on dealings
   - Urgent applications

7. RECOMMENDED COURSE OF ACTION`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("caveat", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Caveat advice error");
    res.status(500).json({ error: "Failed to provide caveat advice" });
  }
});

// ─── Land Search Analyzer ─────────────────────────────────────────────────
router.post("/convey/land-search", async (req, res) => {
  const parsed = AnalyzeLandSearchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { searchResults, purpose } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian conveyancing practitioner expert in analyzing official land search results. Analyze the following land search results thoroughly.

LAND SEARCH RESULTS:
${searchResults}

PURPOSE: ${purpose || "Pre-purchase due diligence"}

Provide a detailed analysis:

1. TITLE PARTICULARS
   - Title type (Freehold/Leasehold), title reference
   - Lot number, area, mukim, district, state
   - Category of land use and express conditions
   - Lease expiry date (if leasehold)

2. PROPRIETOR INFORMATION
   - Registered proprietor(s) and shares
   - Any caveats noted against proprietor

3. ENCUMBRANCES & INTERESTS
   - Charges/mortgages registered
   - Caveats (private, registrar's, lien-holder's)
   - Liens, prohibitory orders
   - Any trust endorsements

4. RESTRICTIONS IN INTEREST
   - Malay Reservation restrictions
   - Bumiputera lot restrictions
   - State Authority consent requirements
   - Any other conditions/restrictions

5. RED FLAGS & CONCERNS
   - Issues that may affect the transaction
   - Unexplained entries or endorsements
   - Missing information

6. RECOMMENDATIONS
   - Additional searches required
   - Consents to be obtained
   - Issues to be resolved before completion
   - Requisitions to raise with vendor`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let analysis = result.text ?? "Failed to analyze.";
    analysis = analysis.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("landsearch", prompt.length, analysis.length, Date.now() - startTime);
    res.json({ analysis });
  } catch (error) {
    req.log.error({ error }, "Land search analysis error");
    res.status(500).json({ error: "Failed to analyze land search" });
  }
});

// ─── Developer Claim Advisor ──────────────────────────────────────────────
router.post("/convey/developer-claim", async (req, res) => {
  const parsed = AdviseDeveloperClaimBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { claimType, details, projectDetails } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian housing development law expert. Advise on the following claim against a developer.

CLAIM TYPE: ${claimType}
DETAILS: ${details}
PROJECT: ${projectDetails || "Not specified"}

Provide comprehensive advice on:

1. LEGAL BASIS
   - Housing Development (Control and Licensing) Act 1966 (HDA)
   - Housing Development Regulations
   - Schedule G/H SPA provisions
   - Strata Management Act 2013 (if applicable)

2. LAD (LIQUIDATED & ASCERTAINED DAMAGES)
   - If late delivery: calculation at 10% p.a. on purchase price
   - Trigger date: from SPA deadline to VP/CCC
   - Enforcement procedure

3. DEFECTS CLAIM
   - Defect liability period (24 months from VP)
   - Developer's obligation to repair
   - Claiming through Tribunal for Homebuyer Claims
   - Technical evidence required

4. TRIBUNAL FOR HOMEBUYER CLAIMS
   - Jurisdiction (claims up to RM50,000)
   - Procedure and timeline
   - Forms and filing fees
   - No need for legal representation

5. COURT ACTION
   - When to proceed to court
   - Cause of action and limitation period
   - Remedies available
   - Class action possibility

6. PRACTICAL RECOMMENDATIONS
   - Evidence to gather
   - Notice requirements to developer
   - Timeline for action
   - Estimated costs and recovery`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("devclaim", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Developer claim advice error");
    res.status(500).json({ error: "Failed to advise on developer claim" });
  }
});

// ─── Bankruptcy Search Advisor ────────────────────────────────────────────
router.post("/convey/bankruptcy-search", async (req, res) => {
  const parsed = AdviseBankruptcySearchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { searchResults, transactionContext } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian legal practitioner expert in bankruptcy/insolvency searches for conveyancing. Interpret and advise on the following search results.

SEARCH RESULTS:
${searchResults}

TRANSACTION CONTEXT: ${transactionContext || "Property purchase/sale"}

Provide interpretation and advice:

1. SEARCH RESULT INTERPRETATION
   - Is the person/entity subject to any bankruptcy proceedings?
   - Type of proceedings (bankruptcy petition, receiving order, adjudication order)
   - Current status of proceedings
   - Any discharge or annulment

2. IMPACT ON TRANSACTION
   - Can this person deal with property? (Insolvency Act 1967)
   - Section 38 restrictions on bankrupt's property
   - Effect on existing contracts
   - Voidable transactions (s.52-54 Insolvency Act)

3. IF CLEAR RESULT
   - Confirmation of clear search
   - Validity period of search
   - Recommendations for proceeding

4. IF ADVERSE RESULT
   - Immediate steps to take
   - Whether to proceed or abort
   - Consent requirements from DGI (Director General of Insolvency)
   - Court applications if needed

5. WINDING-UP SEARCH (for companies)
   - Status of winding-up proceedings
   - Effect on property dealings
   - Leave of court requirements

6. PRACTICAL RECOMMENDATIONS
   - Next steps based on results
   - Additional searches needed
   - Risk mitigation measures`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("bankruptcy", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Bankruptcy search advice error");
    res.status(500).json({ error: "Failed to advise on bankruptcy search" });
  }
});

// ─── Foreign Purchase Advisor ─────────────────────────────────────────────
router.post("/convey/foreign-purchase", async (req, res) => {
  const parsed = AdviseForeignPurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { buyerNationality, propertyType, propertyState, purchasePrice } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian property law expert specializing in foreign ownership. Advise on property purchase by a foreign buyer.

BUYER NATIONALITY: ${buyerNationality}
PROPERTY TYPE: ${propertyType}
STATE: ${propertyState}
PURCHASE PRICE: ${purchasePrice ? `RM ${purchasePrice}` : "Not specified"}

Provide comprehensive advice:

1. ELIGIBILITY
   - Can this foreign buyer purchase this type of property?
   - Minimum price thresholds by state (e.g., RM1M in KL/Selangor)
   - Property types restricted from foreign ownership
   - Malay Reserve Land / Bumiputera lot restrictions

2. EPU APPROVAL
   - Is Economic Planning Unit approval required?
   - EPU Guidelines on Foreign Acquisition
   - Application procedure and timeline
   - Required documents

3. STATE AUTHORITY CONSENT
   - State consent under NLC Section 433B
   - State-specific rules and fees
   - Processing time
   - Conditions typically imposed

4. LEVY & ADDITIONAL COSTS
   - Foreign buyer levy (varies by state)
   - Higher stamp duty rates (if applicable)
   - RPGT implications for foreign disposals
   - Additional legal fees

5. OWNERSHIP STRUCTURES
   - Individual vs company ownership
   - MM2H (Malaysia My Second Home) advantages
   - Trust structures
   - Spousal considerations (Malaysian spouse)

6. RESTRICTIONS & CONDITIONS
   - Prohibition on Malay Reserve Land
   - Agricultural land restrictions
   - Industrial property rules
   - Strata property limits

7. PRACTICAL RECOMMENDATIONS
   - Step-by-step acquisition process
   - Timeline expectations
   - Estimated total costs
   - Documents required from buyer`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("foreignpurchase", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Foreign purchase advice error");
    res.status(500).json({ error: "Failed to advise on foreign purchase" });
  }
});

// ─── Loan Documentation Reviewer ──────────────────────────────────────────
router.post("/convey/loan-doc", async (req, res) => {
  const parsed = ReviewLoanDocBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { documentText, loanType, clientRole } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian banking and conveyancing lawyer reviewing loan documentation. Review the following document.

DOCUMENT TEXT:
${documentText}

LOAN TYPE: ${loanType || "Conventional housing loan"}
ACTING FOR: ${clientRole || "Borrower"}

Provide a thorough review:

1. KEY TERMS SUMMARY
   - Loan amount and facility type
   - Interest/profit rate and calculation method
   - Tenure and repayment schedule
   - Security required

2. CRITICAL CLAUSES REVIEW
   - Events of default — are they reasonable?
   - Cross-default provisions
   - Prepayment penalties
   - Lock-in period restrictions
   - Insurance requirements

3. BORROWER'S OBLIGATIONS
   - Covenants and undertakings
   - Reporting requirements
   - Restrictions on dealing with property

4. SECURITY DOCUMENTATION
   - Charge/mortgage requirements
   - Assignment of insurance
   - Power of Attorney provisions
   - Guarantee requirements (if any)

5. ISSUES & RED FLAGS
   - Unusual or onerous clauses
   - Clauses inconsistent with Bank Negara guidelines
   - Missing standard protections
   - Compliance with Islamic banking principles (if Islamic facility)

6. RECOMMENDATIONS
   - Clauses to negotiate/amend
   - Additional protections to request
   - Points to clarify with the bank
   - Execution and completion checklist`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let review = result.text ?? "Failed to review.";
    review = review.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("loandoc", prompt.length, review.length, Date.now() - startTime);
    res.json({ review });
  } catch (error) {
    req.log.error({ error }, "Loan doc review error");
    res.status(500).json({ error: "Failed to review loan documentation" });
  }
});

// ─── Tax Compliance Advisor ───────────────────────────────────────────────
router.post("/convey/tax-compliance", async (req, res) => {
  const parsed = AdviseTaxComplianceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { transactionDetails, transactionType, parties } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian tax expert advising on property transaction tax compliance. Advise on the tax obligations for this transaction.

TRANSACTION: ${transactionDetails}
TYPE: ${transactionType || "Sale and purchase"}
PARTIES: ${parties || "Not specified"}

Provide comprehensive tax compliance advice:

1. STAMP DUTY OBLIGATIONS
   - MOT stamp duty calculation and timeline
   - Loan agreement stamp duty
   - Adjudication procedures
   - Late payment penalties (s.47A Stamp Act)

2. RPGT OBLIGATIONS
   - Applicability assessment
   - 3% retention requirement by purchaser's solicitor
   - Form CKHT filing requirements (60 days)
   - Clearance letter procedures

3. WITHHOLDING TAX
   - Applicable if seller is non-resident
   - Rate and procedure
   - Exemption applications

4. SST (SERVICE TAX)
   - 8% SST on legal fees
   - SST on other professional services
   - Exempt services

5. INCOME TAX IMPLICATIONS
   - Is this a business transaction or capital gain?
   - Developer vs individual seller distinction
   - Rental income obligations (if investment property)

6. COMPLIANCE CHECKLIST
   - All forms to be filed
   - All payments to be made
   - Deadlines for each obligation
   - Penalties for non-compliance

7. TAX PLANNING OPPORTUNITIES
   - Legitimate tax minimization strategies
   - Timing considerations
   - Structuring advice`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("taxcompliance", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Tax compliance advice error");
    res.status(500).json({ error: "Failed to advise on tax compliance" });
  }
});

// ─── Strata Management Advisor ────────────────────────────────────────────
router.post("/convey/strata", async (req, res) => {
  const parsed = AdviseStrataBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { issue, buildingType, managementBody } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a Malaysian strata management law expert. Advise on the following strata issue.

ISSUE: ${issue}
BUILDING TYPE: ${buildingType || "Stratified residential"}
MANAGEMENT BODY: ${managementBody || "Not specified (MC/JMB/Developer)"}

Provide comprehensive advice covering:

1. APPLICABLE LAW
   - Strata Management Act 2013 (SMA)
   - Strata Titles Act 1985 (STA)
   - Relevant subsidiary legislation
   - Building and Common Property (Maintenance and Management) Act 2007

2. MANAGEMENT STRUCTURE
   - JMB (Joint Management Body) - before strata titles issued
   - MC (Management Corporation) - after strata titles issued
   - Sub-MC for mixed developments
   - Developer's obligations during interim period

3. SPECIFIC ADVICE ON THE ISSUE
   - Legal analysis of the situation
   - Rights and obligations of parties
   - Applicable statutory provisions
   - Relevant case law

4. MAINTENANCE & SINKING FUND
   - Contribution obligations
   - Calculation methodology
   - Recovery of arrears
   - Liens on defaulting parcels

5. COMMON PROPERTY
   - Definition and scope
   - Exclusive use areas
   - Renovation and alteration rules
   - Insurance requirements

6. DISPUTE RESOLUTION
   - Strata Management Tribunal (SMT)
   - Commissioner of Buildings
   - Court proceedings
   - AGM/EGM procedures

7. PRACTICAL RECOMMENDATIONS
   - Immediate steps
   - Documentation needed
   - Timeline for resolution`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let advice = result.text ?? "Failed to advise.";
    advice = advice.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("strata", prompt.length, advice.length, Date.now() - startTime);
    res.json({ advice });
  } catch (error) {
    req.log.error({ error }, "Strata advice error");
    res.status(500).json({ error: "Failed to advise on strata management" });
  }
});

// ─── Quiz Generator ────────────────────────────────
router.post("/convey/quiz", async (req, res) => {
  try {
    const startTime = Date.now();
    const { topic, difficulty, numQuestions } = req.body;
    if (!topic) { res.status(400).json({ error: "Topic is required" }); return; }
    const prompt = `You are a Malaysian conveyancing law quiz master and legal education expert. Generate a quiz for law students studying Malaysian property and conveyancing law.

TOPIC: ${topic}
DIFFICULTY: ${difficulty || "intermediate"}
NUMBER OF QUESTIONS: ${numQuestions || 10}

Generate a comprehensive quiz with the following format for EACH question:

QUESTION [number]:
[Question text — scenario-based where possible, referencing Malaysian legislation, NLC provisions, or real case names]

A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

CORRECT ANSWER: [Letter]
EXPLANATION: [Detailed explanation citing the relevant section of the NLC, HDA, STA, Contracts Act, or other Malaysian legislation. Include case law references where applicable.]

---

Requirements:
- Questions must be specific to Malaysian law (NOT English or Australian law)
- Include questions on: NLC provisions, stamp duty calculations, RPGT scenarios, SPA terms, registration procedures, caveat law, strata management
- Use realistic Malaysian scenarios (e.g. property in Subang Jaya, Malay Reserve Land in Kelantan, strata unit in Mont Kiara)
- Reference actual Malaysian cases (e.g. Adorna Properties, Boonsom Boonyanit, SEA Housing Corporation)
- Mix difficulty levels: factual recall, application, and analysis questions`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let quiz = result.text ?? "Failed to generate quiz.";
    quiz = quiz.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("quiz", prompt.length, quiz.length, Date.now() - startTime);
    res.json({ quiz });
  } catch (error) {
    req.log.error({ error }, "Quiz generation error");
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

// ─── Transaction Simulator ────────────────────────────────
router.post("/convey/simulate", async (req, res) => {
  try {
    const startTime = Date.now();
    const { scenario, propertyType, transactionType } = req.body;
    if (!scenario) { res.status(400).json({ error: "Scenario is required" }); return; }
    const prompt = `You are an expert Malaysian conveyancing practitioner simulating a complete property transaction. Walk the student through every step of this transaction as if it were real.

SCENARIO: ${scenario}
PROPERTY TYPE: ${propertyType || "residential"}
TRANSACTION TYPE: ${transactionType || "sub-sale"}

Simulate the COMPLETE transaction from start to finish, including:

1. PRE-CONTRACT STAGE
   - Initial instructions from client
   - Due diligence steps (land search, bankruptcy search, company search)
   - Title verification and analysis
   - Negotiation points

2. CONTRACT STAGE
   - SPA preparation (Schedule G/H or private SPA for sub-sale)
   - Key terms and conditions
   - Stakeholder arrangements
   - Deposit handling (earnest deposit, differential sum)

3. FINANCING STAGE
   - Loan application process
   - Letter of Offer terms
   - Facility Agreement preparation
   - Charge documentation (Form 16A or Deed of Assignment)

4. COMPLETION STAGE
   - Balance purchase price calculation
   - Completion account preparation
   - Undertakings (solicitor's undertakings to bank)
   - Payment flow (who pays whom)

5. POST-COMPLETION
   - Stamp duty payment and adjudication
   - Presentment at Land Office
   - RPGT filing (Form CKHT)
   - Registration timeline and follow-up

6. POTENTIAL ISSUES
   - What could go wrong at each stage
   - How to resolve common problems
   - Red flags to watch for

For each step, specify:
- The exact documents involved (form numbers, statutory references)
- Timeline expectations
- Costs and fees (stamp duty, legal fees per SRO 2023, registration fees)
- Which party (vendor/purchaser/bank) is responsible

Use realistic Malaysian details (addresses, land office references, bank names).`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let simulation = result.text ?? "Failed to simulate.";
    simulation = simulation.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("simulate", prompt.length, simulation.length, Date.now() - startTime);
    res.json({ simulation });
  } catch (error) {
    req.log.error({ error }, "Transaction simulation error");
    res.status(500).json({ error: "Failed to simulate transaction" });
  }
});

// ─── Clause Library ────────────────────────────────
router.post("/convey/clause-library", async (req, res) => {
  try {
    const startTime = Date.now();
    const { clauseType, context, jurisdiction } = req.body;
    if (!clauseType) { res.status(400).json({ error: "Clause type is required" }); return; }
    const prompt = `You are a senior Malaysian conveyancing solicitor with 25+ years of drafting experience. Provide a comprehensive clause library entry for the requested clause type.

CLAUSE TYPE: ${clauseType}
CONTEXT: ${context || "general conveyancing"}
JURISDICTION: ${jurisdiction || "Peninsular Malaysia (NLC)"}

Provide the following for this clause type:

1. STANDARD CLAUSE
   - The full text of the standard/recommended clause as used in Malaysian practice
   - Line-by-line annotation explaining each provision

2. VARIATIONS
   - At least 3 variations of this clause for different scenarios:
     a) Basic version (simple transaction)
     b) Enhanced version (complex transaction with additional protections)
     c) Vendor-friendly version vs Purchaser-friendly version

3. STATUTORY BASIS
   - Which legislation governs this clause (NLC, HDA, Contracts Act, etc.)
   - Mandatory vs optional provisions
   - Whether the clause can be varied from the statutory form

4. CASE LAW
   - Key Malaysian cases interpreting this type of clause
   - How courts have treated variations or omissions

5. PRACTICAL NOTES
   - Common drafting errors to avoid
   - Negotiation points (what is negotiable vs non-negotiable)
   - When to use which variation
   - Red flags in opposing party's draft

6. RELATED CLAUSES
   - Other clauses that should be read together with this clause
   - Cross-references to other parts of the SPA/agreement`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let clauses = result.text ?? "Failed to generate clauses.";
    clauses = clauses.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("clause-library", prompt.length, clauses.length, Date.now() - startTime);
    res.json({ clauses });
  } catch (error) {
    req.log.error({ error }, "Clause library error");
    res.status(500).json({ error: "Failed to search clause library" });
  }
});

// ─── Document Analyzer ────────────────────────────────
router.post("/convey/analyze-doc", async (req, res) => {
  try {
    const startTime = Date.now();
    const { documentText, documentType } = req.body;
    if (!documentText) { res.status(400).json({ error: "Document text is required" }); return; }
    const prompt = `You are a senior Malaysian conveyancing solicitor reviewing a legal document. Analyze the following document thoroughly from a Malaysian law perspective.

DOCUMENT TYPE: ${documentType || "conveyancing document"}
DOCUMENT TEXT:
${documentText.substring(0, 6000)}

Provide a comprehensive analysis:

1. DOCUMENT IDENTIFICATION
   - Type of document and its purpose
   - Governing legislation
   - Whether it follows the statutory prescribed form (if applicable)

2. KEY TERMS ANALYSIS
   - Critical clauses and their implications
   - Rights and obligations of each party
   - Payment terms and timeline
   - Conditions precedent and subsequent

3. RISK ASSESSMENT
   - RED FLAGS — Clauses that are unusual, unfair, or potentially problematic
   - MISSING CLAUSES — Standard provisions that are absent
   - AMBIGUOUS TERMS — Language that could lead to disputes
   - NON-COMPLIANCE — Terms that may violate Malaysian law (HDA, NLC, Contracts Act)

4. COMPARISON WITH STANDARD
   - How this document compares to the standard form (Schedule G/H, Bar Council recommended forms)
   - Deviations from market standard and their significance

5. RECOMMENDATIONS
   - Amendments to request
   - Additional clauses to insert
   - Clauses to reject or negotiate
   - Priority ranking of issues (critical / important / minor)

6. RELEVANT CASE LAW
   - Cases that have interpreted similar clauses
   - Judicial approach to disputed terms`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let analysis = result.text ?? "Failed to analyze document.";
    analysis = analysis.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("analyze-doc", prompt.length, analysis.length, Date.now() - startTime);
    res.json({ analysis });
  } catch (error) {
    req.log.error({ error }, "Document analysis error");
    res.status(500).json({ error: "Failed to analyze document" });
  }
});

// ─── Compliance Checker ────────────────────────────────
router.post("/convey/compliance", async (req, res) => {
  try {
    const startTime = Date.now();
    const { transaction, checkType } = req.body;
    if (!transaction) { res.status(400).json({ error: "Transaction details are required" }); return; }
    const prompt = `You are a Malaysian conveyancing compliance officer with expertise in regulatory requirements. Conduct a comprehensive compliance check on the following transaction.

TRANSACTION DETAILS: ${transaction}
CHECK TYPE: ${checkType || "full compliance audit"}

Conduct the following compliance checks:

1. AML/CFT COMPLIANCE
   - Customer Due Diligence (CDD) requirements
   - Enhanced Due Diligence (EDD) triggers
   - Source of funds verification
   - Beneficial ownership identification
   - STR red flags assessment
   - Record-keeping requirements (6-year retention)

2. REGULATORY COMPLIANCE
   - Land Office requirements (consent, restrictions)
   - HDA compliance (for developer transactions)
   - Foreign ownership restrictions (EPU, state consent)
   - Malay Reserve / bumiputera quota compliance
   - RPGT compliance (Form CKHT filing, 3% retention)
   - Stamp duty compliance (30-day deadline)

3. PROFESSIONAL CONDUCT
   - Conflict of interest check
   - Client account handling (Solicitors' Accounts Rules)
   - Undertaking obligations
   - KYC documentation completeness
   - Retainer letter / engagement letter

4. DOCUMENTATION CHECKLIST
   - List of ALL documents required for this transaction
   - Status check: obtained / pending / not applicable
   - Expiry dates for searches and consents

5. TIMELINE COMPLIANCE
   - Statutory deadlines (stamp duty, RPGT, registration)
   - SPA milestones and VP deadline
   - Consent validity periods

6. RISK RATING
   - Overall compliance risk: LOW / MEDIUM / HIGH / CRITICAL
   - Specific risk items with recommended actions
   - Urgent items requiring immediate attention`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let compResult = result.text ?? "Failed to check compliance.";
    compResult = compResult.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("compliance", prompt.length, compResult.length, Date.now() - startTime);
    res.json({ result: compResult });
  } catch (error) {
    req.log.error({ error }, "Compliance check error");
    res.status(500).json({ error: "Failed to check compliance" });
  }
});

// ─── Transaction Timeline Generator ────────────────────────────────
router.post("/convey/timeline", async (req, res) => {
  try {
    const startTime = Date.now();
    const { transactionType, startDate, specialConditions } = req.body;
    if (!transactionType) { res.status(400).json({ error: "Transaction type is required" }); return; }
    const prompt = `You are a Malaysian conveyancing case manager. Generate a detailed timeline and milestone tracker for this property transaction.

TRANSACTION TYPE: ${transactionType}
START DATE: ${startDate || "today"}
SPECIAL CONDITIONS: ${specialConditions || "none"}

Generate a comprehensive timeline with the following:

1. PHASE 1: PRE-CONTRACT (Week 1-2)
   - Day-by-day breakdown of due diligence steps
   - Expected turnaround for searches
   - SPA drafting and negotiation timeline

2. PHASE 2: CONTRACT EXECUTION (Week 2-4)
   - SPA signing coordination
   - Deposit payment and stakeholder handling
   - Loan application submission

3. PHASE 3: FINANCING (Week 4-12)
   - Bank approval timeline (typically 2-4 weeks)
   - Letter of Offer processing
   - Loan documentation preparation
   - Charge/DOA preparation

4. PHASE 4: COMPLETION (Week 12-16)
   - Balance purchase price calculation
   - Redemption of existing charge (if sub-sale)
   - Completion mechanics and undertakings
   - Key handover

5. PHASE 5: POST-COMPLETION (Week 16-24)
   - Stamp duty payment (within 30 days of execution)
   - RPGT filing (within 60 days)
   - Presentment at Land Office
   - Expected registration timeline (varies by state)

For EACH milestone, specify:
- Target date/week
- Responsible party (vendor's solicitor / purchaser's solicitor / bank / client)
- Documents required
- Fees/costs payable
- Consequences of delay
- Dependencies (what must be completed first)

Also include:
- CRITICAL PATH items that cannot be delayed
- PARALLEL activities that can proceed simultaneously
- BUFFER periods for common delays (Land Office backlogs, bank processing)
- WARNING dates (statutory deadlines approaching)`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let timeline = result.text ?? "Failed to generate timeline.";
    timeline = timeline.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("timeline", prompt.length, timeline.length, Date.now() - startTime);
    res.json({ timeline });
  } catch (error) {
    req.log.error({ error }, "Timeline generation error");
    res.status(500).json({ error: "Failed to generate timeline" });
  }
});

// ─── Mock Exam Generator ────────────────────────────────
router.post("/convey/mock-exam", async (req, res) => {
  try {
    const startTime = Date.now();
    const { subject, examType, numQuestions } = req.body;
    if (!subject) { res.status(400).json({ error: "Subject is required" }); return; }
    const prompt = `You are a Malaysian law faculty examiner specialising in property and conveyancing law. Generate a complete mock examination paper.

SUBJECT: ${subject}
EXAM TYPE: ${examType || "final examination"}
NUMBER OF QUESTIONS: ${numQuestions || 5}

Generate a professional examination paper in the following format:

UNIVERSITI KEBANGSAAN MALAYSIA
FAKULTI UNDANG-UNDANG
${examType?.toUpperCase() || "FINAL EXAMINATION"}

SUBJECT: MALAYSIAN CONVEYANCING LAW — ${subject.toUpperCase()}
TIME: 3 HOURS
INSTRUCTIONS: Answer ALL questions. Each question carries equal marks.

---

For EACH question:
- Write a detailed problem question (scenario-based) of 150-250 words
- The scenario should involve realistic Malaysian parties, properties, and situations
- Include multiple legal issues within each scenario
- Reference specific sections of relevant Acts (NLC, HDA, STA, Contracts Act, RPGT Act, Stamp Act)

After ALL questions, provide:

SUGGESTED ANSWERS:

For each question:
1. ISSUE IDENTIFICATION — List all legal issues raised
2. APPLICABLE LAW — Cite the relevant statutory provisions and case law
3. APPLICATION — Apply the law to the facts
4. CONCLUSION — State the likely outcome

Reference these key Malaysian cases where relevant:
- Adorna Properties Sdn Bhd v Boonsom Boonyanit [2001] 1 MLJ 241
- Tan Ying Hong v Tan Sian San & Ors [2010] 2 MLJ 1
- SEA Housing Corporation v Lee Poh Choo [1982] 2 MLJ 31
- Au Meng Nam & Anor v Ung Yak Chew & Ors [2007] 5 MLJ 136
- Semenyih Jaya v Pentadbir Tanah Daerah Hulu Langat [2017] 3 MLJ 561

Grade each answer on:
- Issue identification (20%)
- Knowledge of law (30%)
- Application to facts (30%)
- Presentation and reasoning (20%)`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let exam = result.text ?? "Failed to generate exam.";
    exam = exam.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("mock-exam", prompt.length, exam.length, Date.now() - startTime);
    res.json({ exam });
  } catch (error) {
    req.log.error({ error }, "Mock exam generation error");
    res.status(500).json({ error: "Failed to generate mock exam" });
  }
});

// ─── Case Law Analyzer ────────────────────────────────
router.post("/convey/analyze-case", async (req, res) => {
  try {
    const startTime = Date.now();
    const { caseName, caseDetails, legalIssue } = req.body;
    if (!caseName) { res.status(400).json({ error: "Case name is required" }); return; }
    const prompt = `You are a Malaysian legal academic specialising in property and conveyancing law. Provide a comprehensive analysis of the following case.

CASE: ${caseName}
ADDITIONAL DETAILS: ${caseDetails || "none provided"}
LEGAL ISSUE FOCUS: ${legalIssue || "all issues"}

Provide a detailed case analysis in the following format:

1. CASE DETAILS
   - Full citation (if known)
   - Court (Federal Court / Court of Appeal / High Court)
   - Judge(s)
   - Date of decision

2. FACTS
   - Parties and their roles
   - Chronological narrative of events
   - The dispute that arose
   - Procedural history (if relevant)

3. LEGAL ISSUES
   - List every legal issue the court addressed
   - Primary issue vs secondary issues

4. ARGUMENTS
   - Plaintiff/Appellant's arguments
   - Defendant/Respondent's arguments
   - Amicus curiae submissions (if any)

5. COURT'S DECISION
   - Holding on each issue
   - Ratio decidendi (the binding principle)
   - Obiter dicta (incidental observations)
   - Dissenting opinions (if any)

6. LEGAL PRINCIPLES ESTABLISHED
   - What new principles did this case establish?
   - How did it change or clarify existing law?
   - Is it still good law today, or has it been overruled/distinguished?

7. IMPACT ON CONVEYANCING PRACTICE
   - How does this case affect day-to-day conveyancing practice?
   - What should practitioners do differently because of this case?
   - Client advisory implications

8. RELATED CASES
   - Cases that were followed, distinguished, or overruled
   - Subsequent cases that applied this decision
   - Comparative analysis with similar decisions

9. EXAMINATION NOTES
   - Key points for exam answers
   - How to cite this case effectively
   - Common student mistakes when analysing this case`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let analysis = result.text ?? "Failed to analyze case.";
    analysis = analysis.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("analyze-case", prompt.length, analysis.length, Date.now() - startTime);
    res.json({ analysis });
  } catch (error) {
    req.log.error({ error }, "Case analysis error");
    res.status(500).json({ error: "Failed to analyze case" });
  }
});

// ─── Corporate Resolution Drafter ─────────────────────────────────────────
router.post("/convey/corp-resolution", async (req, res) => {
  const parsed = DraftCorpResolutionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { companyName, companyNo, resolutionType, transactionDetails, signatories } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian corporate-conveyancing partner. Draft a formal company resolution suitable for use with a Malaysian property/conveyancing transaction.

COMPANY NAME: ${companyName}
COMPANY NO. (Suruhanjaya Syarikat Malaysia): ${companyNo || "[to be inserted]"}
RESOLUTION TYPE: ${resolutionType}
TRANSACTION DETAILS: ${transactionDetails}
SIGNATORIES (directors / shareholders / company secretary): ${signatories || "Board of Directors"}

Draft a complete resolution applying Malaysian company law (Companies Act 2016) and conveyancing requirements. Include:

1. HEADER — Company name, company number, registered office, type of resolution (Directors' Circular Resolution / Members' Special Resolution / Written Resolution), date.
2. RECITALS — Reference to the relevant constitution / M&A clause that authorises the transaction; reference to s.223 CA 2016 for substantial property transactions if applicable; reference to ss.211–214 CA 2016 directors' duties.
3. RESOLVED CLAUSES — Numbered resolutions covering: approval of the transaction, approval of the SPA / loan agreement / charge / lease, authority to execute & affix common seal under s.61 CA 2016, authority to appoint solicitors, authority to lodge with Land Office / SSM, ratification of acts done.
4. DELEGATED AUTHORITY — Identify the authorised signatory (director + company secretary or two directors per s.66 CA 2016) and any specific authority by power of attorney.
5. EXECUTION BLOCK — Signatures with name, NRIC/passport, designation, date; common seal block where required.
6. APPENDICES (described, not attached) — list documents to be tabled (SPA, valuation report, charge, board paper).
7. PRACTICAL NOTES — short bullet list at the end covering: lodgement with SSM (Form / e-lodgement requirement under CA 2016), stamp duty implications, EGM convening if member resolution, related-party considerations under s.228 CA 2016, listed-issuer Bursa requirements if applicable.

Use plain numbered prose — no markdown asterisks, hashes, backticks or code blocks.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let resolution = result.text ?? "Failed to draft resolution.";
    resolution = resolution.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("corp-resolution", prompt.length, resolution.length, Date.now() - startTime);
    res.json({ resolution });
  } catch (error) {
    req.log.error({ error }, "Corp resolution drafting error");
    res.status(500).json({ error: "Failed to draft corporate resolution" });
  }
});

// ─── Corporate Property Due Diligence ─────────────────────────────────────
router.post("/convey/corp-due-diligence", async (req, res) => {
  const parsed = GenerateCorpPropertyDDBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { companyDetails, propertyDetails, transactionType, concerns } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian corporate-conveyancing partner producing a combined Corporate + Property Due Diligence Report for a Malaysian transaction.

COMPANY (target / counter-party): ${companyDetails}
PROPERTY: ${propertyDetails}
TRANSACTION TYPE: ${transactionType || "Property acquisition / disposal by company"}
SPECIFIC CONCERNS: ${concerns || "Standard scope"}

Produce a structured legal due diligence report with the following sections:

1. EXECUTIVE SUMMARY — overall risk rating (Low / Moderate / High), top three issues, recommendation (proceed / proceed with conditions / re-negotiate / abort).

2. CORPORATE DUE DILIGENCE
   2.1 SSM searches required (Company Profile, Annual Return, Financial Statements, Charges register under s.352–s.362 CA 2016, Directors & Shareholders, Litigation/Winding-up search at MyCC / Court e-filing)
   2.2 Capacity & power — review of M&A / Constitution, objects clause (if retained), shareholder approvals required (s.223 CA 2016 substantial property transactions)
   2.3 Authority to transact — directors' resolutions, members' resolutions, common seal compliance (s.61 CA 2016), authorised signatories
   2.4 Encumbrances at SSM level — existing charges (debentures, fixed/floating), guarantees, cross-defaults
   2.5 Solvency & insolvency — winding-up search, JR / scheme of arrangement, related-party concerns (s.228 CA 2016)
   2.6 Beneficial Ownership compliance under the BO Reporting Framework

3. PROPERTY DUE DILIGENCE
   3.1 Land office / official search (private + official) — title type, area, restrictions in interest, express conditions
   3.2 Encumbrances — registered charges, caveats, lien-holder's caveats, lis pendens, statutory caveats
   3.3 Tenure issues — leasehold balance, conversion premium, category of land use
   3.4 Planning & local authority — DBKL/MBPJ/MPSJ searches, planning permissions, COFO/CCC status
   3.5 Quit rent / assessment / utilities arrears
   3.6 Statutory occupant / tenant issues, vacant possession risk
   3.7 Strata-specific items (where applicable) — MC, JMB, sinking fund arrears, by-laws

4. CROSS-CUTTING LEGAL ISSUES
   4.1 Stamp duty (Stamp Act 1949) — ad valorem assessment, exemptions, intra-group reliefs (s.15A SA 1949)
   4.2 RPGT (RPGTA 1976) — disposal date, retention sum, exemptions
   4.3 SST on legal fees (8 percent)
   4.4 Foreign exchange / EPU / FIC consent (where foreign-controlled company involved)
   4.5 Bursa / listed-issuer disclosure obligations (where applicable)
   4.6 Competition Act 2010 (large transactions)

5. RED FLAGS & MITIGANTS — table-style list of every red flag, severity, and recommended mitigation (CP, indemnity, retention sum, holdback, escrow).

6. CONDITIONS PRECEDENT (recommended) for inclusion in the SPA.

7. POST-COMPLETION ACTIONS — registration of MOT (Form 14A), discharge of existing charges, SSM lodgement of new charges (s.352 CA 2016, within 30 days), CKHT filings, board minute updates.

Use plain numbered prose — no markdown asterisks, hashes, backticks or code blocks.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let report = result.text ?? "Failed to produce report.";
    report = report.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("corp-dd", prompt.length, report.length, Date.now() - startTime);
    res.json({ report });
  } catch (error) {
    req.log.error({ error }, "Corp DD error");
    res.status(500).json({ error: "Failed to produce corporate due diligence report" });
  }
});

// ─── Joint Venture / Joint Development Agreement Drafter ──────────────────
router.post("/convey/jv-agreement", async (req, res) => {
  const parsed = DraftJVAgreementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { parties, propertyDetails, structureType, commercialTerms, duration } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian corporate-conveyancing partner. Draft a Joint Venture / Joint Development Agreement (JVA / JDA) used for a Malaysian property development project.

PARTIES (landowner & developer / co-investors): ${parties}
PROPERTY (subject land): ${propertyDetails}
STRUCTURE TYPE: ${structureType}
COMMERCIAL TERMS (profit / revenue / floor space share, GDV split, capital contribution): ${commercialTerms || "[to be inserted — please confirm with client]"}
DURATION / KEY MILESTONES: ${duration || "[to be inserted]"}

Draft a complete JVA / JDA with the following clauses, in proper numbered legal prose:

1. PARTIES, RECITALS, INTERPRETATION (definitions of GDV, GDC, Net Sales Proceeds, Project, Project Land, Approvals)
2. CONDITIONS PRECEDENT — board / member resolutions (CA 2016 ss.223, 228), state authority consent under s.214A NLC if alienation/lease, restriction-in-interest consents, EPU/FIC consents if applicable, planning approvals, financing
3. STRUCTURE & MECHANICS — choose appropriate model: (i) JVCo / SPV incorporation under CA 2016, (ii) profit-sharing / revenue-share without SPV, (iii) entitlement-based JDA (e.g. landowner entitlement of x percent of GDV or units), (iv) turnkey contract
4. CONTRIBUTIONS — landowner contributes land (with Power of Attorney / Trust Deed mechanism so developer can deal with title), developer contributes capital, expertise, financing
5. APPOINTMENT OF DEVELOPER & SCOPE OF WORKS — design, build, market, sell, obtain approvals, HDA licence, APDL, BPP
6. PROJECT FINANCING & SECURITY — bridging loan, end-financing, charge over land, parties' guarantees / corporate guarantees, end-financier disclaimers
7. PROFIT / REVENUE SHARING & WATERFALL — order of distribution, recovery of GDC, hurdle rate, true-up, retention
8. PROJECT TIMELINE & MILESTONES — Approval Date, Commencement Date, Vacant Possession Date, Completion Date, LAD where applicable
9. LANDOWNER'S COVENANTS — title warranties, no encumbrances, no caveats, deliver vacant possession of the land, execute Powers of Attorney and consents
10. DEVELOPER'S COVENANTS — comply with HDA 1966, Schedule G/H/I/J as applicable, STA 1985 where strata, professional standards, environmental compliance, anti-bribery
11. INTELLECTUAL PROPERTY & MARKETING RIGHTS
12. DEFAULT, TERMINATION & STEP-IN RIGHTS — financier step-in, novation rights, partial completion remedies
13. DISPUTE RESOLUTION — Malaysian arbitration (AIAC Rules) or courts of Malaya, governing law (Laws of Malaysia)
14. STAMP DUTY (Stamp Act 1949) treatment — typically nominal RM10 on the JVA itself, separate ad valorem on subsequent transfers/charges
15. TAX — RPGT (Schedule 2 Para 17 — disposal between connected companies / intra-group reliefs), real property company (RPC) considerations, SST on services
16. CONFIDENTIALITY, NOTICES, COUNTERPARTS, ENTIRE AGREEMENT, FORCE MAJEURE, ASSIGNMENT
17. SCHEDULES (described, not attached) — Land details, Project Specifications, Approvals Schedule, Financial Model, Form of Power of Attorney, Form of Trust Deed

End with a "Drafter's Notes" section (max 6 bullets) flagging the key commercial terms that must be confirmed, planning consents required, stamp duty exposure, and HDA licensing implications.

Use plain numbered prose — no markdown asterisks, hashes, backticks or code blocks.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let agreement = result.text ?? "Failed to draft.";
    agreement = agreement.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("jv-agreement", prompt.length, agreement.length, Date.now() - startTime);
    res.json({ agreement });
  } catch (error) {
    req.log.error({ error }, "JV agreement drafting error");
    res.status(500).json({ error: "Failed to draft JV / JDA" });
  }
});

// ─── Personal / Corporate Guarantee Drafter ───────────────────────────────
router.post("/convey/guarantee", async (req, res) => {
  const parsed = DraftGuaranteeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { guarantorType, guarantorDetails, principalDebtor, lender, facilityAmount, propertySecurity } = parsed.data;
  const startTime = Date.now();
  try {
    const prompt = `You are a senior Malaysian banking-conveyancing partner. Draft a ${guarantorType} (Personal Guarantee / Corporate Guarantee / Joint & Several Guarantee / Guarantee & Indemnity) for a Malaysian property-secured facility.

GUARANTOR(S): ${guarantorDetails}
PRINCIPAL DEBTOR / BORROWER: ${principalDebtor}
LENDER / CHARGEE: ${lender}
FACILITY AMOUNT: ${facilityAmount}
PROPERTY SECURITY (charge / assignment / collateral): ${propertySecurity || "[insert details of charged property — title, charge instrument, collateral]"}

Draft a complete Guarantee & Indemnity in proper numbered legal prose, addressing:

1. PARTIES, RECITALS — recital of the principal facility (Letter of Offer / Facility Agreement), the principal security (Charge under s.241 NLC / Deed of Assignment), and the consideration moving to the Guarantor.
2. INTERPRETATION — definitions (Facility, Indebtedness, Secured Liabilities, Demand, Business Day).
3. GUARANTEE — primary obligation (NOT merely a surety), continuing, all-monies, irrevocable; covers principal, interest, default interest, costs, indemnity costs.
4. INDEMNITY — separate principal-debtor indemnity to address risks of unenforceability of the guarantee against the Borrower.
5. JOINT AND SEVERAL LIABILITY (where applicable) — every Guarantor liable for the full amount; release of one does not release the others.
6. PRESERVATION OF GUARANTOR'S LIABILITY — anti-discharge clauses: variations, restructuring, time, indulgence, release of co-sureties, release of security, change in constitution of Borrower or Guarantor (where corporate), administration / receivership / scheme of arrangement, all preserved.
7. WAIVER OF SURETYSHIP RIGHTS — waiver of marshalling, set-off against Borrower, contribution, subrogation until full payment to Lender.
8. PAYMENT MECHANICS — payment on demand, free of set-off, deduction or counter-claim; gross-up for tax / withholding; default interest.
9. DEMAND — written demand sufficient; certificate by Lender of amount due is conclusive evidence (subject to manifest error); evidence of indebtedness.
10. SECURITY INTERESTS PRESERVED — Lender may enforce or refrain from enforcing primary security; Guarantor cannot insist on prior enforcement.
11. CORPORATE GUARANTOR-SPECIFIC PROVISIONS — capacity warranties, Companies Act 2016 ss.211/223 compliance, financial assistance prohibition (s.123 CA 2016), s.228 related-party, Board resolution and common seal under s.61 CA 2016.
12. INDIVIDUAL GUARANTOR-SPECIFIC PROVISIONS — independent legal advice acknowledgment (Yerkey v Jones / Royal Bank of Scotland v Etridge No.2 spousal-guarantee influence safeguards), bankruptcy consequences, IIK/CTOS reporting consent under PDPA 2010.
13. SET-OFF AND APPROPRIATION — Lender's right to consolidate accounts.
14. NOTICES, COUNTERPARTS, ASSIGNMENT (Lender may, Guarantor may not).
15. STAMP DUTY (Stamp Act 1949 — RM10 nominal on guarantee), GOVERNING LAW (Laws of Malaysia), JURISDICTION (Courts of Malaya / non-exclusive).
16. EXECUTION BLOCK — for individuals: signature, NRIC, witnessed by advocate & solicitor; for company: per s.66 CA 2016 (two authorised signatories) or common seal per s.61.

End with "Drafter's Notes" (max 5 bullets) flagging: (a) Etridge-style independent advice for individual / spousal guarantors, (b) s.123 CA 2016 financial assistance check, (c) intra-group corporate benefit / commercial benefit issue, (d) stamping deadline, (e) registration if charge over guarantor's company shares is taken in conjunction.

Use plain numbered prose — no markdown asterisks, hashes, backticks or code blocks.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 0 } },
    });
    let draft = result.text ?? "Failed to draft.";
    draft = draft.replace(/\*\*/g, "").replace(/\*/g, "").replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    trackUsage("guarantee", prompt.length, draft.length, Date.now() - startTime);
    res.json({ draft });
  } catch (error) {
    req.log.error({ error }, "Guarantee drafting error");
    res.status(500).json({ error: "Failed to draft guarantee" });
  }
});

// ─── Export to .docx (Malaysian Land Office format) ────────────────────────
router.post("/convey/export-docx", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      title?: string;
      content?: string;
      docType?: "land-office" | "firm" | "court" | "agreement";
      refNo?: string;
      parties?: string;
      state?: string;
      district?: string;
      filename?: string;
    };
    const title = (body.title ?? "Conveyancing Document").toString().slice(0, 200);
    const content = (body.content ?? "").toString();
    if (!content || content.trim().length < 5) {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    const MAX_CONTENT = 250_000; // ~250KB of text — generous for any draft
    if (content.length > MAX_CONTENT) {
      res.status(413).json({ error: "Content too large for export" });
      return;
    }
    const ALLOWED_DOC_TYPES = new Set(["land-office", "firm", "court", "agreement"]);
    const docType = body.docType && ALLOWED_DOC_TYPES.has(body.docType)
      ? body.docType
      : "land-office";
    const { buildLandOfficeDocx } = await import("../utils/docxExport");
    const buffer = await buildLandOfficeDocx({
      title,
      content,
      docType,
      refNo: body.refNo?.toString().slice(0, 80),
      parties: body.parties?.toString().slice(0, 500),
      state: body.state?.toString().slice(0, 50),
      district: body.district?.toString().slice(0, 50),
    });
    const safeName = (body.filename ?? title)
      .toString()
      .replace(/[^\w\d\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "conveyancing_document";
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.docx"`,
    );
    res.setHeader("Content-Length", buffer.length.toString());
    return res.send(buffer);
  } catch (error) {
    req.log.error({ error }, "Docx export error");
    res.status(500).json({ error: "Failed to export document" });
    return;
  }
});

export default router;
