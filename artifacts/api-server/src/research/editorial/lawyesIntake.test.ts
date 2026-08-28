import { describe, expect, it } from "vitest";
import {
  isEligibleLawyesIntakeSource,
  lawyesIntakePriority,
  orderLawyesIntake,
  planLawyesIntake,
  type LawyesIntakeCandidate,
} from "./lawyesIntake";

const candidate = (overrides: Partial<LawyesIntakeCandidate> = {}): LawyesIntakeCandidate => ({
  judgmentId: 1, rightsRecordId: 2, rightsStatus: "OFFICIAL_COURT_SOURCE",
  storagePermitted: true, analysisPermitted: true, studentAccessPermitted: true,
  expiryDate: null, approvedPurposes: [], title: "Source title", sourceUrl: "https://court.example/j/1",
  court: null, sourceName: "judgment.pdf", hasVerifiedFullText: true, ...overrides,
});

describe("LAWYes editorial intake", () => {
  it("admits only current authorised sources", () => {
    expect(isEligibleLawyesIntakeSource(candidate())).toBe(true);
    expect(isEligibleLawyesIntakeSource(candidate({ rightsStatus: "DISPLAY_RESTRICTED" }))).toBe(false);
    expect(isEligibleLawyesIntakeSource(candidate({ expiryDate: new Date(0) }))).toBe(false);
  });

  it("prioritises Sabah/Sarawak High Court, Industrial Court, then JAKESS", () => {
    const ordered = orderLawyesIntake([
      candidate({ judgmentId: 4, court: "Federal Court" }),
      candidate({ judgmentId: 3, court: "JAKESS" }),
      candidate({ judgmentId: 2, court: "Industrial Court of Malaysia" }),
      candidate({ judgmentId: 1, court: "High Court of Sabah and Sarawak" }),
    ]);
    expect(ordered.map((item) => item.judgmentId)).toEqual([1, 2, 3, 4]);
    expect(lawyesIntakePriority(candidate({ court: "JAKESS" }))).toBe(2);
  });

  it("does not seed an already recorded judgment again", () => {
    const record = candidate({ judgmentId: 9 });
    expect(planLawyesIntake(record, new Set())).toEqual({ kind: "draft", state: "Draft" });
    expect(planLawyesIntake(record, new Set([9]))).toEqual({ kind: "skip" });
  });

  it("keeps missing verified text as a pending-access candidate, never a publishable report", () => {
    const missingText = candidate({ hasVerifiedFullText: false });
    expect(planLawyesIntake(missingText, new Set())).toEqual({
      kind: "pending_access",
      reason: "Verified full text with stable paragraph identifiers is not available",
    });
  });

  it("can only plan Draft, never Published", () => {
    expect(planLawyesIntake(candidate(), new Set())).toEqual({ kind: "draft", state: "Draft" });
  });
});