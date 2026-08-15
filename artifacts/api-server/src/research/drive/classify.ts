import type { DriveFile } from "./driveClient";

export type SourceClassification =
  | "OFFICIAL_JUDGMENT"
  | "COURT_AUTHORISED_COPY"
  | "EXPRESSLY_LICENSED_SOURCE"
  | "COMMERCIAL_PUBLISHER_REPORT"
  | "UNKNOWN_SOURCE";

export type RightsStatus =
  | "RESTRICTED_REFERENCE_ONLY"
  | "NEEDS_OFFICIAL_SOURCE"
  | "RIGHTS_REVIEW_REQUIRED"
  | "APPROVED";

// Signals that strongly suggest a direct court-issued judgment
const OFFICIAL_PATTERNS = [
  /\bJHC\b/,
  /\bFEDERAL\s+COURT\b/i,
  /\bHIGH\s+COURT\b/i,
  /\bCOURT\s+OF\s+APPEAL\b/i,
  /\bMAHKAMAH\s+(TINGGI|RAYUAN|PERSEKUTUAN)\b/i,
  /\bSYARIAH\s+(HIGH|APPEAL)\b/i,
  /\[20\d\d\]\s+\d+\s+MLJ\b/, // cite-style e.g. [2022] 3 MLJ
  /\[20\d\d\]\s+\d+\s+CLJ\b/,
];

// Court-authorised redistribution
const AUTHORISED_PATTERNS = [
  /\bJuristem\b/i,
  /\bCourt\s+Authorised\b/i,
];

// Expressly-licensed publishers (MLJU, MLJ bare reference)
const LICENSED_PATTERNS = [
  /\bMLJU\b/i,
  /\bMLJ\b(?!\s*(?:No|Vol|Volume))/i, // avoid "MLJ No.123"
];

// Commercial publishers with restricted rights
const PUBLISHER_PATTERNS = [
  /\bCLJ\b/i,
  /\bLexis\b/i,
  /\bNexis\b/i,
  /\bAMR\b/i,
  /\bILR\b/i,
  /\bCurrent\s+Law\b/i,
];

export function classifyDriveFile(
  file: DriveFile,
  folderPath?: string,
): SourceClassification {
  const haystack = `${file.name} ${folderPath ?? ""}`;
  if (OFFICIAL_PATTERNS.some((p) => p.test(haystack))) return "OFFICIAL_JUDGMENT";
  if (AUTHORISED_PATTERNS.some((p) => p.test(haystack))) return "COURT_AUTHORISED_COPY";
  if (LICENSED_PATTERNS.some((p) => p.test(haystack))) return "EXPRESSLY_LICENSED_SOURCE";
  if (PUBLISHER_PATTERNS.some((p) => p.test(haystack))) return "COMMERCIAL_PUBLISHER_REPORT";
  return "UNKNOWN_SOURCE";
}

// ── Practice-area mapping ─────────────────────────────────────────────────────
// The Drive folder structure encodes practice area in the top-level
// contributor folder, e.g. "Civil Procedure (Caroline)" or "Banking (Fazly)".
// Portals filter case-law search by these canonical values.

export const PRACTICE_AREAS = [
  "civil_procedure",
  "corporate",
  "accident",
  "banking",
  "criminal",
  "conveyancing",
  "syariah",
] as const;
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

const PRACTICE_AREA_PATTERNS: Array<[RegExp, PracticeArea]> = [
  [/civil/i, "civil_procedure"],
  [/corporate|company/i, "corporate"],
  [/accident|personal\s+injur/i, "accident"],
  [/banking|bank/i, "banking"],
  [/criminal|crime/i, "criminal"],
  [/convey/i, "conveyancing"],
  [/syariah|shariah/i, "syariah"],
];

/**
 * Map a Drive contributor folder name (top-level folder under the root) to a
 * canonical practice area. Returns null when no known area matches.
 */
export function practiceAreaForContributorFolder(
  contributorFolder: string | null | undefined,
): PracticeArea | null {
  if (!contributorFolder) return null;
  for (const [pattern, area] of PRACTICE_AREA_PATTERNS) {
    if (pattern.test(contributorFolder)) return area;
  }
  return null;
}

export function rightsStatusForClassification(
  classification: SourceClassification,
): RightsStatus {
  switch (classification) {
    case "OFFICIAL_JUDGMENT":
      return "APPROVED";
    case "COURT_AUTHORISED_COPY":
      return "RIGHTS_REVIEW_REQUIRED";
    case "EXPRESSLY_LICENSED_SOURCE":
      return "RIGHTS_REVIEW_REQUIRED";
    case "COMMERCIAL_PUBLISHER_REPORT":
      return "RESTRICTED_REFERENCE_ONLY";
    case "UNKNOWN_SOURCE":
      return "RIGHTS_REVIEW_REQUIRED";
  }
}
