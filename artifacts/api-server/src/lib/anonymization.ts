import { and, eq, ne } from "drizzle-orm";
import { db, contributionsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

const SYSTEM_PROMPT = `You are a legal document anonymiser for Malaysian court documents (cause papers, judgments, affidavits, submissions, agreements).

Rewrite the document so that no real personal details of the parties, clients, witnesses, or other private individuals remain, while keeping the document legally useful:

1. Replace every party, client, witness, and private individual's name with a realistic but fictitious Malaysian name (Malay, Chinese, or Indian as appropriate). Use the SAME fake name consistently for the same person throughout the document. Do the same for private company names (use fictitious company names ending in Sdn Bhd / Bhd as appropriate).
2. Remove or replace ALL other personal identifiers with realistic fake values: NRIC / IC numbers, passport numbers, addresses, phone numbers, email addresses, bank account numbers, vehicle registration numbers, company registration numbers, land title / lot numbers, policy numbers.
3. Replace case numbers of the present case with a fictitious case number in the same format.
4. KEEP unchanged: names of judges, court names, names of cited/reported precedent cases and their citations, statutes, legal principles, dates (unless they identify a person, e.g. date of birth — replace those), amounts of money, and the legal substance and structure of the document.
5. Do not summarise, shorten, or add commentary. Output ONLY the anonymised document text, preserving the original formatting as closely as possible.`;

// Keep well within model context; long documents are anonymised in chunks.
const CHUNK_CHARS = 24_000;

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= CHUNK_CHARS) {
      chunks.push(rest);
      break;
    }
    // Prefer to split on a paragraph boundary near the limit.
    let cut = rest.lastIndexOf("\n\n", CHUNK_CHARS);
    if (cut < CHUNK_CHARS / 2) cut = rest.lastIndexOf("\n", CHUNK_CHARS);
    if (cut < CHUNK_CHARS / 2) cut = CHUNK_CHARS;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return chunks;
}

type ChunkResult = {
  anonymizedText: string;
  replacements: { original: string; fake: string }[];
};

/**
 * Parse and validate the model's JSON response. Throws on any deviation —
 * a malformed response must NEVER be stored, because it could still contain
 * original identifiers.
 */
function parseChunkResult(raw: string): ChunkResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Anonymiser returned non-JSON output");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Anonymiser returned unexpected JSON shape");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.anonymizedText !== "string" || !obj.anonymizedText.trim()) {
    throw new Error("Anonymiser returned no anonymizedText");
  }
  const rawReplacements = Array.isArray(obj.replacements) ? obj.replacements : [];
  const replacements: ChunkResult["replacements"] = [];
  for (const entry of rawReplacements) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).original === "string" &&
      typeof (entry as Record<string, unknown>).fake === "string"
    ) {
      replacements.push({
        original: (entry as { original: string }).original,
        fake: (entry as { fake: string }).fake,
      });
    }
  }
  return { anonymizedText: obj.anonymizedText, replacements };
}

/** Anonymise raw document text. Throws on failure. */
export async function anonymizeText(text: string): Promise<string> {
  const chunks = splitIntoChunks(text);
  const results: string[] = [];
  // A shared mapping keeps fake names consistent across chunks. It never
  // enters the stored output — only the anonymizedText field is persisted.
  const mapping = new Map<string, string>();
  for (const chunk of chunks) {
    const mappingNote = [...mapping.entries()]
      .map(([original, fake]) => `${original} => ${fake}`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(mappingNote
          ? [
              {
                role: "system" as const,
                content: `Earlier parts of this document already used these replacements — reuse them exactly:\n${mappingNote}`,
              },
            ]
          : []),
        {
          role: "user",
          content: `Anonymise this document text and respond with STRICT JSON only, in this exact shape:\n{"anonymizedText": "<the full anonymised document text>", "replacements": [{"original": "<original value>", "fake": "<replacement used>"}]}\n\nDocument text:\n\n${chunk}`,
        },
      ],
    });
    const output = response.choices[0]?.message?.content ?? "";
    if (!output.trim()) throw new Error("Anonymiser returned empty output");
    const result = parseChunkResult(output);
    for (const { original, fake } of result.replacements) {
      if (original.trim().length >= 3 && !mapping.has(original)) {
        mapping.set(original, fake);
      }
    }
    results.push(result.anonymizedText.trimEnd());
  }
  const combined = results.join("\n").trim();
  if (!combined) throw new Error("Anonymiser produced no text");

  // Leak guard: none of the original identifiers the model says it replaced
  // may appear in the final output. Hard-fail rather than store a leak.
  const lower = combined.toLowerCase();
  for (const original of mapping.keys()) {
    const needle = original.trim().toLowerCase();
    if (needle.length >= 4 && lower.includes(needle)) {
      throw new Error("Anonymised output still contains an original identifier");
    }
  }
  return combined;
}

/**
 * Anonymise a contribution's extracted text and persist the result.
 * Safe to call repeatedly; a "done" contribution is left untouched.
 */
export async function anonymizeContribution(contributionId: number): Promise<void> {
  const [row] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.id, contributionId));
  if (!row) return;
  if (row.anonymizationStatus === "done") return;
  if (!row.extractedText || row.extractionStatus !== "extracted") {
    await db
      .update(contributionsTable)
      .set({ anonymizationStatus: "skipped" })
      .where(
        and(
          eq(contributionsTable.id, contributionId),
          ne(contributionsTable.anonymizationStatus, "done"),
        ),
      );
    return;
  }
  try {
    const anonymized = await anonymizeText(row.extractedText);
    await db
      .update(contributionsTable)
      .set({ anonymizedText: anonymized, anonymizationStatus: "done" })
      .where(eq(contributionsTable.id, contributionId));
    logger.info({ contributionId }, "Contribution anonymised");
  } catch (err) {
    // Race-safe: never downgrade a "done" result written by a concurrent run.
    await db
      .update(contributionsTable)
      .set({ anonymizationStatus: "failed" })
      .where(
        and(
          eq(contributionsTable.id, contributionId),
          ne(contributionsTable.anonymizationStatus, "done"),
        ),
      );
    logger.error({ err, contributionId }, "Contribution anonymisation failed");
  }
}
