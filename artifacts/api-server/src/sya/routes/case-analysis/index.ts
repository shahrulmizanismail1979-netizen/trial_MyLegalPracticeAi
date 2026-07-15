import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { caseLawsTable, provisionsTable, fatwaTable, quranicVersesTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

router.post("/case-analysis/predict", async (req, res): Promise<void> => {
  const { caseType, facts, parties, reliefSought, language } = req.body;
  if (!facts || typeof facts !== "string") {
    res.status(400).json({ error: "facts is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";

  const [cases, provisions, fatwas, verses] = await Promise.all([
    db.select().from(caseLawsTable),
    db.select().from(provisionsTable),
    db.select().from(fatwaTable),
    db.select().from(quranicVersesTable),
  ]);

  const caseSummary = cases.map(c =>
    `[CID:${c.id}] ${c.caseName} ${c.citation} (${c.year}) - ${c.court}\nCategory: ${c.category}\nFacts: ${c.factsEn.substring(0, 300)}\nDecision: ${c.heldEn.substring(0, 300)}\nSignificance: ${c.significanceEn.substring(0, 200)}`
  ).join("\n\n");

  const ANALYSIS_PROMPT = `You are an expert Malaysian Shariah law case analyst. Based on the facts provided, analyze the case and predict likely outcomes based on precedent cases from the database.

CRITICAL RESTRICTIONS:
- ONLY analyze from a Shariah/Islamic law perspective. NEVER reference civil law instruments (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- Do NOT fabricate or hallucinate case citations, section numbers, or legal references. ONLY cite items from the databases below.
- If the case involves civil/conventional law, clarify that this platform covers Shariah law only.

CASE DATABASE:
${caseSummary}

PROVISIONS DATABASE:
${provisions.map(p => `[PID:${p.id}] ${p.titleEn} - ${p.category}: ${p.principlesEn.substring(0, 200)}`).join("\n")}

USER'S CASE:
Case Type: ${caseType || "Not specified"}
Parties: ${parties || "Not specified"}
Relief Sought: ${reliefSought || "Not specified"}
Facts: ${facts}

INSTRUCTIONS:
1. Identify the most similar precedent cases from the database
2. Analyze the strength of the case based on facts and law
3. Predict likely outcomes with probability ranges
4. Provide strategic recommendations
5. ${lang === "bm" ? "Respond in Bahasa Melayu" : "Respond in English"}
6. Return ONLY valid JSON:

{
  "caseClassification": {
    "primaryArea": "<e.g. Islamic Family Law>",
    "subCategory": "<e.g. Nafkah/Maintenance>",
    "jurisdiction": "<e.g. Shariah High Court>"
  },
  "strengthAssessment": {
    "overall": "<Strong|Moderate|Weak>",
    "score": <1-10>,
    "reasoning": "<why this assessment>"
  },
  "precedentCases": [
    {
      "id": <number>,
      "caseName": "<name>",
      "citation": "<citation>",
      "similarity": "<how similar to current case>",
      "outcome": "<what was decided>",
      "applicability": "<how it applies here>"
    }
  ],
  "predictedOutcomes": [
    {
      "outcome": "<description of possible outcome>",
      "probability": "<High|Medium|Low>",
      "basis": "<legal basis for this prediction>"
    }
  ],
  "applicableProvisions": [
    {
      "id": <number>,
      "title": "<provision title>",
      "relevance": "<how it applies>"
    }
  ],
  "strategicAdvice": {
    "strengths": ["<point 1>", "<point 2>"],
    "weaknesses": ["<point 1>", "<point 2>"],
    "recommendations": ["<recommendation 1>", "<recommendation 2>"],
    "evidenceNeeded": ["<evidence 1>", "<evidence 2>"]
  },
  "estimatedTimeline": "<estimated case duration>",
  "disclaimer": "Standard legal disclaimer"
}

Return ONLY the JSON object.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: ANALYSIS_PROMPT }] },
        { role: "model" as const, parts: [{ text: "I will analyze the case facts against the precedent database and provide a structured prediction." }] },
        { role: "user" as const, parts: [{ text: `Please analyze this case now.` }] },
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
