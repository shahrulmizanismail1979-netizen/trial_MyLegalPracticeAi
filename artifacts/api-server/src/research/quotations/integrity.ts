// Quotation integrity service (Phase 09).
// Reconstructs the judicial text from a verified judgment, verifies that a
// user-submitted text selection exactly matches the stored text at the stated
// character offsets, and returns the SHA-256 checksum of the full judicial
// text. A mismatch is a hard rejection — no silent fallback.

import { createHash } from "node:crypto";
import {
  db,
  researchVerifiedJudgments,
  researchSourcePages,
  researchPageExtractions,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../domain/types";

export interface SelectionInput {
  judgmentId: number;
  selectedText: string;
  charStart: number;
  charEnd: number;
}

export interface IntegrityOk {
  ok: true;
  sourceChecksum: string;
  /** The full reconstructed judicial text (for provenance storage). */
  judicialText: string;
}

export interface IntegrityFail {
  ok: false;
  code:
    | "JUDGMENT_NOT_FOUND"
    | "OFFSET_OUT_OF_RANGE"
    | "TEXT_MISMATCH"
    | "NO_PAGE_TEXT";
  message: string;
}

export type IntegrityResult = IntegrityOk | IntegrityFail;

/**
 * Deterministically reconstruct the judicial text for a verified judgment.
 *
 * Algorithm:
 *  1. Ordered page IDs come from judgment.pageRefs.
 *  2. For each page, the latest researchPageExtractions row supplies rawText.
 *  3. If approvedJudicialSpans carries spanStartChar/spanEndChar for a page,
 *     those offsets are applied; otherwise the full rawText is used.
 *  4. Page texts are joined with "\n" (the same separator used by the phase-08
 *     textChecksum computation in tests).
 *
 * The result is stable across re-executions as long as the underlying page
 * extractions are not changed — which is the invariant enforced by the
 * append-only correction model.
 */
export async function reconstructJudicialText(
  judgmentId: number,
  dbc: DbClient = db,
): Promise<{ text: string; checksum: string } | null> {
  const [judgment] = await dbc
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));
  if (!judgment) return null;

  const pageIds =
    judgment.pageRefs.length > 0
      ? judgment.pageRefs
      : [
          ...new Set(
            judgment.approvedJudicialSpans
              .map((s) => s.pageId)
              .filter((id): id is number => id != null),
          ),
        ];

  if (pageIds.length === 0) return { text: "", checksum: sha256("") };

  // Load page metadata for ordering
  const sourcePages = await dbc
    .select({ id: researchSourcePages.id, pageNumber: researchSourcePages.pageNumber })
    .from(researchSourcePages)
    .where(inArray(researchSourcePages.id, pageIds));

  // Load latest extraction per page (desc id → first = latest)
  const extractions = await dbc
    .select({
      pageId: researchPageExtractions.pageId,
      rawText: researchPageExtractions.rawText,
    })
    .from(researchPageExtractions)
    .where(inArray(researchPageExtractions.pageId, pageIds))
    .orderBy(desc(researchPageExtractions.id));

  const latestByPage = new Map<number, string>();
  for (const ex of extractions) {
    if (!latestByPage.has(ex.pageId) && ex.rawText != null) {
      latestByPage.set(ex.pageId, ex.rawText);
    }
  }

  // Build span map: pageId → { start, end } | null
  const spanByPage = new Map<number, { start: number; end: number } | null>();
  for (const span of judgment.approvedJudicialSpans) {
    if (span.pageId == null) continue;
    if (
      span.spanStartChar != null &&
      span.spanEndChar != null &&
      !spanByPage.has(span.pageId)
    ) {
      spanByPage.set(span.pageId, {
        start: span.spanStartChar,
        end: span.spanEndChar,
      });
    }
  }

  // Ordered pages
  const orderedPages = sourcePages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const pageTexts: string[] = [];
  for (const page of orderedPages) {
    const raw = latestByPage.get(page.id) ?? "";
    const span = spanByPage.get(page.id);
    if (span) {
      pageTexts.push(raw.slice(span.start, span.end));
    } else {
      pageTexts.push(raw);
    }
  }

  const text = pageTexts.join("\n");
  return { text, checksum: sha256(text) };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Verify that `input.selectedText` exactly matches the reconstructed judicial
 * text of `input.judgmentId` at the byte range [charStart, charEnd).
 *
 * On success, returns the SHA-256 checksum of the full judicial text so it can
 * be stored on the quotation record for future integrity comparisons.
 */
export async function verifyQuotationSelection(
  input: SelectionInput,
  dbc: DbClient = db,
): Promise<IntegrityResult> {
  const result = await reconstructJudicialText(input.judgmentId, dbc);

  if (result === null) {
    return {
      ok: false,
      code: "JUDGMENT_NOT_FOUND",
      message: `Verified judgment ${input.judgmentId} not found`,
    };
  }

  const { text, checksum } = result;

  if (text.length === 0) {
    return {
      ok: false,
      code: "NO_PAGE_TEXT",
      message: `Judgment ${input.judgmentId} has no reconstructed judicial text`,
    };
  }

  if (input.charStart < 0 || input.charEnd > text.length || input.charStart > input.charEnd) {
    return {
      ok: false,
      code: "OFFSET_OUT_OF_RANGE",
      message: `Offsets [${input.charStart}, ${input.charEnd}) are out of range for judicial text of length ${text.length}`,
    };
  }

  const extracted = text.slice(input.charStart, input.charEnd);
  if (extracted !== input.selectedText) {
    return {
      ok: false,
      code: "TEXT_MISMATCH",
      message:
        "The submitted text does not exactly match the stored judicial text at the stated offsets",
    };
  }

  return { ok: true, sourceChecksum: checksum, judicialText: text };
}

/**
 * Compare the current judicial text checksum against a stored checksum.
 * Returns true when the source has changed since the quotation was created.
 */
export async function detectSourceChange(
  judgmentId: number,
  storedChecksum: string,
  dbc: DbClient = db,
): Promise<boolean> {
  const result = await reconstructJudicialText(judgmentId, dbc);
  if (!result) return false; // judgment gone — caller decides how to handle
  return result.checksum !== storedChecksum;
}
