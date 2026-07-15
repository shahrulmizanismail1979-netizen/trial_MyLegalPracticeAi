import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quranicVersesTable, fatwaTable, provisionsTable, caseLawsTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

router.get("/analyzer/all-references", async (_req, res): Promise<void> => {
  const [verses, fatwas, provisions, cases] = await Promise.all([
    db.select({ id: quranicVersesTable.id, surahName: quranicVersesTable.surahName, ayahRange: quranicVersesTable.ayahRange, category: quranicVersesTable.category, relevanceEn: quranicVersesTable.relevanceEn }).from(quranicVersesTable),
    db.select({ id: fatwaTable.id, titleEn: fatwaTable.titleEn, category: fatwaTable.category, year: fatwaTable.year }).from(fatwaTable),
    db.select({ id: provisionsTable.id, titleEn: provisionsTable.titleEn, category: provisionsTable.category }).from(provisionsTable),
    db.select({ id: caseLawsTable.id, caseName: caseLawsTable.caseName, citation: caseLawsTable.citation, category: caseLawsTable.category }).from(caseLawsTable),
  ]);
  res.json({ verses: verses.length, fatwas: fatwas.length, provisions: provisions.length, cases: cases.length });
});

router.post("/analyzer/analyze", async (req, res): Promise<void> => {
  const { situation, language } = req.body;
  if (!situation || typeof situation !== "string") {
    res.status(400).json({ error: "situation is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";

  const [verses, fatwas, provisions, cases] = await Promise.all([
    db.select().from(quranicVersesTable),
    db.select().from(fatwaTable),
    db.select().from(provisionsTable),
    db.select().from(caseLawsTable),
  ]);

  const verseSummary = verses.map(v => `[VID:${v.id}] ${v.surahName} ${v.ayahRange} - Category: ${v.category}. Relevance: ${v.relevanceEn.substring(0, 150)}`).join("\n");
  const fatwaSummary = fatwas.map(f => `[FID:${f.id}] ${f.titleEn} (${f.year}) - Category: ${f.category}. Summary: ${f.summaryEn.substring(0, 150)}`).join("\n");
  const provisionSummary = provisions.map(p => `[PID:${p.id}] ${p.titleEn} - Category: ${p.category}`).join("\n");
  const caseSummary = cases.map(c => `[CID:${c.id}] ${c.caseName} ${c.citation} - Category: ${c.category}. Significance: ${c.significanceEn.substring(0, 150)}`).join("\n");

  const ANALYZER_PROMPT = `You are AI Shariah Legal Analyzer, a specialized tool EXCLUSIVELY for Malaysian Shariah law practitioners. You analyze legal situations and cross-reference them against a comprehensive database of Quranic verses, gazetted fatwas, legal provisions, and case laws.

CRITICAL RESTRICTIONS:
- ONLY analyze from a Shariah/Islamic law perspective. NEVER reference civil law instruments (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- NEVER discuss conventional legal fees, property transfer fees, or conveyancing charges. These belong to civil practice, not Shariah.
- Do NOT fabricate or hallucinate references. ONLY cite items from the database below.

Your task: Given the user's situation/case description, identify and explain the most relevant references from EACH of the four categories below. You MUST return your analysis in valid JSON format.

AVAILABLE DATABASE:

=== QURANIC VERSES ===
${verseSummary}

=== GAZETTED FATWAS ===
${fatwaSummary}

=== LEGAL PROVISIONS ===
${provisionSummary}

=== CASE LAWS ===
${caseSummary}

INSTRUCTIONS:
1. Analyze the user's situation carefully
2. Select the MOST relevant references from each category (3-7 from each)
3. Explain HOW each reference applies to the user's specific situation
4. ${lang === "bm" ? "Respond in Bahasa Melayu" : "Respond in English"}
5. Return ONLY valid JSON in this exact format:

{
  "summary": "Brief overview of the legal analysis of the situation",
  "quranicVerses": [
    {"id": <number>, "reference": "<surah ayah>", "relevance": "<how this verse applies to the situation>"}
  ],
  "fatwas": [
    {"id": <number>, "title": "<fatwa title>", "relevance": "<how this fatwa applies>"}
  ],
  "provisions": [
    {"id": <number>, "title": "<provision title>", "relevance": "<how this provision applies>"}
  ],
  "cases": [
    {"id": <number>, "caseName": "<case name>", "citation": "<citation>", "relevance": "<how this case applies>"}
  ],
  "practicalAdvice": "Practical guidance for the practitioner handling this situation",
  "disclaimer": "Standard legal disclaimer"
}

Return ONLY the JSON object, no markdown, no code fences, no extra text.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: ANALYZER_PROMPT }] },
        { role: "model" as const, parts: [{ text: "Understood. I will analyze the situation and return a structured JSON response with relevant Quranic verses, fatwas, provisions, and case laws." }] },
        { role: "user" as const, parts: [{ text: `Please analyze this situation:\n\n${situation}` }] },
      ],
      config: { maxOutputTokens: 8192, systemInstruction: PRACTICAL_GUIDANCE },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
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
