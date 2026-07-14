import { Router, type IRouter } from "express";
import { requireSubscription } from "./billing";
import { streamChat, normalizeProvider } from "../lib/aiProvider";
import {
  AFFIDAVIT_TYPES,
  AFFIDAVIT_FIELDS,
  findAffidavitType,
} from "../lib/affidavits";

const router: IRouter = Router();

// Reading the document library is open; only AI drafting (a generation action)
// is premium-gated.
router.get("/types", (_req, res) => {
  res.json({ types: AFFIDAVIT_TYPES, fields: AFFIDAVIT_FIELDS });
});

const DRAFTING_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor with 20+ years of civil litigation practice. You produce court-ready affidavits and supporting documents for filing in the Malaysian courts.

GROUNDING AND ACCURACY — MANDATORY:
- Follow the Rules of Court 2012 and the practice of the relevant registry for affidavit form (heading, body, jurat/attestation, exhibit marking).
- NEVER fabricate case citations, statutory section numbers, rule numbers, court form numbers, dates, sums or filing fees. Affidavit rules (who may depose, sources/grounds of belief, exhibit production, filing sequence) are strict — if you are not certain of a rule number or requirement, write it as "[VERIFY: ...]" and tell the practitioner to confirm it against the primary sources and registry practice.
- Use [PLACEHOLDER] in square brackets for every case-specific detail not supplied (parties, NRIC, suit numbers, dates, sums, exhibit dates).

FORMAT RULES:
- Affidavits: correct court heading, the suit number placeholder, party designations, then "I, [deponent], do solemnly affirm and say as follows:" with consecutively numbered paragraphs; refer to exhibits as marked exhibits (e.g. "exhibited and marked as 'AK-1'"); end with a jurat/attestation block ("Affirmed by … at … on … Before me, … Commissioner for Oaths").
- For a deponent who is an authorised officer of a party (e.g. a bank), state the source of authority and that the facts are within knowledge / gleaned from records kept in the ordinary course of business, with sources and grounds of belief for anything not within personal knowledge.
- Supporting documents (notice of demand, certificate of urgency) follow their ordinary letter/certificate form.
- Amounts in RM to two decimals.`;

const PRACTITIONER_DIRECTIVE = `
═══ PRACTITIONER OUTPUT DIRECTIVE ═══
Your reader is a busy practising Malaysian advocate & solicitor preparing a document for filing. Produce text they can lift straight into the document — actual drafted, numbered paragraphs deposing to the facts and producing the exhibits, not descriptions of what an affidavit should contain. Be specific to current Malaysian practice and flag the traps that get affidavits struck out or given little weight (deposing beyond personal knowledge without stating sources and grounds of belief, defective jurat, exhibits not properly produced, an "affidavit in reply" that smuggles in a new case, filing without leave where leave is needed). End with a short numbered "NEXT STEPS / TO VERIFY" list highlighting the rule references and registry requirements to confirm. Keep every citation-accuracy rule: never invent citations, rules, fees or dates; if unsure, mark "[VERIFY]" and say what to check.`;

router.post("/draft", requireSubscription, async (req, res) => {
  const {
    typeId,
    court,
    parties,
    deponent,
    context,
    facts,
    exhibits,
    additionalDetails,
  } = req.body ?? {};

  const docType = typeof typeId === "string" ? findAffidavitType(typeId) : undefined;
  if (!docType) {
    res.status(400).json({ error: "Unknown document type" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const userPrompt = `DOCUMENT TO DRAFT: ${docType.name}
CATEGORY: ${docType.category === "affidavit" ? "Affidavit" : "Supporting document"}
GOVERNING BASIS: ${docType.basis}
PURPOSE: ${docType.description}
DRAFTING TRAPS TO RESPECT: ${docType.caveats.join(" ")}

CASE PARTICULARS SUPPLIED BY THE PRACTITIONER:
- Court / registry & suit no.: ${court || "[not supplied — use placeholder]"}
- Parties: ${parties || "[not supplied — use placeholders]"}
- Deponent (name, NRIC, capacity): ${deponent || "[not supplied — use placeholders]"}
- Application / matter this relates to: ${context || "[not supplied — use placeholders]"}
- Facts / substance to depose to: ${facts || "[not supplied — use placeholders]"}
- Exhibits to refer to: ${exhibits || "[none supplied — mark exhibits as placeholders if the document needs them]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Draft the "${docType.name}" in full, court-ready form complying with ${docType.basis} and the format rules. Number the paragraphs, produce and mark the exhibits referred to${docType.hasExhibits ? "" : " (if any)"}, and ${docType.category === "affidavit" ? "include the correct jurat/attestation block" : "use the correct letter/certificate form"}. Fill in what you can from the particulars and use [PLACEHOLDER] for anything missing. Then give the short "NEXT STEPS / TO VERIFY" list.`;

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
          "AI-generated draft. Affidavit rules, jurat/attestation and exhibit production are strict — verify every rule reference and the registry's requirements, and settle the document before affirming and filing.",
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
