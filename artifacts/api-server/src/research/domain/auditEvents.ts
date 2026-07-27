// Phase 12a: Audit event taxonomy and text-leak guard.
//
// AuditAction — canonical event action strings used by all emitters.
// sanitiseForAudit — recursive guard that removes long strings from metadata
//   objects so restricted judgment text can never appear in audit logs.

export const AuditAction = {
  // Upload pipeline
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  CHECKSUM_VERIFIED: "CHECKSUM_VERIFIED",

  // Rights
  RIGHTS_CHANGED: "RIGHTS_CHANGED",

  // Processing pipeline
  PROCESSING_STARTED: "PROCESSING_STARTED",
  OCR_COMPLETED: "OCR_COMPLETED",
  SEGMENTATION_PROPOSED: "SEGMENTATION_PROPOSED",
  BOUNDARY_CHANGED: "BOUNDARY_CHANGED",
  REVIEWER_DECISION: "REVIEWER_DECISION",
  JUDGMENT_VERIFIED: "JUDGMENT_VERIFIED",

  // Access & search
  DOCUMENT_ACCESSED: "DOCUMENT_ACCESSED",
  SEARCH_EXECUTED: "SEARCH_EXECUTED",

  // Workspace
  QUOTATION_CREATED: "QUOTATION_CREATED",

  // Export / print
  EXPORT_REQUESTED: "EXPORT_REQUESTED",
  PRINT_REQUESTED: "PRINT_REQUESTED",

  // AI
  AI_ANALYSIS_REQUESTED: "AI_ANALYSIS_REQUESTED",
  AI_PROVIDER_USED: "AI_PROVIDER_USED",

  // Deletion
  RECORD_DELETED: "RECORD_DELETED",

  // Security
  ACCESS_DENIED: "ACCESS_DENIED",

  // Administration
  ADMIN_ACTION: "ADMIN_ACTION",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// ── Text-leak guard ────────────────────────────────────────────────────────

/** Maximum character length allowed for any string value in audit metadata.
 *  Strings longer than this are replaced with a length-only placeholder.
 *  This prevents restricted judicial text from appearing in audit logs. */
export const AUDIT_MAX_STRING_LENGTH = 500;

/**
 * Recursively sanitise an object for audit logging.
 * Any string value whose length exceeds AUDIT_MAX_STRING_LENGTH is replaced
 * with a placeholder that records the original length but omits the content.
 * Arrays and plain objects are traversed; all other values pass through.
 */
export function sanitiseForAudit<T>(value: T): T {
  if (typeof value === "string") {
    return (
      value.length > AUDIT_MAX_STRING_LENGTH
        ? `[REDACTED:${value.length}chars]`
        : value
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitiseForAudit) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitiseForAudit(v);
    }
    return out as T;
  }
  return value;
}
