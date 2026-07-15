import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quranicVersesTable, fatwaTable, provisionsTable, caseLawsTable, glossaryTable, legislationTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

router.post("/smart-search", async (req, res): Promise<void> => {
  const { query, language } = req.body;
  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "query is required" });
    return;
  }

  const lang = language === "bm" ? "bm" : "en";

  const [verses, fatwas, provisions, cases, glossary, legislation] = await Promise.all([
    db.select().from(quranicVersesTable),
    db.select().from(fatwaTable),
    db.select().from(provisionsTable),
    db.select().from(caseLawsTable),
    db.select().from(glossaryTable),
    db.select().from(legislationTable),
  ]);

  const dbSummary = `
=== PROVISIONS (${provisions.length}) ===
${provisions.map(p => `[PID:${p.id}] ${p.titleEn} | ${p.titleBm} - Category: ${p.category}. Overview: ${p.overviewEn.substring(0, 200)}`).join("\n")}

=== CASE LAWS (${cases.length}) ===
${cases.map(c => `[CID:${c.id}] ${c.caseName} ${c.citation} (${c.year}) - ${c.category}. Significance: ${c.significanceEn.substring(0, 200)}`).join("\n")}

=== QURANIC VERSES (${verses.length}) ===
${verses.map(v => `[VID:${v.id}] ${v.surahName} ${v.ayahRange} - ${v.category}. ${v.relevanceEn.substring(0, 150)}`).join("\n")}

=== FATWAS (${fatwas.length}) ===
${fatwas.map(f => `[FID:${f.id}] ${f.titleEn} (${f.year}) - ${f.category}. ${f.summaryEn.substring(0, 150)}`).join("\n")}

=== GLOSSARY (${glossary.length}) ===
${glossary.map(g => `[GID:${g.id}] ${g.termArabic} / ${g.termEn} / ${g.termBm} - ${g.category}`).join("\n")}

=== LEGISLATION (${legislation.length}) ===
${legislation.map(l => `[LID:${l.id}] ${l.titleEn} (${l.actNumber}) - ${l.category}`).join("\n")}`;

  const SEARCH_PROMPT = `You are an intelligent legal search engine EXCLUSIVELY for Malaysian Shariah law. The user is searching across ALL modules of the MySyariahAI platform. Your job is to find the MOST RELEVANT results from every category that matches the user's search query.

CRITICAL RESTRICTIONS:
- ONLY return results related to Shariah/Islamic law. NEVER include civil law content (SRO, SPA conveyancing, Legal Profession Act, civil court fees, stamp duty).
- Do NOT fabricate references. ONLY cite items from the database below.
- If the query relates to civil/conventional law topics, respond that this platform covers Shariah law only.

DATABASE:
${dbSummary}

INSTRUCTIONS:
1. Analyze the user's search query carefully
2. Find ALL relevant matches across ALL categories
3. Rank results by relevance (most relevant first)
4. ${lang === "bm" ? "Respond in Bahasa Melayu" : "Respond in English"}
5. Return ONLY valid JSON:

{
  "interpretation": "What the user is searching for and why these results are relevant",
  "results": [
    {
      "type": "provision|case|verse|fatwa|glossary|legislation",
      "id": <number>,
      "title": "<title>",
      "snippet": "<brief relevant excerpt explaining why this matches>",
      "relevanceScore": <1-10>
    }
  ],
  "suggestedQueries": ["<related search suggestion 1>", "<related search suggestion 2>"]
}

Return ONLY the JSON object.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: SEARCH_PROMPT }] },
        { role: "model" as const, parts: [{ text: "Ready to search. I will return structured JSON results ranked by relevance." }] },
        { role: "user" as const, parts: [{ text: `Search query: ${query}` }] },
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
