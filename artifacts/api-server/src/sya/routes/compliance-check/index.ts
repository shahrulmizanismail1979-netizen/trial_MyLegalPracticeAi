import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { provisionsTable, fatwaTable, legislationTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

const TRANSACTION_TYPES = [
  { id: "sale-purchase", titleEn: "Sale & Purchase (Bay')", titleBm: "Jual Beli (Bay')" },
  { id: "lease-rental", titleEn: "Lease / Rental (Ijarah)", titleBm: "Sewaan (Ijarah)" },
  { id: "partnership", titleEn: "Partnership (Musharakah/Mudarabah)", titleBm: "Perkongsian (Musharakah/Mudarabah)" },
  { id: "financing", titleEn: "Islamic Financing (Murabahah/BBA/Tawarruq)", titleBm: "Pembiayaan Islam (Murabahah/BBA/Tawarruq)" },
  { id: "insurance", titleEn: "Takaful (Islamic Insurance)", titleBm: "Takaful" },
  { id: "investment", titleEn: "Investment / Fund Management", titleBm: "Pelaburan / Pengurusan Dana" },
  { id: "wakaf", titleEn: "Wakaf (Endowment)", titleBm: "Wakaf" },
  { id: "hibah", titleEn: "Hibah (Gift Inter Vivos)", titleBm: "Hibah" },
  { id: "wasiat", titleEn: "Wasiat (Islamic Will)", titleBm: "Wasiat" },
  { id: "marriage-contract", titleEn: "Marriage Contract Terms", titleBm: "Syarat Perkahwinan" },
  { id: "business-entity", titleEn: "Business Structure / Entity", titleBm: "Struktur Perniagaan" },
  { id: "sukuk", titleEn: "Sukuk (Islamic Bonds)", titleBm: "Sukuk" },
  { id: "other", titleEn: "Other Transaction", titleBm: "Transaksi Lain" },
];

router.get("/compliance-check/types", (_req, res): void => {
  res.json(TRANSACTION_TYPES);
});

router.post("/compliance-check/analyze", async (req, res): Promise<void> => {
  const { transactionType, description, partiesInvolved, contractTerms, concerns, language } = req.body;
  if (!description || typeof description !== "string") {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";
  const txType = TRANSACTION_TYPES.find(t => t.id === transactionType);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let provisions: any[], fatwas: any[], legislation: any[];
  try {
    [provisions, fatwas, legislation] = await Promise.all([
      db.select().from(provisionsTable),
      db.select().from(fatwaTable),
      db.select().from(legislationTable),
    ]);
  } catch (dbError) {
    const msg = dbError instanceof Error ? dbError.message : "Database error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
    return;
  }

  const COMPLIANCE_PROMPT = `You are a Shariah Compliance Officer and Islamic jurisprudence expert specializing EXCLUSIVELY in Malaysian Islamic/Shariah law. You are conducting a Shariah compliance review of a transaction/arrangement.

CRITICAL RESTRICTIONS:
- ONLY analyze from a Shariah/Islamic law perspective. NEVER reference civil law instruments (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- NEVER discuss conventional legal fees, property transfer fees, or conveyancing charges.
- Do NOT fabricate references. Only cite from the provided database below.

TRANSACTION TYPE: ${txType ? (lang === "bm" ? txType.titleBm : txType.titleEn) : transactionType || "General"}

TRANSACTION DESCRIPTION:
${description}

${partiesInvolved ? `PARTIES INVOLVED: ${partiesInvolved}` : ""}
${contractTerms ? `CONTRACT TERMS / KEY CLAUSES:\n${contractTerms}` : ""}
${concerns ? `SPECIFIC CONCERNS:\n${concerns}` : ""}

AVAILABLE REFERENCES (use ONLY these):
Provisions: ${provisions.map(p => `${p.titleEn} - ${p.category}`).join("; ")}
Fatwas: ${fatwas.map(f => `${f.titleEn} (${f.year}) - ${f.state}`).join("; ")}
Legislation: ${legislation.map(l => `${l.titleEn} (${l.actNumber})`).join("; ")}

INSTRUCTIONS:
Conduct a thorough Shariah compliance analysis. Return ONLY valid JSON:

{
  "overallVerdict": "COMPLIANT|NON-COMPLIANT|CONDITIONALLY_COMPLIANT|REQUIRES_MODIFICATION",
  "complianceScore": <1-10>,
  "summary": "<brief overall assessment>",
  "shariahPrinciples": [
    {
      "principle": "<Islamic legal principle applicable>",
      "arabicTerm": "<Arabic term>",
      "status": "SATISFIED|VIOLATED|PARTIAL|NOT_APPLICABLE",
      "explanation": "<how this principle applies>"
    }
  ],
  "prohibitedElements": [
    {
      "element": "<e.g. Riba, Gharar, Maysir, Jahalah>",
      "arabicTerm": "<Arabic>",
      "detected": true|false,
      "severity": "Critical|Major|Minor|None",
      "details": "<where and how this element appears or is absent>"
    }
  ],
  "contractualIssues": [
    {
      "issue": "<specific contract/arrangement issue>",
      "shariahRuling": "<what Shariah says about this>",
      "recommendation": "<how to resolve>"
    }
  ],
  "applicableFatwas": [
    {
      "title": "<fatwa title>",
      "relevance": "<how it applies>"
    }
  ],
  "applicableLegislation": [
    {
      "title": "<legislation/provision>",
      "section": "<specific section>",
      "relevance": "<how it applies>"
    }
  ],
  "modifications": [
    {
      "issue": "<what needs to change>",
      "currentState": "<current problematic state>",
      "requiredChange": "<what needs to be done>",
      "priority": "Critical|High|Medium|Low"
    }
  ],
  "scholarlyBasis": {
    "primarySchool": "Shafi'i",
    "supportingTexts": ["<kitab references>"],
    "quranicBasis": ["<relevant verses>"],
    "hadithBasis": ["<relevant hadith>"]
  },
  "practicalAdvice": "<actionable next steps for the practitioner>"
}

Return ONLY the JSON object. ${lang === "bm" ? "All text content in Bahasa Melayu with Arabic terms." : "All text content in English with Arabic terms."}`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: COMPLIANCE_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will conduct a thorough Shariah compliance review and return structured JSON." }] },
        { role: "user" as const, parts: [{ text: "Please analyze now." }] },
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
