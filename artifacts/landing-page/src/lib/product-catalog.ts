export type PortalVersion = {
  label: string;
  badge: string;
  url: string;
  description: string;
};

export type PortalCatalogEntry = {
  id: string;
  title: string;
  description: string;
  url: string;
  tag: string;
  availability: "live" | "coming-soon";
  subscribable?: boolean;
  versions?: PortalVersion[];
};

/**
 * The canonical landing-page portal catalogue. Availability is intentionally
 * separate from checkout eligibility: some live products use organisation or
 * academic access rather than the self-service single-app checkout.
 */
export const PORTAL_CATALOG: PortalCatalogEntry[] = [
  {
    id: "lit",
    title: "MyLitAI",
    description: "Organise civil-litigation material, prepare working cause-paper drafts, test case theories, and identify questions for lawyer review.",
    url: "/mylitai/",
    tag: "Litigation",
    availability: "live",
    subscribable: true,
    versions: [
      {
        label: "Standard",
        badge: "Version 1",
        url: "/mylitai/",
        description: "A general litigation workspace for organising pleadings, evidence, procedure questions, case strategy, and working court-document drafts.",
      },
      {
        label: "IRAC Method",
        badge: "Version 2",
        url: "/mylitai-irac/",
        description: "A structured issue, rule, application, and conclusion workspace for developing reviewable analysis, submissions, and advocacy preparation.",
      },
    ],
  },
  { id: "syariah", title: "MySyalitAI", description: "Structure Syariah matters, prepare working syarie cause papers and submissions, and surface jurisdiction-specific questions for qualified review.", url: "/mysyariahai/", tag: "Syariah", availability: "live", subscribable: true },
  { id: "corporate", title: "MyCorpAI", description: "Turn corporate instructions into working resolutions, agreements, approval steps, and compliance questions for legal and company-secretarial review.", url: "/mycorplegalai/", tag: "Corporate", availability: "live", subscribable: true },
  { id: "convey", title: "MyConveyLitAI", description: "Prepare working transaction documents, compare agreed terms, and organise due-diligence and completion material for conveyancing review.", url: "/myconveylitai/", tag: "Conveyancing", availability: "live", subscribable: true },
  { id: "criminal", title: "MyCrimAI", description: "Organise criminal briefs, prepare working questions and submissions, and review supplied charge, evidence, sentencing, and appeal material.", url: "/mycrimai/", tag: "Criminal", availability: "live", subscribable: true },
  { id: "ccb", title: "MyCCBLitAI", description: "Map corporate, commercial, and banking disputes; compare contracts and evidence; and prepare working correspondence, analysis, and strategy material.", url: "/myccblitai/", tag: "Corporate, Commercial & Banking", availability: "live", subscribable: true },
  { id: "accident", title: "MyAccidentAI", description: "Organise accident evidence and medical chronology, prepare working personal-injury documents, and structure liability and quantum review.", url: "/myaccidentai/", tag: "Accident & PI", availability: "live", subscribable: true },
  { id: "firm", title: "MyLawFirmAI", description: "Structure firm tasks, meetings, action items, goals, evidence, and internal briefings while keeping final assignments and decisions with the team.", url: "/mylawfirmai/", tag: "Firm Management", availability: "live" },
  { id: "acad", title: "MyLawAcad", description: "Prepare reviewable lesson, assessment, rubric, and academic-administration material for educator moderation and institutional sign-off.", url: "/mylawacad/", tag: "Legal Education", availability: "live" },
  { id: "judicial", title: "MyJudicialAI", description: "Planned support for organising hearing material, bench notes, working judgment structure, schedules, and chambers administration.", url: "#", tag: "Judiciary", availability: "coming-soon" },
  { id: "client", title: "MyClientAI", description: "Planned support for structuring client intake, file information, working advisory notes, and communication records for professional review.", url: "#", tag: "Client Management", availability: "coming-soon" },
  { id: "research", title: "MyLawResearch", description: "Planned support for organising literature, citations, article drafts, review questions, and journal-submission preparation.", url: "#", tag: "Publications", availability: "coming-soon" },
];

export const LIVE_PORTALS = PORTAL_CATALOG.filter((portal) => portal.availability === "live");
export const COMING_SOON_PORTALS = PORTAL_CATALOG.filter((portal) => portal.availability === "coming-soon");
export const SELF_SERVICE_PORTALS = LIVE_PORTALS.filter((portal) => portal.subscribable);