import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUDIT, CHECKLISTS, COVERAGE, DECISION_TREES, GUIDED_SEARCH_TAXONOMY, MATTER_WORKFLOW, NOT_STATED, PLAYBOOKS, PRACTICE_CENTRES, REPORTS, RESOURCES, SOURCES, buildLocalExportManifest, canPublish, exportRecords, filterReports, reportText, validatePublication } from "./lawyes-preview";
import { PUBLIC_CAPABILITY_REGISTRY } from "./lawyes-skills";

import { parseUrlState, serializeUrlState, sanitizeUrlState, defaultState } from "../pages/lawyes-safe-preview/use-router-state";

describe("LAWYes preview fixture", () => {
  it("has the fixed publication inventory", () => {
    expect(REPORTS).toHaveLength(20);
    expect(REPORTS.filter(r => r.status === "Published")).toHaveLength(2);
    expect(REPORTS.filter(r => r.status === "Access record")).toHaveLength(18);
    expect(REPORTS.every(validatePublication)).toBe(true);
    expect(canPublish({ officialSourceVerified: true, paragraphSupportVerified: true, humanApproved: true })).toBe(true);
    expect(canPublish({ officialSourceVerified: true, paragraphSupportVerified: false, humanApproved: true })).toBe(false);
    expect(NOT_STATED).toBe("Not stated in the published judgment");
  });
  it("models Sarawak as a first-class, source-backed jurisdiction", () => {
    expect(COVERAGE).toHaveLength(13);
    expect(COVERAGE.every(item => item.jurisdiction === "Sarawak")).toBe(true);
    expect(new Set(COVERAGE.map(item => item.sourceId)).size).toBeGreaterThan(3);
    expect(RESOURCES.some(item => item.jurisdiction === "Sarawak" && item.status === "Verified current")).toBe(true);
    expect(PLAYBOOKS.map(item => item.track)).toEqual(["Civil", "Criminal", "Conveyancing / land"]);
    expect(CHECKLISTS).toHaveLength(3);
    expect(DECISION_TREES).toHaveLength(2);
    expect(AUDIT.verifiedCurrentAdditions).toBe(SOURCES.filter(source => source.editorialStatus === "Verified current").length);
    expect(AUDIT.sarawakSubstantiveReports).toBe(0);
    expect(REPORTS.some(r => r.jurisdiction === "Sarawak" && r.status === "Access record")).toBe(true);
  });
  it("records provenance and visible verification gaps for every item", () => {
    for (const source of SOURCES) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(source.sourceType).toBeTruthy();
      expect(source.lastVerified).toMatch(/2026/);
      expect(source.rightsStatus).toBeTruthy();
      expect(source.editorialStatus).toBeTruthy();
    }
    for (const report of REPORTS) {
      expect(report.sourceType).toBeTruthy();
      expect(report.jurisdiction).toBeTruthy();
      expect(report.lawAsAt).toBeTruthy();
      expect(report.verificationGap).toBeTruthy();
    }
  });
  it("filters each supported search dimension and ISO dates", () => {
    const lee = REPORTS.find(r => r.id === "lee-khoon-hoo")!;
    for (const [key, value] of Object.entries({ party: "Lee Khoon", case: lee.citation, catchwords: "Insolvency", fullText: "commercial insolvency", court: "Kota Kinabalu", coram: "Leonard", counsel: "Cindy", practiceArea: "Company", legislation: "Companies Act", issue: "insolvent", outcome: "allowed", treatment: "applied", sourcePublisher: "Sabah", status: "Published" })) {
      expect(filterReports(REPORTS, { [key]: value })).toContainEqual(lee);
    }
    expect(filterReports(REPORTS, { from: "2024-01-01", to: "2024-12-31" }).map(r => r.id)).toContain("pp-arsit");
    expect(filterReports(REPORTS, { q: "tanah", jurisdiction: "Sarawak" }).map(r => r.id)).toContain("maria-rochele-sarawak");
    expect(filterReports(REPORTS, { q: "NCR", jurisdiction: "Sarawak" }).map(r => r.id)).toContain("sarawak-native-access");
    expect(filterReports(REPORTS, { jurisdiction: "Sarawak" }).every(r => r.jurisdiction !== "Malaysia")).toBe(true);
    expect(filterReports(REPORTS, { jurisdiction: "Malaysia" }).every(r => r.jurisdiction !== "Sarawak")).toBe(true);
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
    expect(exportRecords(REPORTS)).toHaveLength(20);
    expect(reportText(REPORTS.find(r => r.status === "Published")!)).toContain("Official source:");
    expect(reportText(REPORTS.find(r => r.status === "Access record")!)).toContain("Access record only");
  });
  it("keeps the public work surface free of hidden browser persistence and unintended clients", () => {
    const fs = require("node:fs");
    const path = require("node:path");

    const root = fileURLToPath(new URL("../pages", import.meta.url));
    const filesToRead = [
      path.join(root, "lawyes-safe-preview.tsx"),
    ];

    const previewDir = path.join(root, "lawyes-safe-preview");
    if (fs.existsSync(previewDir)) {
      const dirFiles = fs.readdirSync(previewDir);
      for (const f of dirFiles) {
        if (f.endsWith(".ts") || f.endsWith(".tsx")) {
          filesToRead.push(path.join(previewDir, f));
        }
      }
    }

    filesToRead.push(fileURLToPath(new URL("lawyes-preview.ts", import.meta.url)));

    for (const f of filesToRead) {
      const source = fs.readFileSync(f, "utf8");
      expect(source).not.toMatch(/axios|localStorage|Clerk|QueryClient|useMutation/);
      const apiReferences = source.match(/\/api\/[a-z0-9_/*?:.-]+/gi) ?? [];
      expect(apiReferences.every((route: string) =>
        route.startsWith("/api/assistant/work-chat")
        || route.startsWith("/api/lit/lawyes/matters")
      )).toBe(true);
    }
  });
  it("keeps the canonical source inventory", () => {
    expect(SOURCES).toHaveLength(9);
    expect(AUDIT.sourcesReviewed).toBe(9);
  });
  it("gives every source structured access guidance", () => {
    for (const source of SOURCES) {
      expect(source.whatYouCanFind.length).toBeGreaterThan(1);
      expect(source.accessRequirements.length).toBeGreaterThan(1);
      expect(source.verificationSteps.length).toBeGreaterThan(2);
      expect(source.usageNotes.join(" ")).toMatch(/not|Do not/i);
      expect(source.changeHistory.length).toBeGreaterThan(1);
    }
  });
  it("has six nationwide practice centres with an explicit Sarawak specialist path", () => {
    expect(PRACTICE_CENTRES).toHaveLength(6);
    expect(PRACTICE_CENTRES.map(x => x.name)).toEqual(["Civil Litigation", "Criminal Litigation", "Conveyancing & Land", "NCR & Native Law", "Probate & Estates", "Professional Practice"]);
    expect(PRACTICE_CENTRES.filter(x => x.jurisdiction === "Malaysia")).toHaveLength(5);
    expect(PRACTICE_CENTRES.find(x => x.id === "ncr-native-law")).toMatchObject({ jurisdiction: "Sarawak" });
    expect(PRACTICE_CENTRES.find(x => x.id === "ncr-native-law")?.overview).toMatch(/Sarawak specialist/);
    expect(PRACTICE_CENTRES.every(x => x.scopeNote.length > 40)).toBe(true);
  });
  it("gives each practice centre source-aware limits and workflow depth", () => {
    for (const centre of PRACTICE_CENTRES) {
      expect(centre.workflowStages.length).toBeGreaterThanOrEqual(4);
      expect(centre.sourceNotes.length).toBeGreaterThan(0);
      expect(centre.gapNotices.length).toBeGreaterThan(0);
      expect(centre.limits.join(" ")).toMatch(/not legal advice/i);
      expect(centre.updatedOn).toMatch(/2026/);
      expect(centre.verificationStatus).toBe("Verification required");
    }
  });
  it("has a pack-specific required intake for each drafting pack", () => {
    expect(PLAYBOOKS).toHaveLength(3);
    for (const pack of PLAYBOOKS) {
      expect(pack.intakeFields.some(x => x.required)).toBe(true);
      expect(pack.sections.length).toBeGreaterThan(1);
      expect(pack.safeguards.length).toBeGreaterThan(2);
      expect(pack.outputManifestGuidance.length).toBeGreaterThan(2);
      expect(pack.knownGaps.length).toBeGreaterThan(0);
    }
  });
  it("does not give civil or criminal land-specific defaults", () => {
    for (const pack of PLAYBOOKS.filter(x => x.track !== "Conveyancing / land")) {
      expect(pack.intakeFields.map(x => `${x.id} ${x.defaultValue ?? ""}`).join(" ").toLowerCase()).not.toMatch(/land|ncr|title/);
    }
  });
  it("makes checklist guidance practical and review-gated", () => {
    for (const checklist of CHECKLISTS) {
      expect(checklist.practicalSteps.length).toBeGreaterThan(checklist.items.length);
      expect(checklist.sourceNotes.length).toBe(checklist.sourceIds.length);
      expect(checklist.practitionerReviewWarning).toMatch(/not legal advice/i);
    }
  });
  it("keeps decision trees as verified orientation rather than conclusions", () => {
    for (const tree of DECISION_TREES) {
      expect(tree.outcomes.length).toBeGreaterThan(2);
      expect(tree.verificationNotes.length).toBeGreaterThan(2);
      expect(tree.practitionerReviewWarning).toMatch(/mandatory/i);
    }
  });
  it("publishes guided search taxonomies without invented authority", () => {
    expect(GUIDED_SEARCH_TAXONOMY.jurisdictions).toHaveLength(4);
    expect(GUIDED_SEARCH_TAXONOMY.jurisdictions[0]).toMatchObject({ id: "", mode: "all" });
    expect(GUIDED_SEARCH_TAXONOMY.documentTypes).toContain("Access record");
    expect(GUIDED_SEARCH_TAXONOMY.exampleQueries).toContain("tanah");
    expect(GUIDED_SEARCH_TAXONOMY.verificationStatuses).toContain("Lawyer reviewed");
  });
  it("uses exact jurisdiction when a jurisdiction mode is selected", () => {
    expect(filterReports(REPORTS, { jurisdiction: "Sarawak" }).every(x => x.jurisdiction === "Sarawak")).toBe(true);
    expect(filterReports(REPORTS, { jurisdiction: "Sabah & Sarawak" }).every(x => x.jurisdiction === "Sabah & Sarawak")).toBe(true);
    expect(filterReports(REPORTS, { jurisdiction: "Malaysia" }).every(x => x.jurisdiction === "Malaysia")).toBe(true);
    expect(filterReports(REPORTS, { jurisdiction: "" })).toHaveLength(REPORTS.length);
  });
  it("maps editorial-status guidance to the published report records", () => {
    const reviewed = filterReports(REPORTS, { jurisdiction: "", status: "Lawyer reviewed" });
    expect(reviewed).toHaveLength(2);
    expect(reviewed.every((record) => record.status === "Published" && record.editorialStatus === "Lawyer reviewed")).toBe(true);
  });
  it("retains useful alias search within the selected jurisdiction", () => {
    expect(filterReports(REPORTS, { jurisdiction: "Sarawak", q: "tanah" }).some(x => x.id === "maria-rochele-sarawak")).toBe(true);
    expect(filterReports(REPORTS, { jurisdiction: "Sarawak", q: "adat" }).some(x => x.id === "sarawak-native-access")).toBe(true);
  });
  it("builds a safe local export manifest", () => {
    const manifest = buildLocalExportManifest(REPORTS.slice(0, 2), "MAT-001");
    expect(manifest.kind).toBe("LAWYes Safe Preview local manifest");
    expect(manifest.createdFor).toBe("MAT-001");
    expect(manifest.materials).toHaveLength(2);
    expect(manifest.warnings.join(" ")).toMatch(/no upload|no.*persistence/i);
  });
  it("states the local-only matter workflow safeguards", () => {
    expect(MATTER_WORKFLOW.stages).toHaveLength(4);
    expect(MATTER_WORKFLOW.requiredBeforeHandoff).toContain("At least one selected material");
    expect(MATTER_WORKFLOW.localOnlyNotice).toMatch(/does not save/i);
  });
  it("keeps internal audit language and staff workflows out of the public LAWYes experience", () => {
    const publicCapabilityIds = PUBLIC_CAPABILITY_REGISTRY.map((capability) => capability.id);
    expect(publicCapabilityIds).not.toContain("secure-research-repository");
    expect(publicCapabilityIds).not.toContain("research-publication-pipeline");

    const publicFiles = [
      "../pages/lawyes-safe-preview.tsx",
      "../pages/lawyes-safe-preview/home.tsx",
      "../pages/lawyes-safe-preview/skills.tsx",
      "../pages/lawyes-safe-preview/search.tsx",
      "../pages/lawyes-safe-preview/practice.tsx",
      "../pages/lawyes-safe-preview/verification.tsx",
      "../pages/lawyes-safe-preview/shared.tsx",
    ];
    const forbiddenUserFacingTerms = /Suggested Capabilities|All capabilities|Audit Status|Practice Centre Audit|Published Preview|Editorial status|Editorial history|Adapter boundary|Current service routes|verification pending|Implemented;/i;

    for (const relativePath of publicFiles) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
      expect(source).not.toMatch(forbiddenUserFacingTerms);
    }
  });
  it("gives every public tool concrete inputs, outputs, examples, and review guidance", () => {
    for (const capability of PUBLIC_CAPABILITY_REGISTRY) {
      expect(capability.requiredInputs.length).toBeGreaterThanOrEqual(2);
      expect(capability.outputTypes.length).toBeGreaterThanOrEqual(2);
      expect(capability.examples.length).toBeGreaterThanOrEqual(2);
      expect(capability.verification).toMatch(/review|verify|check|verification/i);
      expect(capability.description.length).toBeGreaterThan(50);
    }
  });
  it("uses practice-specific onboarding rather than generic centre copy", () => {
    expect(new Set(PRACTICE_CENTRES.map((centre) => centre.workflowStages[0])).size).toBe(PRACTICE_CENTRES.length);
    for (const centre of PRACTICE_CENTRES) {
      expect(centre.suitableFor.join(" ")).toMatch(/record|mapping|preparing|checklist|questions/i);
      expect(centre.examples[0]).toMatch(/do not/i);
    }
  });
  it("keeps the LAWYes navigation rail light and readable", () => {
    const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
    expect(css).toContain("--lawyes-sidebar: 214 24% 95%");
    expect(css).toContain("--lawyes-sidebar-text: 222 55% 18%");
    expect(css).not.toContain("--lawyes-sidebar: 222 80% 14%");
  });
});
describe("URL state synchronization", () => {
  it("defaults nationwide search to a neutral title sort", () => {
    expect(defaultState.sort).toBe("title");
  });
  it("sanitizes invalid states", () => {
    const state = sanitizeUrlState({ view: "invalid" as any, jurisdiction: "Fake" as any, draftStep: 99 });
    expect(state.view).toBe("home");
    expect(state.jurisdiction).toBe(""); // explicit all-jurisdictions default
    expect(state.draftStep).toBe(1); // clamped
  });

  it("roundtrips valid state", () => {
    const state = { ...defaultState, view: "search" as const, q: "hello", jurisdiction: "Malaysia" as const };
    const params = serializeUrlState(state);
    const parsed = parseUrlState(params);
    expect(parsed).toEqual(state);
  });

  it("removes unknown report IDs in selectedMaterials", () => {
    const validId = REPORTS[0].id;
    const state = sanitizeUrlState({ selectedMaterials: `unknown-id,${validId},another-fake` });
    expect(state.selectedMaterials).toBe(validId);
  });

  it("normalizes terminal steps on direct URL parse", () => {
    // draftStep=3 with valid playbook normalizes to 2
    const withPlaybook = parseUrlState(new URLSearchParams("draftStep=3&playbook=" + PLAYBOOKS[0].id));
    expect(withPlaybook.draftStep).toBe(2);

    // draftStep=3 without playbook normalizes to 1
    const withoutPlaybook = parseUrlState(new URLSearchParams("draftStep=3"));
    expect(withoutPlaybook.draftStep).toBe(1);

    // matterStep=2 normalizes to 1
    const matter = parseUrlState(new URLSearchParams("matterStep=2"));
    expect(matter.matterStep).toBe(1);
  });

  it("serializes terminal steps safely", () => {
    const draftState = { ...defaultState, playbook: PLAYBOOKS[0].id, draftStep: 3 };
    expect(serializeUrlState(draftState).get("draftStep")).toBe("2");

    const draftStateEmpty = { ...defaultState, draftStep: 3 };
    expect(serializeUrlState(draftStateEmpty).get("draftStep")).toBe("1");

    const matterState = { ...defaultState, matterStep: 2 };
    expect(serializeUrlState(matterState).get("matterStep")).toBe("1");
  });
});

describe("LAWYes navigation destinations", () => {
  const readSource = (relativePath: string) =>
    readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

  it("keeps the public navigation on the canonical workspace and directory routes", () => {
    const nav = readSource("../components/lawyes-nav.tsx");
    const preview = readSource("../pages/lawyes-safe-preview.tsx");
    const previewHome = readSource("../pages/lawyes-safe-preview/home.tsx");
    const skills = readSource("../pages/lawyes-safe-preview/skills.tsx");
    const footer = readSource("../components/footer.tsx");
    const trust = readSource("../components/trust.tsx");

    for (const source of [nav, preview, previewHome, skills, footer, trust]) {
      expect(source).not.toMatch(/(?:href|location\.href)\s*=?\s*["'`]\/#(?:pricing|security)/);
    }

    expect(nav).toContain('href="/lawyes"');
    expect(nav).toContain('href="/apps#apps"');
    expect(nav).toContain('href="/apps#pricing"');
    expect(nav).toContain('href="/apps#security"');
    expect(nav).toContain('href="/sign-in"');

    expect(preview).toContain('href="/lawyes"');
    expect(preview).toContain('href="/apps#apps"');
    expect(preview).toContain('href="/apps#pricing"');
    expect(preview).toContain('href="/apps#security"');
    expect(preview).toContain('href="/sign-in"');

    expect(previewHome).toContain('href="/lawyes"');
    expect(previewHome).toContain('href="/sign-in"');
    expect(skills).toContain('"/apps#apps"');
    expect(footer).toContain('href="/apps#privacy"');
    expect(trust).toContain('href="/apps#privacy"');
  });

  it("keeps portal upgrade prompts pointed at the marketing pricing section", () => {
    const portalSources = [
      "../../../mylitai/src/components/SubscriptionGate.tsx",
      "../../../mysyariahai/src/pages/pricing.tsx",
      "../../../mysyariahai/src/components/upgrade-prompt.tsx",
      "../../../mycorplegalai/src/pages/PricingPage.tsx",
      "../../../mycrimai/src/pages/pricing.tsx",
      "../../../mycrimai/src/components/entitlements/upgrade-card.tsx",
      "../../../myconveylitai/src/pages/Pricing.tsx",
      "../../../myconveylitai/src/pages/Dashboard.tsx",
      "../../../mylawacad/src/pages/billing.tsx",
    ];

    for (const relativePath of portalSources) {
      const source = readSource(relativePath);
      expect(source).not.toContain("/#pricing");
      expect(source).toContain("/apps#pricing");
    }
  });
});
