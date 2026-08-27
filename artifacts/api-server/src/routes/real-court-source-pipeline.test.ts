/**
 * Publication policy for official court sources.
 *
 * The former test used fixed production IDs as "durable evidence". Those rows
 * are live corpus data and were subsequently returned to UNREVIEWED /
 * RIGHTS_REVIEW_REQUIRED, so asserting their former publication state made
 * the suite depend on mutable operational data. Publication workflow coverage
 * belongs to the isolated admin approval fixture; this read-only policy test
 * ensures a rights re-review cannot make an official source visible early.
 */
import { describe, expect, it } from "vitest";
import { isSearchVisible } from "../research/domain/access";

describe("real official court-source judgment pipeline", () => {
  it("keeps official court sources hidden until the explicit SEARCHABLE transition", () => {
    expect(
      isSearchVisible("OFFICIAL_COURT_SOURCE", "RIGHTS_REVIEW_REQUIRED"),
    ).toBe(false);
    expect(isSearchVisible("OFFICIAL_COURT_SOURCE", "VERIFIED")).toBe(false);
    expect(isSearchVisible("OFFICIAL_COURT_SOURCE", "SEARCHABLE")).toBe(true);
  });
});
