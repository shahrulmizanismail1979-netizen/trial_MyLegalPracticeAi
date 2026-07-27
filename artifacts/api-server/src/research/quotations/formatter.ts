// Citation formatter (Phase 09).
// Pure function — no DB, no I/O.
// Accepts a quotation record, a metadata map, and a style name, and returns a
// formatted citation string. Never invents metadata values: missing fields
// produce explicit placeholder text. Reporter citations are only emitted when
// the caller signals they are verified.

import type { MetadataFieldName } from "@workspace/db";

export const CITATION_STYLES = [
  "neutral-citation-first",
  "oscola",
  "malaysian",
  "bluebook",
  "academic-footnote",
  "bibliography",
  // "exact" is intentionally NOT listed here: it is a special mode that
  // returns the verbatim selected text and is refused for altered quotations.
  "exact",
] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

export interface QuotationForCitation {
  selectedText: string;
  caseName: string | null;
  citation: string | null;    // neutral citation (denormalized)
  court: string | null;
  judge: string | null;
  decisionDate: string | null;
  paragraphIdentifier: string | null;
  kind: "exact" | "altered";
}

/**
 * Build a metadata value map for the formatter from raw metadata rows.
 * The caller is responsible for passing the "best" value per field (e.g. the
 * latest approved row).
 */
export type MetadataMap = Partial<Record<MetadataFieldName, string | string[] | null>>;

const REPORTER_NOT_VERIFIED = "REPORTER CITATION NOT VERIFIED";

/**
 * Resolve a scalar string value from the metadata map for a given field.
 * Returns null when absent or null.
 */
