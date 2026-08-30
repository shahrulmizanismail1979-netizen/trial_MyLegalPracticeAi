import verified from "./lawyes-verified-reports.json";

export const NOT_STATED = "Not stated in the published judgment";
export type Status = "Access record" | "Lawyer reviewed" | "Published";
export type Pinpoint = { number: string; text: string };
type VerifiedReport = (typeof verified)[keyof typeof verified]["report"];
export type Report = Readonly<{
  id: string; title: string; citation: string; court: string; registry: string; date: string;
  isoDate: string; coram: string; counsel: string; legislation: string; issue: string; outcome: string; treatment: string;
  practiceAreas: readonly string[]; catchwords: readonly string[];
  sourcePublisher: string; sourceUrl: string; status: Status; officialSourceVerified: boolean;
  paragraphSupportVerified: boolean; humanApproved: boolean; reviewer: string; verificationDate: string;
  revisionHistory: readonly string[]; report?: VerifiedReport;
}>;

export const GATEWAYS = [
  ["Malaysian Judiciary eJudgment", "https://ejudgment.kehakiman.gov.my/ejudgmentweb/searchpage.aspx?JurisdictionType=ALL"],
  ["e-Kehakiman Sabah & Sarawak", "https://ekss-portal.kehakiman.gov.my/portals/web/home/list_judgment/"],
  ["Industrial Court Full Awards", "https://www.mp.gov.my/fullawards/searchFullAwards.php"],
  ["JAKESS", "https://www.jakess.gov.my/rujukan/koleksi-penghakiman"],
  ["Native Court of Appeal", "https://ekss-portal.kehakiman.gov.my/portals/web/home/list_native_judgment"],
  ["Judiciary Digital Repository", "https://eprints.kehakiman.gov.my/"],
] as const;
const gateway = (publisher: string) => GATEWAYS.find(([n]) => n === publisher)?.[1] ?? GATEWAYS[5][1];
const pending = (id: string, title: string, court: string, isoDate: string, area: string, publisher: string, citation = ""): Report => ({
  id, title, citation, court, registry: NOT_STATED, date: isoDate, coram: NOT_STATED, counsel: NOT_STATED,
  isoDate, legislation: NOT_STATED, issue: NOT_STATED, outcome: NOT_STATED, treatment: NOT_STATED,
  practiceAreas: [area], catchwords: [area], sourcePublisher: publisher, sourceUrl: gateway(publisher),
  status: "Access record", officialSourceVerified: false, paragraphSupportVerified: false, humanApproved: false,
  reviewer: "Pending editorial review", verificationDate: NOT_STATED, revisionHistory: ["Access record indexed; editorial review pending."],
});
const substantive = (item: typeof verified.lee | typeof verified.arsit): Report => ({
  id: item.id, title: item.title, citation: item.report.citation, court: item.report.court, registry: item.report.registry, isoDate: item.id === "lee-khoon-hoo" ? "2021-11-15" : "2024-04-29",
  date: item.report.decisionDate, coram: item.report.coram, counsel: item.report.counsel,
  legislation: item.report.legislation.join("; "), issue: item.report.issues.map(x => x.issue).join("; "), outcome: item.report.disposition.text, treatment: item.report.authorities.map(x => x.treatment).join("; "),
  practiceAreas: item.report.practiceAreas, catchwords: item.report.catchwords, sourcePublisher: item.sourcePublisher,
  sourceUrl: item.sourceUrl, status: "Published", officialSourceVerified: true, paragraphSupportVerified: true,
  humanApproved: true, reviewer: "LAWYes preview legal review", verificationDate: "29 August 2026",
  revisionHistory: ["29 August 2026 — lawyer review recorded for preview fixture.", "29 August 2026 — official source and paragraph support verified for preview fixture."],
  report: item.report,
});
export const REPORTS: readonly Report[] = Object.freeze([
  substantive(verified.lee),
  pending("daljinder", "Daljinder Singh v Amardeep Singh as Administrator", "High Court of Malaya", "2021-12-02", "Civil", "Malaysian Judiciary eJudgment", "LBN-31NCvC-9/10-2016"),
  pending("tee-guan-pian", "Datuk Tee Guan Pian v David Wong & Anor", "High Court of Sabah and Sarawak", "2022-09-29", "Land", "e-Kehakiman Sabah & Sarawak", "BKI-23NCvC-1/3-2022"),
  pending("investasia", "Investasia v NTSJ Construction", "High Court of Sabah and Sarawak", "2022-11-24", "Construction", "e-Kehakiman Sabah & Sarawak", "BKI-24C-5/7-2022"),
  pending("liew-tham-fook", "Liew Tham Fook v Liew Vui Lin", "High Court of Sabah and Sarawak", "2022-10-26", "Civil", "e-Kehakiman Sabah & Sarawak", "BKI-22NCvC-81/11-2021"),
  pending("arab-malaysian", "Arab-Malaysian Credit v Nationwide Industries", "High Court of Malaya", "2021-09-24", "Banking", "Malaysian Judiciary eJudgment", "K22-36-1998"),
  pending("hanzac-bintang", "Hanzac Bintang v Ma Ping", "High Court of Sabah and Sarawak", "2024-01-25", "Contract", "e-Kehakiman Sabah & Sarawak", "BKI-22NCvC-16/2-2020"),
  pending("sing-yung", "Sing Yung Steel v MSIG", "High Court of Sabah and Sarawak", "2021-10-20", "Insurance", "e-Kehakiman Sabah & Sarawak", "BKI-22NCvC-67/8-2019"),
  pending("mohamed-ali", "Mohamed Ali v Sabah Forest Industries", "High Court of Sabah and Sarawak", "2021-11-15", "Employment", "e-Kehakiman Sabah & Sarawak", "BKI-28NCC-29/6-2017"),
  pending("pp-maidin", "Public Prosecutor v Maidin", "High Court of Sabah and Sarawak", "2022-09-27", "Criminal", "e-Kehakiman Sabah & Sarawak", "LBN-45B-2/8-2019"),
  substantive(verified.arsit),
  pending("tan-wu-huei", "Tan Wu Huei", "Industrial Court of Malaysia", "2026-08-20", "Industrial Relations", "Industrial Court Full Awards", "1470/2026"),
  pending("vijayarani", "Vijayarani", "Industrial Court of Malaysia", "2026-08-19", "Industrial Relations", "Industrial Court Full Awards", "1466/2026"),
  pending("nandy-marlina", "Nandy Marlina", "Industrial Court of Malaysia", "2026-08-19", "Industrial Relations", "Industrial Court Full Awards", "1464/2026"),
  pending("tsen-vun-foo", "Tsen Vun Foo", "Industrial Court of Malaysia", "2026-08-18", "Industrial Relations", "Industrial Court Full Awards", "1451/2026"),
  pending("eileen-lee", "Eileen Lee", "Industrial Court of Malaysia", "2026-08-18", "Industrial Relations", "Industrial Court Full Awards", "1447/2026"),
  pending("jakess-shma", "JAKESS SHMA v RBA", "Selangor Syariah Court of Appeal", "2021-03-01", "Syariah", "JAKESS", "10000-077-0045-2020"),
  pending("mais-al-anand", "MAIS v Al-Anand Babu", "Selangor Syariah Court of Appeal", "2025-05-20", "Syariah", "JAKESS", "2401-A0010-001-0007"),
]);
export const canPublish = (r: Pick<Report, "officialSourceVerified" | "paragraphSupportVerified" | "humanApproved">) =>
  r.officialSourceVerified && r.paragraphSupportVerified && r.humanApproved;
