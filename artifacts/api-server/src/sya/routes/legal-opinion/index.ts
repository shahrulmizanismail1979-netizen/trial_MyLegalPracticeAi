import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { provisionsTable, caseLawsTable, fatwaTable, quranicVersesTable, legislationTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const OPINION_AREAS = [
  { id: "family-law", titleEn: "Islamic Family Law", titleBm: "Undang-Undang Keluarga Islam" },
  { id: "inheritance", titleEn: "Inheritance & Succession (Faraid/Wasiat/Hibah)", titleBm: "Pewarisan & Pusaka (Faraid/Wasiat/Hibah)" },
  { id: "financial", titleEn: "Islamic Finance & Banking", titleBm: "Kewangan & Perbankan Islam" },
  { id: "criminal", titleEn: "Shariah Criminal Law", titleBm: "Undang-Undang Jenayah Syariah" },
  { id: "property", titleEn: "Islamic Property Law (Wakaf/Harta)", titleBm: "Undang-Undang Harta Islam (Wakaf/Harta)" },
  { id: "procedure", titleEn: "Shariah Court Procedure", titleBm: "Tatacara Mahkamah Syariah" },
  { id: "constitutional", titleEn: "Constitutional Islamic Law", titleBm: "Undang-Undang Islam Perlembagaan" },
  { id: "muamalat", titleEn: "Commercial Transactions (Muamalat)", titleBm: "Transaksi Komersial (Muamalat)" },
  { id: "administration", titleEn: "Islamic Administration", titleBm: "Pentadbiran Islam" },
];

router.get("/legal-opinion/areas", (_req, res): void => {
  res.json(OPINION_AREAS);
});

router.post("/legal-opinion/generate", async (req, res): Promise<void> => {
  const { area, scenario, clientPosition, specificQuestions, language } = req.body;
  if (!scenario || typeof scenario !== "string") {
    res.status(400).json({ error: "scenario is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";
  const areaLabel = OPINION_AREAS.find(a => a.id === area);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let provisions: any[], cases: any[], fatwas: any[], verses: any[], legislation: any[];
  try {
    [provisions, cases, fatwas, verses, legislation] = await Promise.all([
      db.select().from(provisionsTable),
      db.select().from(caseLawsTable),
      db.select().from(fatwaTable),
      db.select().from(quranicVersesTable),
      db.select().from(legislationTable),
    ]);
  } catch (dbError) {
    const msg = dbError instanceof Error ? dbError.message : "Database error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
    return;
  }

  const OPINION_PROMPT = `You are a Senior Shariah Legal Counsel (Peguam Kanan Syarie) with 20+ years of experience in Malaysian Shariah courts. You are drafting a formal Legal Opinion (Pendapat Undang-Undang) for a client or instructing solicitor.

CRITICAL RESTRICTIONS:
- You MUST ONLY address Malaysian SHARIAH law matters. NEVER reference civil law instruments (SRO, SPA, Legal Profession Act, civil court fees, stamp duty, conveyancing).
- NEVER calculate or discuss conventional legal fees, property transfer fees, SRO fee scales, or conveyancing charges.
- Do NOT fabricate case citations, section numbers, gazette references, or fee amounts. If unsure, state that verification is needed.
- ONLY cite legislation from the provided database below. Do not invent references.

AREA OF LAW: ${areaLabel ? (lang === "bm" ? areaLabel.titleBm : areaLabel.titleEn) : area || "General Shariah Law"}

CLIENT/SCENARIO:
${scenario}

${clientPosition ? `CLIENT'S POSITION: ${clientPosition}` : ""}
${specificQuestions ? `SPECIFIC QUESTIONS TO ADDRESS:\n${specificQuestions}` : ""}

AVAILABLE LEGAL DATABASE (use ONLY these references):
Provisions: ${provisions.map(p => `${p.titleEn} (${p.legislationEn}) - ${p.category}`).join("; ")}
Cases: ${cases.slice(0, 50).map(c => `${c.caseName} ${c.citation} (${c.year}) - ${c.category}`).join("; ")}
Fatwas: ${fatwas.map(f => `${f.titleEn} (${f.year}) - ${f.state}`).join("; ")}
Legislation: ${legislation.map(l => `${l.titleEn} (${l.actNumber})`).join("; ")}

INSTRUCTIONS:
Generate a COMPLETE, professional legal opinion in the format used by Malaysian Shariah legal practitioners. The opinion must be structured as follows:

1. **HEADING** - "LEGAL OPINION / PENDAPAT UNDANG-UNDANG" with reference number, date, subject
2. **INSTRUCTIONS** - Who instructed and the purpose
3. **FACTUAL BACKGROUND** - Summary of facts as understood
4. **ISSUES FOR DETERMINATION** - Numbered list of legal issues
5. **APPLICABLE LAW** - Relevant Shariah statutes, provisions with section numbers (e.g., s.47 Akta 303), and Quranic/hadith references
6. **ANALYSIS** - Detailed legal analysis of each issue, citing:
   - Specific Shariah provisions (with section numbers)
   - Relevant Shariah case law (with full citations from the database)
   - Gazetted fatwas where applicable
   - Classical fiqh positions (Shafi'i school primarily)
   - Quranic verses and hadith
7. **CONCLUSION & ADVICE** - Clear opinion on each issue
8. **QUALIFICATIONS & DISCLAIMER** - Include: "This AI-generated legal opinion is for Shariah law matters only. All references must be independently verified against primary sources."

${lang === "bm" ? "Write in Bahasa Melayu with proper legal Malay terminology. Use Arabic terms where standard in Shariah practice." : "Write in English with Malay/Arabic legal terms where standard in Malaysian Shariah practice."}

Use markdown formatting. Be thorough, authoritative, and cite specific sections/cases from the database.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: OPINION_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will draft a comprehensive, properly structured legal opinion with full citations." }] },
        { role: "user" as const, parts: [{ text: "Please generate the legal opinion now." }] },
      ],
      config: { maxOutputTokens: 16384, systemInstruction: PRACTICAL_GUIDANCE },
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
