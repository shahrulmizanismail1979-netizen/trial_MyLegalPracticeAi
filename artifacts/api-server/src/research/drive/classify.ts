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
