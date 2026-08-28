import { describe, expect, it, vi } from "vitest";
import { evaluatePublicationGate } from "./lawyesReportService";
import { hasLiveReportRights } from "./liveRights";

const complete = {
  rightsStatus: "OFFICIAL_COURT_SOURCE" as const,
  storagePermitted: true,
  analysisPermitted: true,
  studentAccessPermitted: true,
  expiryDate: null,
  approvedPurposes: ["research"],
  paragraphCount: 12,
  unsupportedMaterialPropositions: 0,
  approvedReview: {
    reviewerRole: "legal_reviewer",
    reviewerActive: true,
    legallyTrained: true,
    sourceChecked: true,
    pinpointsChecked: true,
    missingFieldsChecked: true,
  },
};

describe("LAWYes report publication gate", () => {
  it("allows only a complete official-source lawyer-reviewed report", () => {
    expect(evaluatePublicationGate(complete)).toEqual({
      allowed: true,
      failures: [],
    });
  });

  it("fails closed when source rights change", () => {
    const result = evaluatePublicationGate({
      ...complete,
      rightsStatus: "DISPLAY_RESTRICTED",
    });
    expect(result.allowed).toBe(false);
    expect(result.failures).toContain("SOURCE_RIGHTS_NOT_AUTHORISED");
  });

  it("requires paragraph support for every material proposition", () => {
    const result = evaluatePublicationGate({
      ...complete,
      unsupportedMaterialPropositions: 1,
    });
    expect(result.failures).toContain(
      "MATERIAL_PROPOSITIONS_REQUIRE_PINPOINTS",
    );
  });

  it("rejects non-lawyer and incomplete sign-off", () => {
    const result = evaluatePublicationGate({
      ...complete,
      approvedReview: {
        ...complete.approvedReview,
        reviewerRole: "administrator",
        pinpointsChecked: false,
      },
    });
    expect(result.failures).toContain("LEGALLY_TRAINED_REVIEWER_REQUIRED");
  });

  it("rejects expired rights deterministically", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    const result = evaluatePublicationGate({
      ...complete,
      expiryDate: new Date("2026-04-30T23:59:59Z"),
    });
    expect(result.failures).toContain("SOURCE_RIGHTS_EXPIRED");
    vi.useRealTimers();
  });

  it("requires express publication authority for user-authorised material", () => {
    const result = evaluatePublicationGate({
      ...complete,
      rightsStatus: "USER_OWNED_OR_AUTHORISED",
      approvedPurposes: ["private research"],
    });
    expect(result.failures).toContain("PUBLICATION_NOT_AUTHORISED");
  });

  it("fails closed for expired or narrowed subscriber rights", () => {
    expect(hasLiveReportRights({
      rightsStatus: complete.rightsStatus,
      storagePermitted: true,
      analysisPermitted: true,
      studentAccessPermitted: true,
      expiryDate: new Date(0),
      approvedPurposes: [],
    })).toBe(false);
    expect(hasLiveReportRights({
      rightsStatus: complete.rightsStatus,
      storagePermitted: true,
      analysisPermitted: true,
      studentAccessPermitted: false,
      expiryDate: null,
      approvedPurposes: [],
    })).toBe(false);
  });

  it("requires publication purpose and export/print rights independently", () => {
    const userOwned = {
      rightsStatus: "USER_OWNED_OR_AUTHORISED",
      storagePermitted: true,
      analysisPermitted: true,
      studentAccessPermitted: true,
      expiryDate: null,
      approvedPurposes: ["research"],
      exportPermitted: true,
      printingPermitted: true,
    };
    expect(hasLiveReportRights(userOwned)).toBe(false);
    userOwned.approvedPurposes = ["public_display"];
    expect(hasLiveReportRights({ ...userOwned, exportPermitted: false }, "export")).toBe(false);
    expect(hasLiveReportRights({ ...userOwned, printingPermitted: false }, "print")).toBe(false);
  });
});
