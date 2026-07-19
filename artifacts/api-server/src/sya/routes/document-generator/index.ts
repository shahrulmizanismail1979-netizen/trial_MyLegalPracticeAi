import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { provisionsTable, caseLawsTable, legislationTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const DOCUMENT_TYPES = [
  // Civil litigation — family pleadings & applications
  { id: "nafkah-claim", titleEn: "Nafkah (Maintenance) Claim Statement", titleBm: "Pernyataan Tuntutan Nafkah", category: "pleading", gates: "civil" },
  { id: "fasakh-application", titleEn: "Fasakh Application", titleBm: "Permohonan Fasakh", category: "pleading", gates: "civil" },
  { id: "hadhanah-application", titleEn: "Hadhanah (Custody) Application", titleBm: "Permohonan Hadhanah", category: "pleading", gates: "civil" },
  { id: "mutah-claim", titleEn: "Mut'ah Claim Statement", titleBm: "Pernyataan Tuntutan Mut'ah", category: "pleading", gates: "civil" },
  { id: "harta-sepencarian", titleEn: "Harta Sepencarian Claim", titleBm: "Tuntutan Harta Sepencarian", category: "pleading", gates: "civil" },
  { id: "faraid-application", titleEn: "Faraid Certificate Application", titleBm: "Permohonan Sijil Faraid", category: "pleading", gates: "civil,advisory" },
  { id: "statement-of-defence", titleEn: "Statement of Defence (Pembelaan)", titleBm: "Pembelaan", category: "pleading", gates: "civil" },
  { id: "reply-pleading", titleEn: "Reply to Defence (Jawapan)", titleBm: "Jawapan kepada Pembelaan", category: "pleading", gates: "civil" },
  { id: "interim-maintenance", titleEn: "Application for Interim Maintenance", titleBm: "Permohonan Nafkah Sementara", category: "pleading", gates: "civil" },
  { id: "variation-order", titleEn: "Application to Vary Court Order", titleBm: "Permohonan Pengubahan Perintah", category: "pleading", gates: "civil" },
  { id: "enforcement-application", titleEn: "Application to Enforce Court Order", titleBm: "Permohonan Penguatkuasaan Perintah", category: "pleading", gates: "civil" },
  // Affidavits (cross-gate)
  { id: "affidavit-support", titleEn: "Supporting Affidavit", titleBm: "Afidavit Sokongan", category: "affidavit", gates: "civil,criminal,advisory" },
  { id: "affidavit-means", titleEn: "Affidavit of Means", titleBm: "Afidavit Kemampuan", category: "affidavit", gates: "civil" },
  // Letters
  { id: "demand-letter-nafkah", titleEn: "Demand Letter - Nafkah Arrears", titleBm: "Surat Tuntutan - Tunggakan Nafkah", category: "letter", gates: "civil" },
  { id: "demand-letter-mutah", titleEn: "Demand Letter - Mut'ah", titleBm: "Surat Tuntutan - Mut'ah", category: "letter", gates: "civil" },
  // Settlement
  { id: "sulh-proposal", titleEn: "Sulh Settlement Proposal", titleBm: "Cadangan Penyelesaian Sulh", category: "settlement", gates: "civil,advisory" },
  { id: "sulh-agreement", titleEn: "Sulh Settlement Agreement", titleBm: "Perjanjian Penyelesaian Sulh", category: "settlement", gates: "civil,advisory" },
  // Submissions & appeals
  { id: "written-submission", titleEn: "Written Submission (Hujah Bertulis)", titleBm: "Hujah Bertulis", category: "submission", gates: "civil,criminal" },
  { id: "notice-of-appeal", titleEn: "Notice of Appeal", titleBm: "Notis Rayuan", category: "appeal", gates: "civil,criminal" },
  // Syariah criminal litigation
  { id: "plea-mitigation", titleEn: "Plea in Mitigation", titleBm: "Rayuan Mitigasi", category: "criminal", gates: "criminal" },
  { id: "bail-application", titleEn: "Bail Application", titleBm: "Permohonan Jaminan", category: "criminal", gates: "criminal" },
  { id: "representation-letter", titleEn: "Representation to Chief Syarie Prosecutor", titleBm: "Surat Representasi kepada Ketua Pendakwa Syarie", category: "criminal", gates: "criminal" },
  // Advisory & consultancy — Islamic legal instruments
  { id: "wasiat-draft", titleEn: "Wasiat (Islamic Will) Draft", titleBm: "Draf Wasiat", category: "instrument", gates: "advisory" },
  { id: "hibah-deed", titleEn: "Hibah Deed", titleBm: "Surat Ikatan Hibah", category: "instrument", gates: "advisory" },
  { id: "wakalah-poa", titleEn: "Wakalah (Power of Attorney)", titleBm: "Surat Kuasa Wakil (Wakalah)", category: "instrument", gates: "advisory" },
  { id: "faraid-distribution", titleEn: "Faraid Distribution Statement", titleBm: "Penyata Pembahagian Faraid", category: "instrument", gates: "civil,advisory" },
];

router.get("/document-generator/types", (_req, res): void => {
  res.json(DOCUMENT_TYPES);
});

router.post("/document-generator/generate", async (req, res): Promise<void> => {
  const { documentType, language, details, gate } = req.body;
  if (!documentType || !details || typeof details !== "object") {
    res.status(400).json({ error: "documentType and details are required" });
    return;
  }

  const docType = DOCUMENT_TYPES.find(d => d.id === documentType);
  if (!docType) {
    res.status(400).json({ error: "Invalid document type" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";
  const isInstrument = docType.category === "instrument";
  const langInstruction = lang === "bm"
    ? "Generate the document in Bahasa Melayu with proper legal Malay terminology"
    : "Generate in English with Malay legal terms where standard";

  const courtInstructions = `INSTRUCTIONS:
1. Generate a COMPLETE, professional Shariah court legal document
2. Use proper Malaysian Shariah court formatting
3. Include proper legal headings, numbering, and structure
4. Reference specific sections of applicable Shariah Acts (e.g., s.59 Akta 303) from the database
5. Cite relevant Shariah case law from the database where appropriate
6. ${langInstruction}
7. Include all standard parts: heading, parties, grounds, prayer/relief, verification
8. Use formal court document language
9. Format with proper paragraph numbering (1, 2, 3... or roman numerals)`;

  const instrumentInstructions = `INSTRUCTIONS:
1. Generate a COMPLETE, professional Islamic legal instrument (private document, NOT a court filing)
2. Do NOT use court headings, case numbers, or "prayer/relief" sections
3. Open with a clear title and a declaration clause (e.g., the testator/donor/principal's full identity)
4. Satisfy the Shariah rukun & syarat for this instrument (e.g., ijab & qabul and qabd for hibah; the 1/3 limit and non-heir rule for wasiat; defined scope for wakalah)
5. Reference applicable Shariah Acts/state enactment provisions from the database where relevant
6. ${langInstruction}
7. Include execution formalities: signatures of the parties, two witnesses (saksi), and date
8. Use formal but plain instrument language; add a short note that the instrument should be reviewed and properly attested
9. Format with clear clause numbering`;

  const [provisions, cases, legislation] = await Promise.all([
    db.select().from(provisionsTable),
    db.select().from(caseLawsTable),
    db.select().from(legislationTable),
  ]);

  const GEN_PROMPT = `You are an expert Malaysian Shariah legal document drafter. Generate a professional, court-ready Shariah legal document or Islamic legal instrument based on the template type and details provided.

CRITICAL RESTRICTIONS:
- ONLY draft Shariah court documents (pleadings, affidavits, submissions, appeals, criminal mitigation/bail) and Islamic legal instruments (wasiat, hibah, wakalah, faraid distribution). NEVER include civil law content (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- For Islamic legal instruments (wasiat, hibah, wakalah), follow Shariah requirements (rukun & syarat) and Malaysian state enactment practice; these are private instruments, not court filings, so omit court headings/case numbers.
- Do NOT fabricate case citations or section numbers. ONLY reference items from the database below.

DOCUMENT TYPE: ${docType.titleEn} / ${docType.titleBm}
CATEGORY: ${docType.category}
${(() => {
  const scopes: Record<string, string> = {
    civil: "PRACTICE AREA SCOPE: Syariah CIVIL litigation (Islamic family law — divorce, nafkah, hadhanah, mut'ah, harta sepencarian, inheritance disputes). Do NOT mix in Syariah criminal content or advisory instruments unless the document type itself requires it.",
    criminal: "PRACTICE AREA SCOPE: Syariah CRIMINAL litigation (Syariah criminal offences, charges, bail, mitigation, criminal appeals — Syariah Criminal Procedure and state Syariah criminal offence enactments). Do NOT mix in civil family-law content (divorce, nafkah, custody) or advisory instruments (wasiat, hibah, wakaf).",
    advisory: "PRACTICE AREA SCOPE: Syariah ADVISORY & consultancy (wasiat, hibah, wakaf, faraid, legal opinions, Shariah compliance). Do NOT mix in civil litigation content (divorce, nafkah) or Syariah criminal content unless the document type itself requires it.",
  };
  return typeof gate === "string" && scopes[gate] ? scopes[gate] : "";
})()}

AVAILABLE LEGAL REFERENCES (use ONLY these):
Provisions: ${provisions.map(p => `${p.titleEn} - ${p.legislationEn}`).join("; ")}
Key Cases: ${cases.slice(0, 30).map(c => `${c.caseName} ${c.citation}`).join("; ")}
Legislation: ${legislation.map(l => `${l.titleEn} (${l.actNumber})`).join("; ")}

CASE DETAILS PROVIDED BY USER:
${Object.entries(details).map(([k, v]) => `${k}: ${v}`).join("\n")}

${isInstrument ? instrumentInstructions : courtInstructions}

Generate the complete document now. Use markdown formatting for structure (# for headings, ** for emphasis, numbered lists).`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: GEN_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will generate a complete, professional Shariah court document with proper legal formatting and references." }] },
        { role: "user" as const, parts: [{ text: "Please generate the document now." }] },
      ],
      config: { maxOutputTokens: 8192, systemInstruction: PRACTICAL_GUIDANCE },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

export default router;
