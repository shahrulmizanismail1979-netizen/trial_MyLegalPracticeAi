import { describe, expect, it } from "vitest";
import { PORTAL_CATALOG } from "@/lib/product-catalog";
import { PRODUCT_GUIDES, PUBLIC_FAQS } from "./public-content";

describe("expanded public guidance", () => {
  it("documents preparation, interpretation, an example, and review for every live portal", () => {
    const liveIds = PORTAL_CATALOG.filter((portal) => portal.availability === "live").map((portal) => portal.id);
    expect(PRODUCT_GUIDES.map((guide) => guide.portalId).sort()).toEqual(liveIds.sort());

    for (const guide of PRODUCT_GUIDES) {
      expect(guide.bestFor.length).toBeGreaterThan(70);
      expect(guide.prepare.length).toBeGreaterThanOrEqual(3);
      expect(guide.example).toContain("Example instruction:");
      expect(guide.interpret.length).toBeGreaterThanOrEqual(2);
      expect(guide.review.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps source-mode separation and professional review visible in FAQs", () => {
    const copy = PUBLIC_FAQS.map(({ question, answer }) => `${question} ${answer}`).join(" ");
    expect(PUBLIC_FAQS.length).toBeGreaterThanOrEqual(8);
    expect(copy).toContain("verified-library lane");
    expect(copy).toContain("public-web lane");
    expect(copy).toContain("fail closed");
    expect(copy).toContain("lawyer-selected mode");
    expect(copy).toContain("independently verify");
  });

  it("does not use guarantee language in the new guidance", () => {
    const copy = JSON.stringify({ PRODUCT_GUIDES, PUBLIC_FAQS }).toLowerCase();
    expect(copy).not.toContain("guarantee");
    expect(copy).not.toContain("complete peace of mind");
    expect(copy).not.toContain("always accurate");
  });
});
