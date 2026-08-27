import { describe, expect, it } from "vitest";
import {
  RESEARCH_ROLES,
  RIGHTS_STATUSES,
  type ContainerState,
} from "@workspace/db";
import {
  ACCESS_ACTIONS,
  decideAccess,
  isSearchVisible,
  HOLD_STATES,
} from "./access";
import { loadGolden } from "../testing/golden";

// The full access-decision matrix is pinned as a golden fixture: any change
// to who may do what is a deliberate, reviewable diff to
// fixtures/golden/access-decision-matrix.json (regenerate with
// UPDATE_GOLDEN=1).

describe("decideAccess golden matrix", () => {
  it("matches the pinned decision matrix (role × status × action)", async () => {
    const matrix: Record<string, Record<string, Record<string, string>>> = {};
    for (const status of RIGHTS_STATUSES) {
      matrix[status] = {};
      for (const role of RESEARCH_ROLES) {
        matrix[status][role] = {};
        for (const action of ACCESS_ACTIONS) {
          const d = decideAccess({
            role,
            rightsStatus: status,
            processingState: "UPLOADED",
            action,
            // Neutral restrictions: nothing expressly approved.
            restrictions: {},
          });
          matrix[status][role][action] = d.allowed
            ? "ALLOW"
            : `DENY:${d.reason}`;
        }
      }
    }
    expect(matrix).toEqual(await loadGolden("access-decision-matrix", matrix));
  });

  it("matches the pinned hold-state matrix (role × hold state × action)", async () => {
    const matrix: Record<string, Record<string, Record<string, string>>> = {};
    for (const state of [...HOLD_STATES, "DELETED"] as ContainerState[]) {
      matrix[state] = {};
      for (const role of RESEARCH_ROLES) {
        matrix[state][role] = {};
        for (const action of ACCESS_ACTIONS) {
          const d = decideAccess({
            role,
            // Even the most permissive rights status cannot beat a hold.
            rightsStatus: "PUBLIC_OR_OPEN_LICENCE_SOURCE",
            processingState: state,
            action,
            restrictions: { externalProcessingPermitted: true, exportPermitted: true },
          });
          matrix[state][role][action] = d.allowed
            ? "ALLOW"
            : `DENY:${d.reason}`;
        }
      }
    }
    expect(matrix).toEqual(await loadGolden("access-hold-matrix", matrix));
  });
});

describe("decideAccess invariants", () => {
  it("denies everything when unauthenticated", () => {
    for (const status of RIGHTS_STATUSES) {
      for (const action of ACCESS_ACTIONS) {
        expect(
          decideAccess({
            role: null,
            rightsStatus: status,
            processingState: "UPLOADED",
            action,
          }),
        ).toEqual({ allowed: false, reason: "UNAUTHENTICATED" });
      }
    }
  });

  it("rights status caps every role: DO_NOT_PROCESS blocks even owner", () => {
    for (const action of ACCESS_ACTIONS) {
      if (action === "view") continue; // rights roles may view metadata
      expect(
        decideAccess({
          role: "owner",
          rightsStatus: "DO_NOT_PROCESS",
          processingState: "UPLOADED",
          action,
          restrictions: { exportPermitted: true, externalProcessingPermitted: true },
        }).allowed,
      ).toBe(false);
    }
  });

  it("EXTERNAL_AI_RESTRICTED refuses external_ai for every role", () => {
    for (const role of RESEARCH_ROLES) {
      expect(
        decideAccess({
          role,
          rightsStatus: "EXTERNAL_AI_RESTRICTED",
          processingState: "UPLOADED",
          action: "external_ai",
          restrictions: { externalProcessingPermitted: true },
        }).allowed,
      ).toBe(false);
    }
  });

  it("export requires express approval even on open-licence sources", () => {
    expect(
      decideAccess({
        role: "administrator",
        rightsStatus: "PUBLIC_OR_OPEN_LICENCE_SOURCE",
        processingState: "UPLOADED",
        action: "export",
      }),
    ).toEqual({ allowed: false, reason: "EXPORT_NOT_APPROVED" });
    expect(
      decideAccess({
        role: "administrator",
        rightsStatus: "PUBLIC_OR_OPEN_LICENCE_SOURCE",
        processingState: "UPLOADED",
        action: "export",
        restrictions: { exportPermitted: true },
      }).allowed,
    ).toBe(true);
  });

  it("students need express student-access permission", () => {
    expect(
      decideAccess({
        role: "student",
        rightsStatus: "PRIVATE_PROCESSING_APPROVED",
        processingState: "UPLOADED",
        action: "view",
      }),
    ).toEqual({ allowed: false, reason: "STUDENT_ACCESS_NOT_APPROVED" });
    expect(
      decideAccess({
        role: "student",
        rightsStatus: "PRIVATE_PROCESSING_APPROVED",
        processingState: "UPLOADED",
        action: "view",
        restrictions: { studentAccessPermitted: true },
      }).allowed,
    ).toBe(true);
  });

  it("expired rights records fall back to restrictive handling", () => {
    expect(
      decideAccess({
        role: "researcher",
        rightsStatus: "PUBLIC_OR_OPEN_LICENCE_SOURCE",
        processingState: "UPLOADED",
        action: "view",
        restrictions: { expired: true },
      }),
    ).toEqual({ allowed: false, reason: "RIGHTS_RECORD_EXPIRED" });
    expect(
      decideAccess({
        role: "rights_reviewer",
        rightsStatus: "PUBLIC_OR_OPEN_LICENCE_SOURCE",
        processingState: "UPLOADED",
        action: "view",
        restrictions: { expired: true },
      }).allowed,
    ).toBe(true);
  });

  it("only exposes explicitly searchable containers with search-safe rights", () => {
    expect(isSearchVisible("PUBLIC_OR_OPEN_LICENCE_SOURCE", "QUARANTINED")).toBe(
      false,
    );
    expect(isSearchVisible("UNREVIEWED", "UPLOADED")).toBe(false);
    expect(isSearchVisible("OFFICIAL_COURT_SOURCE", "VERIFIED")).toBe(false);
    expect(isSearchVisible("OFFICIAL_COURT_SOURCE", "RIGHTS_REVIEW_REQUIRED")).toBe(
      false,
    );
    expect(isSearchVisible("OFFICIAL_COURT_SOURCE", "SEARCHABLE")).toBe(true);
  });

  it("MANUAL_LEGAL_REVIEW_REQUIRED allows legal reviewer view only", () => {
    expect(
      decideAccess({
        role: "legal_reviewer",
        rightsStatus: "MANUAL_LEGAL_REVIEW_REQUIRED",
        processingState: "UPLOADED",
        action: "view",
      }).allowed,
    ).toBe(true);
    expect(
      decideAccess({
        role: "researcher",
        rightsStatus: "MANUAL_LEGAL_REVIEW_REQUIRED",
        processingState: "UPLOADED",
        action: "view",
      }).allowed,
    ).toBe(false);
  });
});
