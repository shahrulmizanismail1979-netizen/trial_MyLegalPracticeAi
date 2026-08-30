import verified from "./lawyes-verified-reports.json";

export const NOT_STATED = "Not stated in the published judgment";
export type Status = "Access record" | "AI editorial draft" | "Lawyer reviewed" | "Published";
export type Jurisdiction = "Sarawak" | "Sabah & Sarawak" | "Malaysia";
export type EditorialStatus = "Verified current" | "Lawyer reviewed" | "Verification required" | "Access record";
export type Pinpoint = { number: string; text: string };

type VerifiedReport = (typeof verified)[keyof typeof verified]["report"];

export type SourceRecord = Readonly<{
  id: string;
  name: string;
  url: string;
  sourceType: string;
  jurisdiction: Jurisdiction;
  lastVerified: string;
  rightsStatus: "Official public source" | "Lawfully accessible public material";
  editorialStatus: EditorialStatus;
  notes: string;
}>;

export type Report = Readonly<{
  id: string; title: string; citation: string; court: string; registry: string; date: string;
  isoDate: string; coram: string; counsel: string; legislation: string; issue: string; outcome: string; treatment: string;
  practiceAreas: readonly string[]; catchwords: readonly string[];
  sourcePublisher: string; sourceUrl: string; sourceType: string; jurisdiction: Jurisdiction;
  lawAsAt: string; status: Status; editorialStatus: EditorialStatus; officialSourceVerified: boolean;
  paragraphSupportVerified: boolean; humanApproved: boolean; reviewer: string; verificationDate: string;
  verificationGap: string; revisionHistory: readonly string[]; report?: VerifiedReport;
}>;

export type CoverageItem = Readonly<{
  id: string;
  label: string;
  bmLabel: string;
  jurisdiction: Jurisdiction;
  status: EditorialStatus;
  sourceId: string;
  coverageNote: string;
}>;

export type PractitionerResource = Readonly<{
  id: string;
  label: string;
  category: "Update" | "Legislation" | "Practice direction" | "Registry / agency" | "Professional";
  jurisdiction: Jurisdiction;
  sourceId: string;
  summary: string;
  verifiedDate: string;
  status: EditorialStatus;
}>;

export type Playbook = Readonly<{
  id: string;
  title: string;
  track: "Civil" | "Criminal" | "Conveyancing / land";
  jurisdiction: "Sarawak";
  status: "Practitioner-review template";
  sourceIds: readonly string[];
  intake: readonly string[];
  structure: readonly string[];
  riskFlags: readonly string[];
}>;

export type Checklist = Readonly<{
  id: string;
  title: string;
  jurisdiction: Jurisdiction;
  sourceIds: readonly string[];
  items: readonly string[];
  deadlineNote: string;
}>;

export type DecisionTree = Readonly<{
  id: string;
  title: string;
  jurisdiction: "Sarawak";
  sourceIds: readonly string[];
  questions: readonly string[];
  disclaimer: string;
}>;

