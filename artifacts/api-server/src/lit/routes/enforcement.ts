import { Router, type IRouter } from "express";
import { requireSubscription } from "./billing";
import { streamChat, normalizeProvider, type AIProvider } from "../lib/aiProvider";
import {
  ENFORCEMENT_METHODS,
  COSTS_BASES,
  publicEnforcementDocuments,
  findDocument,
} from "../lib/enforcement";

const router: IRouter = Router();

// Reference library — open to any logged-in user.
router.get("/methods", (_req, res) => {
  res.json({
    methods: ENFORCEMENT_METHODS,
    costsBases: COSTS_BASES,
    documents: publicEnforcementDocuments(),
  });
});

const ADVISOR_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor specialising in debt recovery and post-judgment enforcement, acting for a judgment creditor (typically a financial institution). You advise on how best to enforce a money judgment.

GROUNDING AND ACCURACY — MANDATORY:
- Work within the Rules of Court 2012 (Orders 45–52 govern execution), the Insolvency Act 1967 and the Companies Act 2016.
- The realistic enforcement options are: Writ of Seizure and Sale (movable / immovable, O.46–47), Garnishee proceedings (O.49), Judgment Debtor Examination (O.48), Charging order (O.50), Bankruptcy (individual, Insolvency Act 1967), Winding-up (company, ss.464–466 CA 2016) and Committal for contempt (O.52, for non-money orders).
- NEVER fabricate case citations, section numbers, court fees or monetary thresholds. If unsure of a figure (e.g. the current bankruptcy threshold under the Insolvency Act 1967) write "[VERIFY: current threshold]" and tell the practitioner to confirm it.
- Match the method to the debtor (individual vs company) and to the assets disclosed. Do not recommend winding-up for an individual or bankruptcy for a company.`;

const COSTS_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor drawing a Bill of Costs for taxation under Order 59 of the Rules of Court 2012. You produce a properly structured bill the Registrar can tax.

GROUNDING AND ACCURACY — MANDATORY:
- Follow Order 59 ROC 2012. Structure the bill in the conventional parts: (I) work done in the cause or matter other than taxation (getting-up, drafting, attendances, perusals, correspondence, advocacy), (II) work done on the taxation itself, and (III) disbursements (filing fees, service, sealed copies, travelling, counsel's fees, etc.).
- Distinguish profit costs (getting-up) from disbursements. State the basis of taxation clearly (standard / indemnity / solicitor-and-client) per O.59 r.16.
- NEVER fabricate court fees, scale figures or case citations. Where a quantum is not supplied or not fixed by scale, insert "[AMOUNT — to be assessed]" or "[VERIFY scale fee]" rather than inventing a number. Use [PLACEHOLDER] for any case-specific detail not supplied.
- Remind the practitioner that quantum on the standard basis must be reasonable and proportionate; doubt is resolved against the receiving party.`;

const PRACTITIONER_DIRECTIVE = `
═══ PRACTITIONER OUTPUT DIRECTIVE ═══
Your reader is a busy practising Malaysian advocate & solicitor on a live recovery file. Give them something they can act on or file, not a textbook. Be concrete and specific to current Malaysian enforcement/taxation practice; cite the exact Order/rule/section. Flag the traps that lose these applications (e.g. leave to issue execution on a stale judgment, an empty account on a garnishee nisi, winding-up on a disputed debt, items taxed off as disproportionate). Never invent citations, fees or thresholds; if unsure mark "[VERIFY]" and say what to check.`;

const DOCUMENT_CONTEXT = `You are a Senior Malaysian Advocate & Solicitor drafting post-judgment enforcement COURT DOCUMENTS for a judgment creditor, ready for settling and filing. You produce properly formatted documents in the conventional Malaysian style.

GROUNDING AND ACCURACY — MANDATORY:
- Work within the Rules of Court 2012 (execution: Orders 45–52), the Insolvency Act 1967 (individuals) and the Companies Act 2016 (companies). Use the EXACT Order/rule/section that governs the requested document.
- Produce a complete, properly structured document: the full court title and heading (court, registry, suit/cause number, parties with their roles), the body of the instrument, the prayers/operative wording, and the formal ending (date, signature block for the solicitors, and the address for service / "This [document] is filed by …" footer).
- Where a document is normally accompanied by a supporting affidavit or a draft order, produce each as a clearly separated, individually headed document.
- NEVER fabricate case citations, court fees, statutory thresholds or monetary amounts. For any case-specific detail not supplied, insert a clearly marked "[PLACEHOLDER: …]". For any figure you cannot verify (e.g. the current bankruptcy or winding-up threshold), write "[VERIFY: …]" and tell the practitioner what to confirm — do not guess.
- Match the document to the debtor type: never draft a winding-up petition against an individual or a bankruptcy notice against a company.
- This is a first draft to be settled by the conducting solicitor, not a filed document.`;

