import {
  RESEARCH_ROLES,
  RIGHTS_STATUSES,
  type ContainerState,
  type ResearchRole,
  type RightsStatus,
} from "@workspace/db";

// The single access-decision layer (Phase 02, ADR 0003). Pure and
// deny-by-default: every route and job processor must gate through
// decideAccess() — nothing else decides access. A permissive role can never
// override a restrictive rights status; the rights caps are applied first
// and roles can only narrow further. The full decision matrix is pinned by
// fixtures/golden/access-decision-matrix.json.

export const ACCESS_ACTIONS = [
  "view",
  "search",
  "process",
  "analyse",
  "external_ai",
  "export",
  "share",
  "print",
] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/** Per-record restrictions taken from the latest formal rights record. */
export interface AccessRestrictions {
  /** Rights record explicitly permits student access. */
  studentAccessPermitted?: boolean | null;
  /** Rights record explicitly grants export approval. */
  exportPermitted?: boolean | null;
  /** Rights record explicitly permits printing. */
  printingPermitted?: boolean | null;
  /** Rights record explicitly permits external processing. */
  externalProcessingPermitted?: boolean | null;
  /** Latest rights record has expired (past expiry_date). */
  expired?: boolean | null;
}

export interface AccessQuery {
  /** null = unauthenticated. */
  role: ResearchRole | null;
  rightsStatus: RightsStatus;
  processingState: ContainerState;
  action: AccessAction;
  restrictions?: AccessRestrictions;
}

export interface AccessDecision {
  allowed: boolean;
  /** Stable machine-readable reason code (audit-friendly). */
  reason: string;
}

// Roles allowed to see quarantined / restrictively-classified material.
const RIGHTS_ROLES: readonly ResearchRole[] = [
  "owner",
  "administrator",
  "rights_reviewer",
];

// Rights-status capability caps. `view: "rights_roles"` means metadata/view
// only for rights roles (plus legal_reviewer where flagged). These caps are
// absolute: no role may exceed them.
type ViewCap = "all" | "rights_roles" | "none";
interface StatusCaps {
  view: ViewCap;
  legalReviewerMayView?: boolean;
  search: boolean;
  process: boolean;
  analyse: boolean;
  externalAi: boolean;
  export: boolean;
  share: boolean;
  print: boolean;
  studentAccess: boolean;
}

const RESTRICTIVE_CAPS: StatusCaps = {
  view: "rights_roles",
  search: false,
  process: false,
  analyse: false,
  externalAi: false,
  export: false,
  share: false,
  print: false,
  studentAccess: false,
};

const STATUS_CAPS: Record<RightsStatus, StatusCaps> = {
  UNREVIEWED: RESTRICTIVE_CAPS,
  COMMERCIAL_SOURCE_REVIEW_REQUIRED: RESTRICTIVE_CAPS,
  PRIVATE_PROCESSING_APPROVED: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: false,
    export: false,
    share: false,
    print: true,
    studentAccess: true,
  },
  OFFICIAL_COURT_SOURCE: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: true,
    export: true,
    share: true,
    print: true,
    studentAccess: true,
  },
  PUBLIC_OR_OPEN_LICENCE_SOURCE: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: true,
    export: true,
    share: true,
    print: true,
    studentAccess: true,
  },
  USER_OWNED_OR_AUTHORISED: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: false,
    export: true,
    share: false,
    print: true,
    studentAccess: true,
  },
  DISPLAY_RESTRICTED: {
    view: "none",
    search: true,
    process: true,
    analyse: true,
    externalAi: false,
    export: false,
    share: false,
    print: false,
    studentAccess: false,
  },
  ANALYSIS_RESTRICTED: {
    view: "all",
    search: false,
    process: true,
    analyse: false,
    externalAi: false,
    export: false,
    share: false,
    print: true,
    studentAccess: true,
  },
  EXTERNAL_AI_RESTRICTED: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: false,
    export: true,
    share: false,
    print: true,
    studentAccess: true,
  },
  EXPORT_RESTRICTED: {
    view: "all",
    search: true,
    process: true,
    analyse: true,
    externalAi: false,
    export: false,
    share: false,
    print: false,
    studentAccess: true,
  },
  DO_NOT_PROCESS: RESTRICTIVE_CAPS,
  DO_NOT_RETAIN: RESTRICTIVE_CAPS,
  MANUAL_LEGAL_REVIEW_REQUIRED: {
    ...RESTRICTIVE_CAPS,
    legalReviewerMayView: true,
  },
};

// Role capability grants (may only narrow the rights caps, never widen).
const ROLE_ACTIONS: Record<ResearchRole, readonly AccessAction[]> = {
  owner: ACCESS_ACTIONS,
  administrator: ACCESS_ACTIONS,
  rights_reviewer: ACCESS_ACTIONS,
  legal_reviewer: ["view", "search", "analyse", "print", "export"],
  researcher: ["view", "search", "analyse", "print"],
  lecturer: ["view", "search", "print"],
  student: ["view", "search"],
  guest: ["view"],
};