export const SOURCES: readonly SourceRecord[] = Object.freeze([
  {
    id: "sarawak-lawnet",
    name: "Sarawak LawNet",
    url: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=Idx",
    sourceType: "State legislation and subsidiary legislation index",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Index gateway reviewed; individual instruments still require item-level currency review.",
  },
  {
    id: "sarawak-judiciary",
    name: "Sarawak Judiciary — E-Court",
    url: "https://sarawak.kehakiman.gov.my/en/e-court",
    sourceType: "Official Judiciary information and e-Court gateway",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Gateway only; no filing requirement, fee, or deadline is inferred from this record.",
  },
  {
    id: "ekss-portal",
    name: "e-Kehakiman Sabah and Sarawak",
    url: "https://ekss-portal.kehakiman.gov.my/portals/web/home/list_judgment/",
    sourceType: "Official judgment and registrar portal",
    jurisdiction: "Sabah & Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Search and judgment gateway; access and document availability must be checked per record.",
  },
  {
    id: "ekss-cmsa",
    name: "Sarawak Advocates Community System",
    url: "https://ekss-cmsa.kehakiman.gov.my/",
    sourceType: "Official e-filing and case administration gateway",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Login/service gateway; this preview does not infer account-only processes.",
  },
  {
    id: "land-survey",
    name: "Sarawak Land and Survey Department",
    url: "https://landsurvey.sarawak.gov.my/web/home/index/",
    sourceType: "State department public information gateway",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Department gateway; land category, instrument, and transaction checks remain verification-required.",
  },
  {
    id: "native-courts",
    name: "Native Courts of Sarawak",
    url: "https://nativecourt.sarawak.gov.my/",
    sourceType: "State Native Courts information gateway",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "Public gateway used for orientation only; no customary-law proposition is published here.",
  },
  {
    id: "sarawak-advocates",
    name: "Advocates Association of Sarawak",
    url: "https://sarawak-advocates.org.my/",
    sourceType: "Professional association public gateway",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Lawfully accessible public material",
    editorialStatus: "Verification required",
    notes: "Gateway availability was intermittent during audit; professional material is not treated as official law.",
  },
  {
    id: "malaysian-ejudgment",
    name: "Malaysian Judiciary eJudgment",
    url: "https://ejudgment.kehakiman.gov.my/ejudgmentweb/searchpage.aspx?JurisdictionType=ALL",
    sourceType: "Official Malaysian Judiciary judgment gateway",
    jurisdiction: "Malaysia",
    lastVerified: "30 August 2026",
    rightsStatus: "Official public source",
    editorialStatus: "Verified current",
    notes: "National source retained so Malaysian material remains equally reachable.",
  },
  {
    id: "maria-copy",
    name: "Public judgment copy via INSTUN Pintu",
    url: "https://pintu.instun.gov.my/artikel/download/maria-rochele-silva-sarabia-v-registrar-of-lands-and-surveys-anor",
    sourceType: "Lawfully accessible public judgment copy",
    jurisdiction: "Sarawak",
    lastVerified: "30 August 2026",
    rightsStatus: "Lawfully accessible public material",
    editorialStatus: "Verification required",
    notes: "Readable copy located for access research; official provenance and stable paragraph mapping are not yet confirmed.",
  },
]);

export const GATEWAYS = SOURCES.map((source) => [source.name, source.url] as const);

const sourceUrl = (id: string) => SOURCES.find((source) => source.id === id)?.url ?? SOURCES[0].url;
const sourceName = (id: string) => SOURCES.find((source) => source.id === id)?.name ?? "Source not stated";

const pending = (
  id: string,
  title: string,
  court: string,
  isoDate: string,
  area: string,
  sourceId: string,
  citation = "",
  jurisdiction: Jurisdiction = "Sabah & Sarawak",
  verificationGap = "Full text, paragraph mapping, and lawyer review are pending.",
): Report => ({
  id, title, citation, court, registry: NOT_STATED, date: isoDate, coram: NOT_STATED, counsel: NOT_STATED,
  isoDate, legislation: NOT_STATED, issue: NOT_STATED, outcome: NOT_STATED, treatment: NOT_STATED,
  practiceAreas: [area], catchwords: [area], sourcePublisher: sourceName(sourceId), sourceUrl: sourceUrl(sourceId),
  sourceType: SOURCES.find((source) => source.id === sourceId)?.sourceType ?? "Source record",
  jurisdiction, lawAsAt: "Last verified 30 August 2026", status: "Access record", editorialStatus: "Access record",
  officialSourceVerified: false, paragraphSupportVerified: false, humanApproved: false,
  reviewer: "Pending editorial review", verificationDate: NOT_STATED, verificationGap,
  revisionHistory: ["Access record indexed; editorial review pending."],
});

const substantive = (
  item: typeof verified.lee | typeof verified.arsit,
  jurisdiction: Jurisdiction,
): Report => ({
  id: item.id, title: item.title, citation: item.report.citation, court: item.report.court, registry: item.report.registry,
  isoDate: item.id === "lee-khoon-hoo" ? "2021-11-15" : "2024-04-29",
  date: item.report.decisionDate, coram: item.report.coram, counsel: item.report.counsel,
  legislation: item.report.legislation.join("; "), issue: item.report.issues.map((x) => x.issue).join("; "),
  outcome: item.report.disposition.text, treatment: item.report.authorities.map((x) => x.treatment).join("; "),
  practiceAreas: item.report.practiceAreas, catchwords: item.report.catchwords, sourcePublisher: item.sourcePublisher,
  sourceUrl: item.sourceUrl, sourceType: "Official e-Kehakiman full judgment", jurisdiction,
  lawAsAt: "Last verified 29 August 2026", status: "Published", editorialStatus: "Lawyer reviewed",
  officialSourceVerified: true, paragraphSupportVerified: true, humanApproved: true,
  reviewer: "LAWYes preview legal review", verificationDate: "29 August 2026",
  verificationGap: "No known gap recorded in this preview fixture; not a completeness claim.",
  revisionHistory: [
    "29 August 2026 — lawyer review recorded for preview fixture.",
    "29 August 2026 — official source and paragraph support verified for preview fixture.",
  ],
  report: item.report,
});

