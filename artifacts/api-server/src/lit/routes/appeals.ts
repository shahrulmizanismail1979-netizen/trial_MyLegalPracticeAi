import { Router, type IRouter } from "express";
import { requireSubscription } from "./billing";
import { streamChat, normalizeProvider } from "../lib/aiProvider";
import {
  APPEAL_PATHWAYS,
  FORUM_TIERS,
  findPathway,
  routeForum,
  type AppealCausePaper,
} from "../lib/appeals";

const router: IRouter = Router();

// Reading the pathway library and routing a claim to its forum are open to any
// user; only AI cause-paper drafting (a generation action) is premium-gated.
router.get("/pathways", (_req, res) => {
  res.json({ pathways: APPEAL_PATHWAYS, forumTiers: FORUM_TIERS });
});

// Jurisdiction routing by claim amount — GET /forum?amount=250000
router.get("/forum", (req, res) => {
  const rawVal = Array.isArray(req.query.amount) ? req.query.amount[0] : req.query.amount;
  const raw = typeof rawVal === "string" ? rawVal.trim() : "";
  const amount = Number(raw);
  if (raw === "" || !Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: "Provide a non-negative numeric ?amount" });
    return;
  }
  res.json(routeForum(amount));
});

const DRAFTING_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor with 20+ years of appellate practice before the High Court, Court of Appeal and Federal Court. You produce court-ready appeal cause papers.

GROUNDING AND ACCURACY — MANDATORY:
- Follow the Courts of Judicature Act 1964 (CJA), the Rules of Court 2012, the Rules of the Court of Appeal 1994 and the Rules of the Federal Court 1995 as applicable to the cause paper requested.
- NEVER fabricate case citations, statutory section numbers, rule numbers, court form numbers, filing fees or time periods. Appeal time limits and leave requirements are strict and frequently revised — if you are not certain of a period, rule or threshold, write it as "[VERIFY: ...]" and tell the practitioner to confirm it against the primary sources and the current cause-list practice directions.
- Use [PLACEHOLDER] in square brackets for every case-specific detail not supplied (parties, dates, suit/appeal numbers, the decision appealed against, the questions of law).

FORMAT RULES:
- Include the correct appellate court title (e.g. "IN THE COURT OF APPEAL OF MALAYSIA (APPELLATE JURISDICTION)"), the appeal number placeholder, and correct party designations (APPELLANT/RESPONDENT).
- A Memorandum of Appeal sets out grounds as concise numbered paragraphs. A Notice of Motion for leave states the orders sought and is supported by an affidavit and the proposed questions of law.
- Amounts in RM to two decimals. Include signature/attestation blocks where the document requires them.`;

const PRACTITIONER_DIRECTIVE = `
═══ PRACTITIONER OUTPUT DIRECTIVE ═══
Your reader is a busy practising Malaysian advocate & solicitor running a live appeal. Produce text they can lift straight into the filing — actual drafted grounds, prayers and questions of law, not descriptions. Be specific to current Malaysian appellate practice: cite the exact section/rule and flag the traps that sink appeals (missed/strict time limits, failure to obtain leave under s.96 CJA, s.68 CJA exclusions, unpaid deposit for costs, defective record). End with a short numbered "NEXT STEPS / TO VERIFY" list highlighting every time limit and leave requirement to confirm. Keep every citation-accuracy rule: never invent citations, fees, rules or periods; if unsure, mark "[VERIFY]" and say what to check.`;

router.post("/draft", requireSubscription, async (req, res) => {
  const {
    pathwayId,
    causePaperId,
    court,
    parties,
    decision,
    grounds,
    questionsOfLaw,
    additionalDetails,
  } = req.body ?? {};

  const pathway = typeof pathwayId === "string" ? findPathway(pathwayId) : undefined;
  if (!pathway) {
    res.status(400).json({ error: "Unknown appeal pathway" });
    return;
  }
  let causePaper: AppealCausePaper | undefined;
  if (typeof causePaperId === "string") {
    causePaper = pathway.causePapers.find((c) => c.id === causePaperId);
  }
  if (!causePaper) {
    res.status(400).json({ error: "Unknown cause paper for this pathway" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const userPrompt = `APPEAL PATHWAY: ${pathway.name} (${pathway.fromForum} → ${pathway.toForum})
PATHWAY SUMMARY: ${pathway.summary}
LEAVE REQUIRED: ${pathway.leaveRequired ? "YES" : "No (ordinarily)"} — ${pathway.leaveNote}

CAUSE PAPER TO DRAFT: ${causePaper.name}
GOVERNING PROVISION: ${causePaper.basis}
PURPOSE: ${causePaper.description}

CASE PARTICULARS SUPPLIED BY THE PRACTITIONER:
- Appellate court / registry: ${court || "[not supplied — use placeholder]"}
- Parties (appellant / respondent): ${parties || "[not supplied — use placeholders]"}
- Decision appealed against: ${decision || "[not supplied — use placeholders]"}
- Grounds / complaints with the decision: ${grounds || "[not supplied — use placeholders]"}
- Proposed questions of law (if leave): ${questionsOfLaw || "[none supplied]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Draft the "${causePaper.name}" in full, court-ready form for this appeal, complying with ${causePaper.basis} and the format rules. Fill in what you can from the particulars and use [PLACEHOLDER] for anything missing. Then give the short "NEXT STEPS / TO VERIFY" list, calling out every time limit and leave requirement to confirm.`;

    for await (const piece of streamChat(
      [{ role: "user", text: `${DRAFTING_CONTEXT}\n${PRACTITIONER_DIRECTIVE}\n\n${userPrompt}` }],
      { provider: normalizeProvider(req.body?.provider), maxOutputTokens: 8192 },
    )) {
      if (piece.text) {
        res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
      }
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        disclaimer:
          "AI-generated draft. Appeal time limits and leave requirements are strict — verify every period, rule, citation and the correct forum against primary sources, and settle the cause paper before filing.",
      })}\n\n`,
    );
    res.end();
  } catch {
    res.write(
      `data: ${JSON.stringify({ error: "Failed to generate the draft", done: true })}\n\n`,
    );
    res.end();
  }
});

export default router;