// Processing states in which the container is under a safety hold: only
// rights roles may view; every other action is denied for everyone.
const HOLD_STATES: readonly ContainerState[] = [
  "QUARANTINED",
  "PROCESSING_BLOCKED",
  "DELETION_PENDING",
];

function deny(reason: string): AccessDecision {
  return { allowed: false, reason };
}

/**
 * The single access decision. Deny-by-default; evaluation order:
 * authentication → deleted → safety hold → rights caps → record-level
 * restrictions → role grant. Rights status always caps role permissions.
 */
export function decideAccess(query: AccessQuery): AccessDecision {
  const { role, rightsStatus, processingState, action } = query;
  const restrictions = query.restrictions ?? {};

  if (!role) return deny("UNAUTHENTICATED");
  if (!ACCESS_ACTIONS.includes(action)) return deny("UNKNOWN_ACTION");
  const caps = STATUS_CAPS[rightsStatus];
  if (!caps) return deny("UNKNOWN_RIGHTS_STATUS");
  if (!ROLE_ACTIONS[role]) return deny("UNKNOWN_ROLE");

  // Deleted containers are gone for everyone.
  if (processingState === "DELETED") return deny("CONTAINER_DELETED");

  const isRightsRole = RIGHTS_ROLES.includes(role);

  // Safety holds: quarantine / processing block / pending deletion.
  if (HOLD_STATES.includes(processingState)) {
    if (action === "view" && isRightsRole) {
      return { allowed: true, reason: "HOLD_VIEW_RIGHTS_ROLE" };
    }
    return deny(`HOLD_${processingState}`);
  }

  // Expired rights records are restrictive: everything except rights-role
  // view is denied until re-reviewed.
  if (restrictions.expired) {
    if (action === "view" && isRightsRole) {
      return { allowed: true, reason: "EXPIRED_VIEW_RIGHTS_ROLE" };
    }
    return deny("RIGHTS_RECORD_EXPIRED");
  }

  // Rights-status caps (absolute; roles can never exceed them).
  switch (action) {
    case "view": {
      if (caps.view === "none") return deny("RIGHTS_DISPLAY_RESTRICTED");
      if (caps.view === "rights_roles") {
        const legalOk = caps.legalReviewerMayView && role === "legal_reviewer";
        if (!isRightsRole && !legalOk) return deny("RIGHTS_VIEW_RESTRICTED");
      }
      break;
    }
    case "search":
      if (!caps.search) return deny("RIGHTS_SEARCH_RESTRICTED");
      break;
    case "process":
      if (!caps.process) return deny("RIGHTS_PROCESSING_RESTRICTED");
      break;
    case "analyse":
      if (!caps.analyse) return deny("RIGHTS_ANALYSIS_RESTRICTED");
      break;
    case "external_ai":
      if (!caps.externalAi) return deny("RIGHTS_EXTERNAL_AI_RESTRICTED");
      if (restrictions.externalProcessingPermitted !== true) {
        return deny("EXTERNAL_PROCESSING_NOT_APPROVED");
      }
      break;
    case "export":
      if (!caps.export) return deny("RIGHTS_EXPORT_RESTRICTED");
      // Export always requires express approval in the rights record.
      if (restrictions.exportPermitted !== true) {
        return deny("EXPORT_NOT_APPROVED");
      }
      break;
    case "share":
      if (!caps.share) return deny("RIGHTS_SHARE_RESTRICTED");
      break;
    case "print":
      if (!caps.print) return deny("RIGHTS_PRINT_RESTRICTED");
      if (restrictions.printingPermitted === false) {
        return deny("PRINTING_NOT_APPROVED");
      }
      break;
  }

  // Student access is additionally gated on the rights caps and the rights
  // record's explicit student-access permission.
  if (role === "student") {
    if (!caps.studentAccess) return deny("RIGHTS_STUDENT_RESTRICTED");
    if (restrictions.studentAccessPermitted !== true) {
      return deny("STUDENT_ACCESS_NOT_APPROVED");
    }
  }

  // Role grant last: roles narrow, never widen.
  if (!ROLE_ACTIONS[role].includes(action)) return deny("ROLE_FORBIDDEN");

  return { allowed: true, reason: "ALLOWED" };
}

/** Rights statuses under which a container may appear in search results. */
export function isSearchVisible(
  rightsStatus: RightsStatus,
  processingState: ContainerState,
): boolean {
  return (
    !HOLD_STATES.includes(processingState) &&
    processingState !== "DELETED" &&
    STATUS_CAPS[rightsStatus]?.search === true
  );
}

export { RIGHTS_ROLES, HOLD_STATES, RESEARCH_ROLES, RIGHTS_STATUSES };
