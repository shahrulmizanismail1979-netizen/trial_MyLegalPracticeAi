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
    description: "Draft cause papers, analyse case strategies, and navigate Malaysian civil procedure with an AI litigation assistant.",
    url: "/mylitai/",
    tag: "Litigation",
    availability: "live",
    subscribable: true,
    versions: [
      {
        label: "Standard",
        badge: "Version 1",
        url: "/mylitai/",
        description: "Classic AI litigation assistant for civil procedure, pleadings, case strategy, and court practice.",
      },
      {
        label: "IRAC Method",
        badge: "Version 2",
        url: "/mylitai-irac/",
        description: "Structured legal analysis using the IRAC framework for written submissions and advocacy.",
      },
    ],
  },
  { id: "syariah", title: "MySyalitAI", description: "Draft syarie pleadings, check Syariah procedure rules, and prepare submissions for Syariah Court matters.", url: "/mysyariahai/", tag: "Syariah", availability: "live", subscribable: true },
  { id: "corporate", title: "MyCorpAI", description: "Prepare board resolutions, manage Companies Act compliance, and handle corporate secretarial workflows.", url: "/mycorplegalai/", tag: "Corporate", availability: "live", subscribable: true },
  { id: "convey", title: "MyConveyLitAI", description: "Draft sale and purchase agreements, conduct land-title searches, and manage property transaction checklists.", url: "/myconveylitai/", tag: "Conveyancing", availability: "live", subscribable: true },
  { id: "criminal", title: "MyCrimAI", description: "Draft criminal submissions, research sentencing materials, and navigate criminal practice workflows.", url: "/mycrimai/", tag: "Criminal", availability: "live", subscribable: true },
  { id: "ccb", title: "MyCCBLitAI", description: "Handle corporate disputes, draft commercial agreements, and manage banking litigation matters.", url: "/myccblitai/", tag: "Corporate, Commercial & Banking", availability: "live", subscribable: true },
  { id: "accident", title: "MyAccidentAI", description: "Draft personal-injury claims, assess quantum materials, and manage running-down cases.", url: "/myaccidentai/", tag: "Accident & PI", availability: "live", subscribable: true },
  { id: "firm", title: "MyLawFirmAI", description: "Run firm operations with AI-triaged tasks, meeting minutes, staff recognition, goals, and voice-driven workflows.", url: "/mylawfirmai/", tag: "Firm Management", availability: "live" },
  { id: "acad", title: "MyLawAcad", description: "Plan lessons, draft assessments, conduct AI-proctored exams, and manage academic administration.", url: "/mylawacad/", tag: "Legal Education", availability: "live" },
  { id: "judicial", title: "MyJudicialAI", description: "Schedule hearings, draft judgments, prepare bench notes, and manage chambers administration.", url: "#", tag: "Judiciary", availability: "coming-soon" },
  { id: "client", title: "MyClientAI", description: "Handle client intake, manage case files, draft advisory notes, and track communication.", url: "#", tag: "Client Management", availability: "coming-soon" },
  { id: "research", title: "MyLawResearch", description: "Draft articles, manage citations, conduct literature reviews, and prepare journal submissions.", url: "#", tag: "Publications", availability: "coming-soon" },
];

export const LIVE_PORTALS = PORTAL_CATALOG.filter((portal) => portal.availability === "live");
export const COMING_SOON_PORTALS = PORTAL_CATALOG.filter((portal) => portal.availability === "coming-soon");
export const SELF_SERVICE_PORTALS = LIVE_PORTALS.filter((portal) => portal.subscribable);