export const REPORTS: readonly Report[] = Object.freeze([
  pending(
    "maria-rochele-sarawak",
    "Maria Rochele Silva Sarabia v Registrar of Lands and Surveys & Anor",
    "High Court in Sabah and Sarawak at Kuching",
    "2015-08-24",
    "Conveyancing / land",
    "maria-copy",
    "KCH-24-7-1-2015",
    "Sarawak",
    "Official source provenance and stable paragraph identifiers require verification before a report can be published.",
  ),
  pending("sarawak-native-access", "Native Court of Appeal — Sarawak judgment access record", "Native Court of Appeal of Sarawak", "2026-08-30", "Native law", "native-courts", "", "Sarawak"),
  substantive(verified.lee, "Sabah & Sarawak"),
  pending("daljinder", "Daljinder Singh v Amardeep Singh as Administrator", "High Court of Malaya", "2021-12-02", "Civil", "malaysian-ejudgment", "LBN-31NCvC-9/10-2016", "Malaysia"),
  pending("tee-guan-pian", "Datuk Tee Guan Pian v David Wong & Anor", "High Court of Sabah and Sarawak", "2022-09-29", "Land", "ekss-portal", "BKI-23NCvC-1/3-2022"),
  pending("investasia", "Investasia v NTSJ Construction", "High Court of Sabah and Sarawak", "2022-11-24", "Construction", "ekss-portal", "BKI-24C-5/7-2022"),
  pending("liew-tham-fook", "Liew Tham Fook v Liew Vui Lin", "High Court of Sabah and Sarawak", "2022-10-26", "Civil", "ekss-portal", "BKI-22NCvC-81/11-2021"),
  pending("arab-malaysian", "Arab-Malaysian Credit v Nationwide Industries", "High Court of Malaya", "2021-09-24", "Banking", "malaysian-ejudgment", "K22-36-1998", "Malaysia"),
  pending("hanzac-bintang", "Hanzac Bintang v Ma Ping", "High Court of Sabah and Sarawak", "2024-01-25", "Contract", "ekss-portal", "BKI-22NCvC-16/2-2020"),
  pending("sing-yung", "Sing Yung Steel v MSIG", "High Court of Sabah and Sarawak", "2021-10-20", "Insurance", "ekss-portal", "BKI-22NCvC-67/8-2019"),
  pending("mohamed-ali", "Mohamed Ali v Sabah Forest Industries", "High Court of Sabah and Sarawak", "2021-11-15", "Employment", "ekss-portal", "BKI-28NCC-29/6-2017"),
  pending("pp-maidin", "Public Prosecutor v Maidin", "High Court of Sabah and Sarawak", "2022-09-27", "Criminal", "ekss-portal", "LBN-45B-2/8-2019"),
  substantive(verified.arsit, "Sabah & Sarawak"),
  pending("tan-wu-huei", "Tan Wu Huei", "Industrial Court of Malaysia", "2026-08-20", "Industrial relations", "malaysian-ejudgment", "1470/2026", "Malaysia"),
  pending("vijayarani", "Vijayarani", "Industrial Court of Malaysia", "2026-08-19", "Industrial relations", "malaysian-ejudgment", "1466/2026", "Malaysia"),
  pending("nandy-marlina", "Nandy Marlina", "Industrial Court of Malaysia", "2026-08-19", "Industrial relations", "malaysian-ejudgment", "1464/2026", "Malaysia"),
  pending("tsen-vun-foo", "Tsen Vun Foo", "Industrial Court of Malaysia", "2026-08-18", "Industrial relations", "malaysian-ejudgment", "1451/2026", "Malaysia"),
  pending("eileen-lee", "Eileen Lee", "Industrial Court of Malaysia", "2026-08-18", "Industrial relations", "malaysian-ejudgment", "1447/2026", "Malaysia"),
  pending("jakess-shma", "JAKESS SHMA v RBA", "Selangor Syariah Court of Appeal", "2021-03-01", "Syariah", "malaysian-ejudgment", "10000-077-0045-2020", "Malaysia"),
  pending("mais-al-anand", "MAIS v Al-Anand Babu", "Selangor Syariah Court of Appeal", "2025-05-20", "Syariah", "malaysian-ejudgment", "2401-A0010-001-0007", "Malaysia"),
]);