function sse(res: import("express").Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

async function streamPrompt(
  res: import("express").Response,
  systemContext: string,
  userPrompt: string,
  disclaimer: string,
  provider?: AIProvider,
) {
  try {
    for await (const piece of streamChat(
      [{ role: "user", text: `${systemContext}\n${PRACTITIONER_DIRECTIVE}\n\n${userPrompt}` }],
      { provider, maxOutputTokens: 8192 },
    )) {
      if (piece.text) res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true, disclaimer })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate", done: true })}\n\n`);
    res.end();
  }
}

// ─── Enforcement strategy advisor (premium, SSE) ──────────────────────────────
router.post("/advise", requireSubscription, async (req, res) => {
  const {
    debtorType,
    judgmentSum,
    judgmentDate,
    knownAssets,
    debtorProfile,
    priorSteps,
    additionalDetails,
  } = req.body ?? {};

  sse(res);

  const methodList = ENFORCEMENT_METHODS.map(
    (m) => `- ${m.shortName} (${m.basis}, suits: ${m.debtor}) — ${m.summary}`,
  ).join("\n");

  const userPrompt = `Advise the judgment creditor on the best post-judgment enforcement strategy.

AVAILABLE METHODS:
${methodList}

CASE PARTICULARS:
- Debtor type: ${debtorType || "[not stated]"}
- Judgment sum: ${judgmentSum || "[not stated]"}
- Date of judgment: ${judgmentDate || "[not stated]"}
- Known assets of the debtor: ${knownAssets || "[none disclosed — consider Judgment Debtor Examination first]"}
- Debtor profile / circumstances: ${debtorProfile || "[not stated]"}
- Steps already taken: ${priorSteps || "[none]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Recommend a prioritised enforcement strategy. For each recommended method give: (1) why it fits this debtor and these assets, (2) the governing Order/section, (3) the prerequisites to satisfy first (e.g. leave to issue execution if the judgment is stale), and (4) the key risk. Where assets are unknown, advise the investigative step (e.g. O.48 examination) before committing. Note whether methods can run in parallel or should be sequenced. End with a short numbered "IMMEDIATE NEXT STEPS / TO VERIFY" list.`;

  await streamPrompt(
    res,
    ADVISOR_CONTEXT,
    userPrompt,
    "AI-generated strategic guidance. Verify every citation, fee and threshold and confirm the debtor's asset position before commencing any enforcement step.",
    normalizeProvider(req.body?.provider),
  );
});

// ─── Bill of Costs (O.59) drafter (premium, SSE) ──────────────────────────────
router.post("/bill-of-costs", requireSubscription, async (req, res) => {
  const {
    court,
    suitNo,
    parties,
    basis,
    costsOrder,
    workDone,
    attendances,
    disbursements,
    counselFees,
    additionalDetails,
  } = req.body ?? {};

  const basisMeta = COSTS_BASES.find((b) => b.id === basis);

  sse(res);

  const userPrompt = `Draft a Bill of Costs for taxation under Order 59 ROC 2012.

BASIS OF TAXATION: ${basisMeta ? `${basisMeta.name} — ${basisMeta.description}` : "[not stated — assume standard basis and say so]"}

CASE PARTICULARS:
- Court / registry: ${court || "[PLACEHOLDER]"}
- Suit / cause number: ${suitNo || "[PLACEHOLDER]"}
- Parties: ${parties || "[PLACEHOLDER]"}
- Costs order being taxed: ${costsOrder || "[PLACEHOLDER — e.g. 'costs of RM[ ] / costs to be taxed' per order dated ...]"}
- Work done (getting-up, drafting, perusals, correspondence, advocacy): ${workDone || "[not itemised — provide standard heads with placeholders]"}
- Attendances / hearings: ${attendances || "[not itemised]"}
- Disbursements (filing fees, service, sealed copies, travelling): ${disbursements || "[not itemised]"}
- Counsel's fees (getting-up / brief / refreshers): ${counselFees || "[not itemised]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Draft the full Bill of Costs with the proper court title and heading, then the conventional parts — Part I (work done other than taxation), Part II (work done on the taxation), Part III (disbursements) — each as an itemised table-style list with a description, the work/basis and an amount column. Where an amount is not supplied or is fixed by scale, use "[AMOUNT — to be assessed]" or "[VERIFY scale fee]". Total each part and give a grand total line. Close with the certificate/verification wording and a short "NOTES / TO VERIFY" list (basis, proportionality, scale fees to confirm).`;

  await streamPrompt(
    res,
    COSTS_CONTEXT,
    userPrompt,
    "AI-generated draft bill. Verify all scale fees and court charges, ensure quantum is reasonable and proportionate for the basis claimed, and settle the bill before filing for taxation.",
    normalizeProvider(req.body?.provider),
  );
});

