// Phase 07 — Isolation Gate (ADR 0008).
//
// SUSPECT publisher-editorial sections must never enter:
//   - verified judicial text view
//   - full-text search index
//   - embeddings
//   - AI prompts / AI summaries
//   - classification models
//   - quotation tools
//
// All downstream consumers MUST call applyIsolationGate() before using
// section content for any of the above purposes.

import { logger } from "../../lib/logger";
import type { ClassifiedSection, SectionClassificationType } from "./sectionClassifier";

/** Classifications that may pass through the isolation gate. */
export const ALLOWED_CLASSIFICATIONS: ReadonlySet<SectionClassificationType> = new Set([
  "VERIFIED_JUDICIAL_TEXT",
  "PROBABLE_JUDICIAL_TEXT",
]);

/**
 * Filter sections to only those safe for judicial-text views, indexing,
 * embeddings, AI prompts, and quotation tools.
 *
 * Every excluded section is logged at debug level so the exclusion is
 * auditable without persisting restricted content in logs.
 *
 * Pure function aside from the structured log call.
 */
export function applyIsolationGate(
  sections: ClassifiedSection[],
): ClassifiedSection[] {
  const passed: ClassifiedSection[] = [];
  const excluded: ClassifiedSection[] = [];

  for (const s of sections) {
    if (ALLOWED_CLASSIFICATIONS.has(s.classification)) {
      passed.push(s);
    } else {
      excluded.push(s);
    }
  }

  if (excluded.length > 0) {
    logger.debug(
      {
        excluded: excluded.map((s) => ({
          pageId: s.pageId,
          sectionIndex: s.sectionIndex,
          classification: s.classification,
          confidence: s.confidence,
        })),
      },
      "Isolation gate excluded sections from judicial-text view",
    );
  }

  return passed;
}

/**
 * Returns true if any section was excluded by the gate.
 * Useful for deciding whether to flag a result as having editorial material.
 */
export function gateHasExclusions(sections: ClassifiedSection[]): boolean {
  return sections.some((s) => !ALLOWED_CLASSIFICATIONS.has(s.classification));
}