const coverageRows: ReadonlyArray<readonly [string, string, string, string]> = [
  ["civil", "Civil procedure", "Prosedur sivil", "sarawak-judiciary"],
  ["criminal", "Criminal practice", "Amalan jenayah", "sarawak-judiciary"],
  ["land", "Conveyancing / land", "Pindah milik / tanah", "land-survey"],
  ["native", "Native law", "Undang-undang adat", "native-courts"],
  ["professional", "Professional practice", "Amalan profesional", "sarawak-advocates"],
  ["probate", "Probate / estates", "Probet / pusaka", "sarawak-lawnet"],
  ["family", "Family", "Keluarga", "sarawak-lawnet"],
  ["employment", "Employment", "Pekerjaan", "malaysian-ejudgment"],
  ["commercial", "Commercial / company", "Komersial / syarikat", "sarawak-lawnet"],
  ["insolvency", "Insolvency", "Kebankrapan / insolvensi", "sarawak-lawnet"],
  ["public", "Public law", "Undang-undang awam", "sarawak-judiciary"],
  ["local-government", "Local government", "Kerajaan tempatan", "sarawak-lawnet"],
  ["state-regulatory", "State regulatory work", "Kawal selia negeri", "land-survey"],
];
export const COVERAGE: readonly CoverageItem[] = Object.freeze(coverageRows.map(([id, label, bmLabel, sourceId]): CoverageItem => ({
  id, label, bmLabel, jurisdiction: "Sarawak", status: "Verification required", sourceId,
  coverageNote: "Official gateway identified. Substantive content is withheld until an item-level source, currency check, and editorial review are recorded.",
})));

export const RESOURCES: readonly PractitionerResource[] = Object.freeze([
  { id: "update-lawnet", label: "Sarawak LawNet consolidated instrument index", category: "Legislation", jurisdiction: "Sarawak", sourceId: "sarawak-lawnet", summary: "Browse state ordinances and subsidiary legislation through the official index.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-ecourt", label: "Sarawak Judiciary E-Court gateway", category: "Update", jurisdiction: "Sarawak", sourceId: "sarawak-judiciary", summary: "Official Judiciary entry point for Sarawak court services and public information.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-ekss", label: "e-Kehakiman judgment collection", category: "Practice direction", jurisdiction: "Sabah & Sarawak", sourceId: "ekss-portal", summary: "Official judgment collection gateway; each judgment remains subject to access and editorial checks.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-cmsa", label: "CMS-A case filing gateway", category: "Registry / agency", jurisdiction: "Sarawak", sourceId: "ekss-cmsa", summary: "Official filing and case administration gateway for advocates and agencies.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-land", label: "Land and Survey public information", category: "Registry / agency", jurisdiction: "Sarawak", sourceId: "land-survey", summary: "Department gateway for land administration information; no transaction requirement is inferred.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-native", label: "Native Courts of Sarawak gateway", category: "Registry / agency", jurisdiction: "Sarawak", sourceId: "native-courts", summary: "Official Native Courts gateway for orientation and source discovery.", verifiedDate: "30 August 2026", status: "Verified current" },
  { id: "update-advocates", label: "Advocates Association public gateway", category: "Professional", jurisdiction: "Sarawak", sourceId: "sarawak-advocates", summary: "Professional association source kept distinct from official law and marked for verification.", verifiedDate: "30 August 2026", status: "Verification required" },
]);

