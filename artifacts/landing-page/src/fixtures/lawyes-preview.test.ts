import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NOT_STATED, REPORTS, canPublish, exportRecords, filterReports, reportText, validatePublication } from "./lawyes-preview";

describe("LAWYes preview fixture", () => {
  it("has the fixed publication inventory", () => {
    expect(REPORTS).toHaveLength(18);
    expect(REPORTS.filter(r => r.status === "Published")).toHaveLength(2);
    expect(REPORTS.filter(r => r.status === "Access record")).toHaveLength(16);
    expect(REPORTS.every(validatePublication)).toBe(true);
    expect(canPublish({ officialSourceVerified: true, paragraphSupportVerified: true, humanApproved: true })).toBe(true);
    expect(canPublish({ officialSourceVerified: true, paragraphSupportVerified: false, humanApproved: true })).toBe(false);
    expect(NOT_STATED).toBe("Not stated in the published judgment");
  });
  it("filters each supported search dimension and ISO dates", () => {
    const lee = REPORTS[0];
    for (const [key, value] of Object.entries({ party: "Lee Khoon", case: lee.citation, catchwords: "Insolvency", fullText: "commercial insolvency", court: "Kota Kinabalu", coram: "Leonard", counsel: "Cindy", practiceArea: "Company", legislation: "Companies Act", issue: "insolvent", outcome: "allowed", treatment: "applied", sourcePublisher: "Sabah", status: "Published" })) {
      expect(filterReports(REPORTS, { [key]: value })).toContainEqual(lee);
    }
    expect(filterReports(REPORTS, { from: "2024-01-01", to: "2024-12-31" }).map(r => r.id)).toContain("pp-arsit");
  });
  it("uses HTTPS sources and paragraph anchors for propositions", () => {
    for (const r of REPORTS) expect(new URL(r.sourceUrl).protocol).toBe("https:");
    for (const r of REPORTS.filter(r => r.report)) {
      const paragraphs = new Set(r.report!.paragraphs.map(p => p.number));
      const all = [...r.report!.facts, ...r.report!.proceduralHistory, ...r.report!.ratio, ...r.report!.obiter, r.report!.disposition, ...r.report!.issues, ...r.report!.authorities];
      for (const point of all.flatMap(x => x.pinpoints)) expect(point).toMatch(/\d/);
      expect(paragraphs.size).toBeGreaterThan(0);
    }
  });
  it("builds honest exports", () => {
    expect(exportRecords(REPORTS)).toHaveLength(18);
    expect(reportText(REPORTS[0])).toContain("Official source:");
    expect(reportText(REPORTS.find(r => r.status === "Access record")!)).toContain("Access record only");
  });
  it("contains no preview network, API, storage, or application-client reference", () => {
    const here = fileURLToPath(new URL(".", import.meta.url));
    const source = readFileSync(`${here}lawyes-preview.ts`, "utf8") + readFileSync(`${here}../pages/lawyes-safe-preview.tsx`, "utf8");
    expect(source).not.toMatch(/fetch\s*\(|axios|\/api\/|localStorage|Clerk|QueryClient|useQuery|useMutation/);
  });
});