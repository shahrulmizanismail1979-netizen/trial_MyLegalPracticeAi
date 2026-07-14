import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireSubscription } from "./billing";
import {
  DUE_DILIGENCE,
  RECOVERY_TRACKS,
  findTrack,
  type CausePaper,
} from "../lib/bankingRecovery";

const router: IRouter = Router();

// Reading the pathway library and the due-diligence checklist is open to any
// logged-in user; only AI cause-paper drafting (a generation action) is gated.
router.get("/pathways", (_req, res) => {
  res.json({ tracks: RECOVERY_TRACKS, dueDiligence: DUE_DILIGENCE });
});

const DRAFTING_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor with 20+ years in banking litigation and debt recovery, acting for a financial institution. You produce court-ready cause papers for the Malaysian High Court and subordinate courts.

GROUNDING AND ACCURACY — MANDATORY:
- Follow the Rules of Court 2012 (ROC 2012), the National Land Code, the Contracts Act 1950, the Companies Act 2016 and the Insolvency Act 1967 as applicable to the cause paper requested.
- NEVER fabricate case citations, statutory section numbers, court form numbers, filing fees or monetary thresholds. If you are not certain of a figure (for example the current bankruptcy threshold under the Insolvency Act 1967) write it as "[VERIFY: current threshold]" and tell the practitioner to confirm it against primary sources.
- Use [PLACEHOLDER] in square brackets for every case-specific detail not supplied (parties, amounts, dates, title particulars, suit numbers).

FORMAT RULES:
- Include the full court title (e.g. "IN THE HIGH COURT IN MALAYA AT [PLACE]"), the suit/OS/petition number placeholder, and correct party designations (PLAINTIFF/DEFENDANT, CHARGEE/CHARGOR, PETITIONER/RESPONDENT).
- Pleadings and affidavits use numbered paragraphs; affidavits are in the first person, sworn/affirmed, with exhibits marked "A", "B", etc.
- Land described in proper NLC format (Geran/H.S.(D) No., Lot/P.T. No., Mukim, District, State). Amounts in RM to two decimals.
- Include signature blocks and attestation/jurat clauses where the document requires them.`;

const PRACTITIONER_DIRECTIVE = `
═══ PRACTITIONER OUTPUT DIRECTIVE ═══
Your reader is a busy practising Malaysian advocate & solicitor on a live recovery file. Produce text they can lift straight into the filing — actual drafted paragraphs, recitals and prayers, not descriptions of what such clauses would say. Be specific to current Malaysian banking-litigation practice: cite the exact Order/rule/section and the relevant form, and flag the traps that lose these applications (e.g. unstamped guarantee, defective Form 16D service, disputed-debt winding-up). End with a short numbered "NEXT STEPS / TO VERIFY" list. Keep every citation-accuracy rule: never invent citations, fees or thresholds; if unsure, mark "[VERIFY]" and say what to check. Apply this style WITHIN any fixed structure the cause paper requires.`;

// ─── AI cause-paper drafter (premium, SSE streaming) ──────────────────────────
router.post("/draft", requireSubscription, async (req, res) => {
  const {
    trackId,
    causePaperId,
    court,
    parties,
    facts,
    security,
    amount,
    additionalDetails,
  } = req.body ?? {};

  const track = typeof trackId === "string" ? findTrack(trackId) : undefined;
  if (!track) {
    res.status(400).json({ error: "Unknown recovery track" });
    return;
  }
  let causePaper: CausePaper | undefined;
  if (typeof causePaperId === "string") {
    causePaper = track.causePapers.find((c) => c.id === causePaperId);
  }
  if (!causePaper) {
    res.status(400).json({ error: "Unknown cause paper for this track" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const userPrompt = `RECOVERY TRACK: ${track.name} (${track.shortName})
TRACK SUMMARY: ${track.summary}
STATUTORY BASIS OF THIS TRACK: ${track.prerequisites.join(" | ")}

CAUSE PAPER TO DRAFT: ${causePaper.name}
GOVERNING PROVISION: ${causePaper.basis}
PURPOSE: ${causePaper.description}

CASE PARTICULARS SUPPLIED BY THE PRACTITIONER:
- Court / registry: ${court || "[not supplied — use placeholder]"}
- Parties: ${parties || "[not supplied — use placeholders]"}
- Facility / default facts: ${facts || "[not supplied — use placeholders]"}
- Security (charge/guarantee particulars): ${security || "[none supplied]"}
- Outstanding amount: ${amount || "[not supplied — use placeholder]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Draft the "${causePaper.name}" in full, court-ready form for this banking-recovery matter, complying with ${causePaper.basis} and the format rules. Fill in what you can from the particulars above and use [PLACEHOLDER] for anything missing. Then give the short "NEXT STEPS / TO VERIFY" list.`;

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `${DRAFTING_CONTEXT}\n${PRACTITIONER_DIRECTIVE}\n\n${userPrompt}` },
          ],
        },
      ],
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        disclaimer:
          "AI-generated draft. Verify every citation, form number, statutory threshold and the correct forum against primary sources, and settle the cause paper before filing.",
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