export const PLAYBOOKS: readonly Playbook[] = Object.freeze([
  { id: "civil-application", title: "Civil application / affidavit pack", track: "Civil", jurisdiction: "Sarawak", status: "Practitioner-review template", sourceIds: ["sarawak-judiciary", "ekss-cmsa"], intake: ["Parties and capacity", "Matter type and relief sought", "Court / registry proposed", "Material facts and exhibits", "Service and urgency notes"], structure: ["Court heading and cause-paper fields", "Affidavit or submission working sections", "Exhibit index", "Filing and service checklist", "Editable practitioner notes"], riskFlags: ["Jurisdiction and forum not verified", "Deadline / limitation not calculated", "Authority and form version require review"] },
  { id: "criminal-pack", title: "Criminal representation / bail / mitigation pack", track: "Criminal", jurisdiction: "Sarawak", status: "Practitioner-review template", sourceIds: ["sarawak-judiciary", "ekss-cmsa"], intake: ["Accused details and charge as stated", "Court and registry", "Next mention / hearing date", "Instructions and supporting exhibits", "Requested outcome for lawyer review"], structure: ["Court heading", "Instruction and chronology notes", "Evidence / exhibit index", "Draft representation, bail, or mitigation headings", "Filing / service readiness list"], riskFlags: ["Charge and current procedure require verification", "No outcome or sentence is inferred", "Urgency and liberty risks require lawyer review"] },
  { id: "land-ncr", title: "Sarawak land / NCR transaction pack", track: "Conveyancing / land", jurisdiction: "Sarawak", status: "Practitioner-review template", sourceIds: ["land-survey", "sarawak-lawnet", "native-courts"], intake: ["Land title / category as stated", "Division and Land Registry", "Parties and capacity", "Instrument and transaction objective", "NCR or native-law issue flag", "Plans, searches, consents, and exhibits"], structure: ["Transaction fact sheet", "Title and registry verification log", "NCR issue map", "Instrument checklist", "Open questions and counsel sign-off"], riskFlags: ["Land category and title status not verified", "NCR status and evidence require specialist review", "Instrument, consent, fee, and timeline are not supplied by this template"] },
]);

export const CHECKLISTS: readonly Checklist[] = Object.freeze([
  { id: "civil-deadline", title: "Civil deadline and limitation check", jurisdiction: "Sarawak", sourceIds: ["sarawak-judiciary", "sarawak-lawnet"], items: ["Record cause of action and event dates", "Identify proposed court and registry", "Locate the current source instrument", "Check applicable rule, order, or direction", "Obtain lawyer sign-off before relying on any date"], deadlineNote: "No deadline is calculated in this preview; current law and registry practice must be checked for the matter." },
  { id: "criminal-readiness", title: "Criminal filing and hearing readiness", jurisdiction: "Sarawak", sourceIds: ["sarawak-judiciary", "ekss-cmsa"], items: ["Confirm court, registry, and next date from the file", "Record charge exactly as supplied", "List instructions and exhibits", "Check service / filing route with the registry", "Escalate liberty and urgency issues to counsel"], deadlineNote: "No filing window or procedural entitlement is stated here." },
  { id: "land-readiness", title: "Land / NCR verification checklist", jurisdiction: "Sarawak", sourceIds: ["land-survey", "sarawak-lawnet", "native-courts"], items: ["Confirm title, land category, division, and registry", "Identify any NCR / native-law issue", "Record searches, plans, consents, and exhibits", "Verify current instrument and subsidiary legislation", "Record unresolved gaps before drafting"], deadlineNote: "No fee, consent, or timeline is asserted; use the source links and obtain current advice." },
]);

export const DECISION_TREES: readonly DecisionTree[] = Object.freeze([
  { id: "land-ncr-tree", title: "Conveyancing / land and NCR issue triage", jurisdiction: "Sarawak", sourceIds: ["land-survey", "sarawak-lawnet", "native-courts"], questions: ["What land category and title information is recorded?", "Which Division and registry should be checked?", "Is a native customary rights issue expressly raised?", "Which current source instrument or official record answers the open question?", "Has a Sarawak practitioner reviewed the result?"], disclaimer: "Decision tree only. It routes verification questions and does not determine title, NCR status, consent, fee, or outcome." },
  { id: "court-path-tree", title: "Court and registry orientation", jurisdiction: "Sarawak", sourceIds: ["sarawak-judiciary", "ekss-cmsa"], questions: ["Is the matter civil, criminal, land, Native Court, or another track?", "Which court and registry are recorded in the instructions?", "Is the route public information or account-only?", "What current direction or registry confirmation is needed?", "Has filing and service been confirmed by counsel?"], disclaimer: "Orientation only. It does not select a forum or replace registry confirmation." },
]);

export const AUDIT = {
  reviewedOn: "30 August 2026",
  sourcesReviewed: SOURCES.length,
  verifiedCurrentAdditions: RESOURCES.filter((resource) => resource.status === "Verified current").length,
  sarawakSubstantiveReports: REPORTS.filter((report) => report.jurisdiction === "Sarawak" && report.status === "Published").length,
  publishedReports: REPORTS.filter((report) => report.status === "Published").length,
  accessRecords: REPORTS.filter((report) => report.status === "Access record").length,
  precedentsAdded: PLAYBOOKS.length,
  verificationGaps: COVERAGE.length + REPORTS.filter((report) => report.verificationGap).length,
} as const;