// ─── Enforcement court-document drafter (premium, SSE) ────────────────────────
router.post("/draft-document", requireSubscription, async (req, res) => {
  const {
    documentType,
    court,
    suitNo,
    parties,
    judgmentSum,
    judgmentDate,
    debtorName,
    debtorAddress,
    debtorType,
    particulars,
    additionalDetails,
  } = req.body ?? {};

  const doc = findDocument(typeof documentType === "string" ? documentType : "");

  sse(res);

  if (!doc) {
    res.write(
      `data: ${JSON.stringify({ error: "Unknown document type. Please choose a document to draft.", done: true })}\n\n`,
    );
    res.end();
    return;
  }

  // Guard against a mismatched debtor type (e.g. winding-up vs an individual).
  if (doc.debtor !== "any" && debtorType && debtorType !== doc.debtor) {
    res.write(
      `data: ${JSON.stringify({
        error: `${doc.name} applies to a ${doc.debtor} debtor, but you selected "${debtorType}". Choose a document that matches the debtor.`,
        done: true,
      })}\n\n`,
    );
    res.end();
    return;
  }

  const userPrompt = `Draft the following Malaysian post-judgment enforcement court document.

DOCUMENT TO DRAFT: ${doc.name}
GOVERNING BASIS: ${doc.basis}
WHAT TO PRODUCE: ${doc.produces}

DRAFTING INSTRUCTION:
${doc.promptGuidance}

CASE PARTICULARS (use exactly what is given; mark anything missing as [PLACEHOLDER: …]):
- Court / registry: ${court || "[PLACEHOLDER: court and registry]"}
- Suit / cause number: ${suitNo || "[PLACEHOLDER: suit/cause number]"}
- Parties (full title): ${parties || "[PLACEHOLDER: full party title with roles]"}
- Judgment sum: ${judgmentSum || "[PLACEHOLDER: judgment sum]"}
- Date of judgment: ${judgmentDate || "[PLACEHOLDER: date of judgment]"}
- Judgment debtor name: ${debtorName || "[PLACEHOLDER: judgment debtor name]"}
- Judgment debtor address: ${debtorAddress || "[PLACEHOLDER: judgment debtor address]"}
- Debtor type: ${debtorType || "[not stated]"}
- Document-specific particulars: ${particulars || "[none supplied — use clearly marked placeholders]"}
- Additional details: ${additionalDetails || "[none]"}

TASK: Produce the complete document(s) described above, each with its full court title/heading, body, operative wording/prayers and formal ending (date, solicitors' signature block and address-for-service footer). Where more than one instrument is required (e.g. application + affidavit + draft order), separate them with clear headings. End with a short "BEFORE FILING — CHECK / VERIFY" list covering the key prerequisites and traps (e.g. leave to issue execution, service requirements, current statutory thresholds, bona fide dispute risk).`;

  await streamPrompt(
    res,
    DOCUMENT_CONTEXT,
    userPrompt,
    "AI-generated first draft. It is not a filed document. Verify every Order/section, statutory threshold and court fee, confirm the prescribed form is current, and have the conducting solicitor settle and sign the document before filing or service.",
    normalizeProvider(req.body?.provider),
  );
});

export default router;
