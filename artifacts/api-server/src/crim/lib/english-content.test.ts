import { describe, expect, it } from "vitest";
import seedData from "./crim-content-seed.json";
import { englishCausePaper, englishSampleDocument } from "./english-content";

const causePapers = seedData.cause_papers.map(englishCausePaper);
const sampleDocuments = seedData.sample_documents.map(englishSampleDocument);

describe("MyCrimAI English content backfill", () => {
  it("preserves every legacy row and creates one English pair for each", () => {
    expect(seedData.cause_papers).toHaveLength(25);
    expect(seedData.sample_documents).toHaveLength(13);
    expect(causePapers).toHaveLength(seedData.cause_papers.length);
    expect(sampleDocuments).toHaveLength(seedData.sample_documents.length);
    expect(causePapers.map((row) => row.sourceId)).toEqual(seedData.cause_papers.map((row) => row.id));
    expect(sampleDocuments.map((row) => row.sourceId)).toEqual(seedData.sample_documents.map((row) => row.id));
    expect(causePapers.every((row) => row.language === "en" && row.templateContent.length > 1_500)).toBe(true);
    expect(sampleDocuments.every((row) => row.language === "en" && row.content.length > 1_000)).toBe(true);
  });

  it("uses stable conflict keys, making repeated backfills idempotent", () => {
    const firstBoot = [...causePapers, ...sampleDocuments];
    const repeatedBoot = [...firstBoot, ...causePapers, ...sampleDocuments];
    expect(new Set(repeatedBoot.map((row) => row.stableKey)).size).toBe(38);
  });

  it("supports language filtering without changing the all-records default", () => {
    const legacy = seedData.cause_papers.map((row) => ({ ...row, language: "ms" as const }));
    const all = [...legacy, ...causePapers];
    expect(all).toHaveLength(50);
    expect(all.filter((row) => row.language === "ms")).toHaveLength(25);
    expect(all.filter((row) => row.language === "en")).toHaveLength(25);
  });

  it("provides a resolvable paired detail in both directions", () => {
    const english = causePapers[0];
    const malay = seedData.cause_papers.find((row) => row.id === english.sourceId);
    const englishFromMalay = causePapers.find((row) => row.sourceId === malay?.id);
    expect(malay?.id).toBe(1);
    expect(englishFromMalay?.stableKey).toBe("crim-cause-paper-1-en");
  });
});