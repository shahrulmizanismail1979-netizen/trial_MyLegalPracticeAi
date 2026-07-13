import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { AssistantChatBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Abuse controls: this is a public, unauthenticated endpoint that spends AI
// credits. Per-IP sliding-window rate limits + a concurrent-stream cap.
// In-memory is fine: the API server runs as a single instance.
// ---------------------------------------------------------------------------
const MINUTE_LIMIT = 10;
const DAY_LIMIT = 150;
const MAX_CONCURRENT_PER_IP = 2;

interface IpUsage {
  minute: number[];
  day: number[];
  active: number;
}
const usageByIp = new Map<string, IpUsage>();

setInterval(() => {
  const dayAgo = Date.now() - 86_400_000;
  for (const [ip, usage] of usageByIp) {
    usage.day = usage.day.filter((t) => t > dayAgo);
    if (usage.day.length === 0 && usage.active === 0) usageByIp.delete(ip);
  }
}, 3_600_000).unref();

function checkRateLimit(ip: string): { ok: boolean; reason?: string } {
  const now = Date.now();
  let usage = usageByIp.get(ip);
  if (!usage) {
    usage = { minute: [], day: [], active: 0 };
    usageByIp.set(ip, usage);
  }
  usage.minute = usage.minute.filter((t) => t > now - 60_000);
  usage.day = usage.day.filter((t) => t > now - 86_400_000);
  if (usage.active >= MAX_CONCURRENT_PER_IP) return { ok: false, reason: "concurrent" };
  if (usage.minute.length >= MINUTE_LIMIT) return { ok: false, reason: "minute" };
  if (usage.day.length >= DAY_LIMIT) return { ok: false, reason: "day" };
  usage.minute.push(now);
  usage.day.push(now);
  usage.active++;
  return { ok: true };
}

function releaseStream(ip: string): void {
  const usage = usageByIp.get(ip);
  if (usage && usage.active > 0) usage.active--;
}

const SITE_KNOWLEDGE = `
You are the AI receptionist for "My Legal Practice AI" (mylegalpracticeai.life) — a suite of AI-powered virtual paralegal portals for the Malaysian legal profession, curated by Prof. Madya Dr. Shahrul Mizan Ismail.

THE AI PORTALS (each is a separate subscription-based web app):
1. MyLitAI (mylitai.life) — Civil litigation: pleadings, submissions, case research (Standard & IRAC versions).
2. MySyalitAI (mysyalitai.life) — Syariah litigation: Syariah pleadings and procedure.
3. MyCorpAI (mycorpai.life) — Corporate secretarial work: Companies Act 2016 compliance, board resolutions.
4. MyConveyAI (myconveyai.life) — Conveyancing: S&P agreements, land searches, loan documentation.
5. MyCrimAI — Criminal law: submissions, sentencing research.
6. MyCorpCommBankLitAi — Corporate, commercial and banking litigation.
7. MyAccidentAi — Personal injury / accident claims and damages assessment.
Coming soon: MyLawFirmAi, MyJudicialAi, MyClientAi, MyLawAcad, MyLawResearch.

PRICING (USD, monthly):
- Free Trial: 7 days free on a single app, then $25/month. Card details are collected up front; the card is charged when the trial ends unless cancelled.
- Single App: $25/month for unlimited use of one portal.
- Complete Bundle: $79/month for all 7 portals (save ~48%).
- Firm bundles: Boutique $355/mo (5 seats), Practice $1005/mo (15 seats), Firm $1890/mo (30 seats).
- Corporate and education bundles are also available (see the sections on this page).
- Subscriptions are monthly, cancel anytime. Payment is by card via Stripe.

HOW IT WORKS:
- Subscribe on this landing page → after checkout, the customer receives an access code by email → use that code to access the chosen portal.
- Legal professionals can also contribute documents to the knowledge base via the Contribute page (rewards offered for approved contributions).

SUPPORT: email shahrulmizan@ukm.edu.my or WhatsApp +60139725475.

PAGE SECTIONS you can send visitors to (use navigation actions):
- apps — the portal catalogue
- pricing — trial, single app and bundle plans
- firm-bundles — law firm team plans
- corporate-bundles — corporate plans
- education-bundles — university/education plans
- contribute — contribute documents to the knowledge base
- payment — accepted payment methods
- security — data security information
- about — about the curator and the project

RULES:
- Be warm, concise and professional — like a knowledgeable reception counter. Answer in the language the visitor uses (English or Bahasa Malaysia).
- When you point the visitor somewhere on this page, add a navigation action on its own line at the END of your reply, in exactly this format: [[goto:SECTION_ID|Button label]] — e.g. [[goto:pricing|See pricing plans]]. Use at most 2 such actions per reply, only from the section list above.
- You may use short markdown: **bold** and bullet lists. Keep replies under ~150 words.
- You are NOT a lawyer and must not give legal advice on actual cases; if asked, explain the portals assist legal professionals and suggest trying the relevant portal.
- If you don't know something (e.g. refunds for a specific case), give the support contact instead of guessing.
- Never invent prices, features or portals not listed here.
`.trim();

/** Best-effort live pricing pulled from synced Stripe data; falls back to static knowledge. */
async function getLivePricingNote(): Promise<string> {
  try {
    const result = await db.execute(sql`
      SELECT p.name, pr.unit_amount, pr.currency
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount
      LIMIT 10
    `);
    const rows = result.rows as Array<{ name: string; unit_amount: number; currency: string }>;
    if (rows.length === 0) return "";
    const lines = rows.map(
      (r) => `- ${r.name}: ${(Number(r.unit_amount) / 100).toFixed(2)} ${String(r.currency).toUpperCase()}/month`,
    );
    return `\n\nLIVE PRICING FROM OUR BILLING SYSTEM (authoritative if it differs from above):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

router.post("/chat", async (req, res) => {
  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  // The system prompt is server-controlled; the client may only speak as the
  // user. Keep prior assistant turns for context, but the final message must
  // be from the user, and history is capped server-side.
  const messages = parsed.data.messages.slice(-12);
  if (messages[messages.length - 1]!.role !== "user") {
    res.status(400).json({ error: "Last message must be from the user" });
    return;
  }

  const ip = req.ip ?? "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    req.log.warn({ ip, reason: limit.reason }, "Assistant chat rate limit hit");
    res
      .status(429)
      .json({ error: "You're sending messages too quickly. Please wait a moment and try again." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const pricingNote = await getLivePricingNote();
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "system", content: SITE_KNOWLEDGE + pricingNote }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Assistant chat stream failed");
    res.write(
      `data: ${JSON.stringify({ error: "The assistant is temporarily unavailable. Please try again." })}\n\n`,
    );
  } finally {
    releaseStream(ip);
  }
  res.end();
});

export default router;