export const canPublish = (r: Pick<Report, "officialSourceVerified" | "paragraphSupportVerified" | "humanApproved">) =>
  r.officialSourceVerified && r.paragraphSupportVerified && r.humanApproved;
export const validatePublication = (r: Report) => r.status !== "Published" || canPublish(r);
export const allText = (r: Report) => JSON.stringify(r).toLowerCase();

const aliases: Record<string, string> = {
  sarawak: "sarawak swk borneo kuching miri sibu bintulu",
  native: "native adat bumiputera anak negeri tanah adat ncr pemakai menoa pulau",
  land: "land tanah tanah adat title hakmilik registry pejabat tanah",
  judgment: "judgment penghakiman keputusan",
  registry: "registry pendaftar pejabat pendaftaran mahkamah",
  conveyancing: "conveyancing pindah milik jual beli tanah",
  criminal: "criminal jenayah pertuduhan ikat jamin bail",
  civil: "civil sivil saman afidavit affidavit",
};

export function searchableText(r: Report) {
  const terms = r.practiceAreas.flatMap((area) => area.toLowerCase().split(/[^a-z]+/).map((word) => aliases[word] ?? "")).join(" ");
  return `${allText(r)} ${terms}`;
}

export function filterReports(records: readonly Report[], filters: Record<string, string>) {
  const jurisdiction = filters.jurisdiction || "Sarawak";
  return records.filter((r) => {
    if (jurisdiction === "Sarawak" && r.jurisdiction === "Malaysia") return false;
    if (jurisdiction === "Malaysia" && r.jurisdiction === "Sarawak") return false;
    return Object.entries(filters).every(([key, value]) => {
      if (!value || key === "jurisdiction") return true;
      const term = value.toLowerCase();
      if (key === "from") return r.isoDate >= value;
      if (key === "to") return r.isoDate <= value;
      if (key === "fullText" || key === "q") return searchableText(r).includes(term);
      const valueOf = key === "party" ? r.title
        : key === "case" ? `${r.title} ${r.citation}`
        : key === "practiceArea" ? r.practiceAreas.join(" ")
        : key === "catchwords" ? r.catchwords.join(" ")
        : (r as Record<string, unknown>)[key];
      return String(valueOf ?? "").toLowerCase().includes(term);
    });
  });
}

export function reportText(r: Report) {
  return r.report
    ? [`${r.title}\nStatus: ${r.status}\nJurisdiction: ${r.jurisdiction}\nLaw as at: ${r.lawAsAt}\nSource type: ${r.sourceType}\nOfficial source: ${r.sourcePublisher} — ${r.sourceUrl}\nCitation: ${r.citation}`, r.report.headnote, ...r.report.facts.map((x) => `${x.text} [${x.pinpoints.join(", ")}]`), ...r.report.proceduralHistory.map((x) => `${x.text} [${x.pinpoints.join(", ")}]`), ...r.report.issues.map((x) => `${x.issue}\n${x.holding} [${x.pinpoints.join(", ")}]`), ...r.report.ratio.map((x) => `${x.text} [${x.pinpoints.join(", ")}]`), ...r.report.obiter.map((x) => `${x.text} [${x.pinpoints.join(", ")}]`), `Orders: ${r.report.disposition.text}`, ...r.report.paragraphs.map((x) => `¶ ${x.number}: ${x.text}`)].join("\n\n")
    : `${r.title}\nStatus: Access record\nJurisdiction: ${r.jurisdiction}\nLaw as at: ${r.lawAsAt}\nSource type: ${r.sourceType}\nOfficial source collection: ${r.sourcePublisher} — ${r.sourceUrl}\nAccess record only. Editorial review pending.\nVerification gap: ${r.verificationGap}`;
}

export function exportRecords(records: readonly Report[]) {
  return records.map((r) => ({
    title: r.title, citation: r.citation, court: r.court, registry: r.registry, jurisdiction: r.jurisdiction,
    lawAsAt: r.lawAsAt, status: r.status, editorialStatus: r.editorialStatus, sourceType: r.sourceType,
    sourcePublisher: r.sourcePublisher, sourceUrl: r.sourceUrl, verificationGap: r.verificationGap,
    report: r.report ?? "Access record only — no substantive report.",
  }));
}