export const validatePublication = (r: Report) => r.status !== "Published" || canPublish(r);
export const allText = (r: Report) => JSON.stringify(r).toLowerCase();
export function filterReports(records: readonly Report[], filters: Record<string, string>) {
  return records.filter(r => Object.entries(filters).every(([key, value]) => {
    if (!value) return true; const term = value.toLowerCase();
    if (key === "fullText") return allText(r).includes(term);
    if (key === "from") return r.isoDate >= value;
    if (key === "to") return r.isoDate <= value;
    const valueOf = key === "party" ? r.title : key === "case" ? `${r.title} ${r.citation}` : key === "practiceArea" ? r.practiceAreas.join(" ") : key === "catchwords" ? r.catchwords.join(" ") : (r as Record<string, unknown>)[key];
    return String(valueOf ?? "").toLowerCase().includes(term);
  }));
}
export function reportText(r: Report) { return r.report ? [`${r.title}\nStatus: ${r.status}\nOfficial source: ${r.sourcePublisher} — ${r.sourceUrl}\nCitation: ${r.citation}`, r.report.headnote, ...r.report.facts.map(x => `${x.text} [${x.pinpoints.join(", ")}]`), ...r.report.issues.map(x => `${x.issue}\n${x.holding} [${x.pinpoints.join(", ")}]`), ...r.report.ratio.map(x => `${x.text} [${x.pinpoints.join(", ")}]`), ...r.report.paragraphs.map(x => `¶ ${x.number}: ${x.text}`)].join("\n\n") : `${r.title}\nStatus: Access record\nOfficial source collection: ${r.sourcePublisher} — ${r.sourceUrl}\nAccess record only. Editorial review pending.`; }
export function exportRecords(records: readonly Report[]) { return records.map(r => ({ title: r.title, citation: r.citation, court: r.court, status: r.status, sourcePublisher: r.sourcePublisher, sourceUrl: r.sourceUrl, report: r.report ?? "Access record only — no substantive report." })); }