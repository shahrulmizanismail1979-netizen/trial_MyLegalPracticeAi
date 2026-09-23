import { describe, expect, it } from "vitest";
import { legalReferenceGuides } from "./legal-reference-guide";

describe("legal reference guidance integrity", () => {
  it("covers each practice domain without duplicate identities", () => {
    expect(legalReferenceGuides.map((guide) => guide.id).sort()).toEqual([
      "academic-firm", "accident-claims", "banking-disputes", "civil-irac", "conveyance-accident", "corporate-ccb", "criminal", "employment", "judicial-review", "probate-estate", "property-jurisdictions", "sarawak", "syariah",
    ]);
  });

  for (const guide of legalReferenceGuides) {
    it(`${guide.id} retains source limits, original outlines and review controls`, () => {
      expect(guide.jurisdiction.length).toBeGreaterThan(10);
      expect(guide.caution.length).toBeGreaterThan(40);
      expect(guide.practitionerChecklist.length).toBeGreaterThan(2);
      expect(guide.templateSections.length).toBeGreaterThan(2);
      expect(guide.finalReview.length).toBeGreaterThan(0);
      expect(guide.sources.length).toBeGreaterThan(0);
      for (const source of guide.sources) {
        const url = new URL(source.sourceUrl);
        expect(url.protocol).toBe("https:");
        expect(url.hostname.endsWith(".gov.my") || ["www.ssm.com.my", "www.amanahraya.my"].includes(url.hostname)).toBe(true);
        expect(source.checkedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(source.authority.length).toBeGreaterThan(0);
        expect(source.verificationLimit.length).toBeGreaterThan(30);
      }
      for (const section of guide.templateSections) expect(section.prompts.length).toBeGreaterThan(0);
    });
  }
});