function get(map: MetadataMap, field: MetadataFieldName): string | null {
  const v = map[field];
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

/**
 * Format a citation in the requested style.
 *
 * @param quotation  The quotation record (or a minimal projection of it).
 * @param style      One of the six citation styles (or "exact" for verbatim).
 * @param metadata   Metadata map keyed by MetadataFieldName.
 * @param reportVerified  Whether the reportCitation field has been verified by
 *                   an authorised reviewer (rights_reviewer or above). When
 *                   false, any style that requires a reporter citation will
 *                   render REPORTER_NOT_VERIFIED instead.
 */
export function formatCitation(
  quotation: QuotationForCitation,
  style: CitationStyle,
  metadata: MetadataMap,
  reportVerified: boolean,
): string {
  // "exact" mode: return verbatim selected text.
  // The route layer refuses this for altered quotations; this function
  // executes it regardless so it can also be called from tests directly.
  if (style === "exact") {
    return quotation.selectedText;
  }

  // Resolve common fields.
  const caseName =
    get(metadata, "caseName") ?? quotation.caseName ?? "[Case Name Unknown]";
  const neutralCitation =
    get(metadata, "neutralCitation") ?? quotation.citation ?? null;
  const reportCitation = reportVerified
    ? get(metadata, "reportCitation")
    : null;
  const court = get(metadata, "court") ?? quotation.court ?? null;
  const judges = get(metadata, "judges") ?? quotation.judge ?? null;
  const decisionDate =
    get(metadata, "decisionDate") ?? quotation.decisionDate ?? null;
  const paraId = quotation.paragraphIdentifier;

  // Para reference suffix (e.g. " at [5]") — used in footnote/bibliography.
  const paraRef = paraId ? ` at ${paraId}` : "";

  switch (style) {
    // ── Neutral-citation-first ────────────────────────────────────────────
    // Format: CaseName [neutralCitation] (Court, Date)
    case "neutral-citation-first": {
      const nc = neutralCitation ?? REPORTER_NOT_VERIFIED;
      const parts = [court, decisionDate].filter(Boolean).join(", ");
      return `${caseName} ${nc}${parts ? ` (${parts})` : ""}`;
    }

    // ── OSCOLA ────────────────────────────────────────────────────────────
    // Format: CaseName [neutralCitation] <ReporterCitation>
    // OSCOLA prefers neutral citation; reporter citation follows in angle
    // brackets if present and verified. Unverified reporter → warning text.
    case "oscola": {
      const nc = neutralCitation ?? "";
      const reporter = reportVerified
        ? reportCitation
          ? ` <${reportCitation}>`
          : ""
        : ` <${REPORTER_NOT_VERIFIED}>`;
      const dateStr = decisionDate ? ` (${decisionDate})` : "";
      return `${caseName}${nc ? ` ${nc}` : ""}${reporter}${dateStr}`;
    }

    // ── Malaysian legal format ─────────────────────────────────────────────
    // Format: CaseName [neutralCitation]; ReporterCitation (if verified)
    //         Court; Date; Judge
    case "malaysian": {
      const nc = neutralCitation ?? REPORTER_NOT_VERIFIED;
      const reporter = reportVerified && reportCitation
        ? `; ${reportCitation}`
        : !reportVerified
        ? `; ${REPORTER_NOT_VERIFIED}`
        : "";
      const courtPart = court ? `${court}` : "";
      const datePart = decisionDate ? ` (${decisionDate})` : "";
      const judgePart = judges ? `; ${judges}` : "";
      const meta = [courtPart + datePart + judgePart].filter(Boolean).join("");
      return `${caseName} ${nc}${reporter}${meta ? ` — ${meta}` : ""}`;
    }

    // ── Bluebook ──────────────────────────────────────────────────────────
    // Format: CaseName, ReporterCitation (Court Year).
    // Bluebook requires a reporter citation. If not verified, the reporter
    // segment is replaced by the warning string.
    case "bluebook": {
      const reportPart =
        reportVerified && reportCitation
          ? reportCitation
          : REPORTER_NOT_VERIFIED;
      const courtYear = [court, decisionDate]
        .filter(Boolean)
        .join(" ");
      return `${caseName}, ${reportPart}${courtYear ? ` (${courtYear})` : ""}`;
    }

    // ── Plain academic footnote ───────────────────────────────────────────
    // Format: CaseName (Court, Date) [neutralCitation] paraRef.
    case "academic-footnote": {
      const nc = neutralCitation ? ` [${neutralCitation}]` : "";
      const meta = [court, decisionDate].filter(Boolean).join(", ");
      return `${caseName}${meta ? ` (${meta})` : ""}${nc}${paraRef}.`;
    }

    // ── Bibliography entry ────────────────────────────────────────────────
    // Format: CaseName. NeutralCitation. Court. Date.
    case "bibliography": {
      const nc = neutralCitation ? `${neutralCitation}. ` : "";
      const courtPart = court ? `${court}. ` : "";
      const datePart = decisionDate ? `${decisionDate}.` : "";
      return `${caseName}. ${nc}${courtPart}${datePart}`.trimEnd();
    }

    default: {
      // Exhaustive — TypeScript narrows the union so this should never run.
      const _: never = style;
      return `[Unknown citation style: ${_}]`;
    }
  }
}

/**
 * Render the visually-altered form of a quotation's selected text.
 * Alterations are applied in position order; positions must not overlap.
 */
export interface AlterationForRender {
  kind: "omission" | "insertion" | "alteration";
  positionStart: number;
  positionEnd: number;
  replacementText: string;
}

export function renderAlteredText(
  selectedText: string,
  alterations: AlterationForRender[],
): string {
  if (alterations.length === 0) return selectedText;

  // Sort by positionStart ascending
  const sorted = [...alterations].sort(
    (a, b) => a.positionStart - b.positionStart,
  );

  let result = "";
  let cursor = 0;

  for (const alt of sorted) {
    // Append unchanged text before this alteration
    if (alt.positionStart > cursor) {
      result += selectedText.slice(cursor, alt.positionStart);
    }
    switch (alt.kind) {
      case "omission":
        result += "[…]";
        break;
      case "insertion":
        result += `[${alt.replacementText}]`;
        break;
      case "alteration":
        result += `[${alt.replacementText}]`;
        break;
    }
    cursor = alt.positionEnd;
  }

  // Remaining text after last alteration
  if (cursor < selectedText.length) {
    result += selectedText.slice(cursor);
  }

  return result;
}
