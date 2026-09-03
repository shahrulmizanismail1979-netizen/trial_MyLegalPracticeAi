export type CapabilityReadiness =
  | "Available in LAWYes preview"
  | "Implemented; adapter required"
  | "Implemented; integration required"
  | "Implemented; verification pending";

export type CapabilityCategory =
  | "Litigation"
  | "IRAC"
  | "Conveyancing"
  | "Corporate"
  | "Criminal"
  | "Syariah"
  | "Banking litigation"
  | "Accident"
  | "Research"
  | "Education"
  | "Firm management";

export type Capability = Readonly<{
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  currentService: string;
  serviceRoutes: readonly string[];
  requiredInputs: readonly string[];
  outputTypes: readonly string[];
  permissions: string;
  verification: string;
  readiness: CapabilityReadiness;
  authModel: string;
  ownershipModel: string;
  adapterBoundary: string;
  examples: readonly string[];
  keywords: readonly string[];
  workspaceDestination?: "search" | "draft" | "matter" | "practice";
}>;

export const REQUIRED_CAPABILITY_CATEGORIES: readonly CapabilityCategory[] = Object.freeze([
  "Litigation",
  "IRAC",
  "Conveyancing",
  "Corporate",
  "Criminal",
  "Syariah",
  "Banking litigation",
  "Accident",
  "Research",
  "Education",
  "Firm management",
]);

const LOCAL_PREVIEW_ROUTE = /^Local .+; no production request$/;

export function validateCapabilityRegistry(
  capabilities: readonly Capability[],
  registeredRouteFamilies: ReadonlySet<string>,
): readonly string[] {
  const errors: string[] = [];
  const categories = new Set(capabilities.map((capability) => capability.category));

  for (const category of REQUIRED_CAPABILITY_CATEGORIES) {
    if (!categories.has(category)) {
      errors.push(`Missing required LAWYes practice area: ${category}`);
    }
  }

  for (const capability of capabilities) {
    const isPreviewLocal = capability.readiness === "Available in LAWYes preview";
    const localRoutes = capability.serviceRoutes.filter((route) => LOCAL_PREVIEW_ROUTE.test(route));
    const specialistRoutes = capability.serviceRoutes.filter((route) => route.startsWith("/api/"));

    if (capability.workspaceDestination && !isPreviewLocal) {
      errors.push(
        `${capability.id}: preview action "${capability.workspaceDestination}" is only allowed for browser-local capabilities`,
      );
    }
    if (isPreviewLocal && !capability.workspaceDestination) {
      errors.push(`${capability.id}: browser-local preview capability must declare a preview action`);
    }
    if (isPreviewLocal && localRoutes.length !== capability.serviceRoutes.length) {
      errors.push(`${capability.id}: preview-ready capability may only use browser-local service routes`);
    }
    if (!isPreviewLocal && localRoutes.length > 0) {
      errors.push(`${capability.id}: adapter-bound capability cannot claim a browser-local service route`);
    }
    if (capability.adapterBoundary.trim().length === 0) {
      errors.push(`${capability.id}: capability must state its LAWYes adapter boundary`);
    }
    if (!isPreviewLocal && specialistRoutes.length === 0) {
      errors.push(`${capability.id}: ${capability.readiness} capability must register a specialist API route`);
    }

    for (const route of specialistRoutes) {
      const routeFamily = route.replace(/\/\*$/, "");
      const segments = routeFamily.split("/").filter(Boolean);
      const familyDepth = segments[1] === "lit" || segments[1] === "firm" ? 3 : 2;
      const contractFamily = `/${segments.slice(0, familyDepth).join("/")}`;
      if (!registeredRouteFamilies.has(contractFamily)) {
        errors.push(`${capability.id}: registered specialist route family is missing from the server router surface: ${route}`);
      }
    }
  }

  return errors;
}

export const CAPABILITY_REGISTRY: readonly Capability[] = Object.freeze([
  {
    id: "lawyes-reviewed-research",
    name: "Reviewed case-law discovery",
    description: "Search the reviewed judgments and access records included in this LAWYes preview.",
    category: "Research",
    currentService: "LAWYes Safe Preview",
    serviceRoutes: ["Local reviewed fixtures; no production request"],
    requiredInputs: ["Question, party, case, citation, court, date, or subject filters"],
    outputTypes: ["Search results", "Judgment reader", "Source and verification record"],
    permissions: "No authentication in this standalone preview.",
    verification: "Only records marked Published contain substantive reports; access records remain non-substantive until editorial review.",
    readiness: "Available in LAWYes preview",
    authModel: "Standalone browser-only preview",
    ownershipModel: "No account, server persistence, or matter ownership",
    adapterBoundary: "Production research uses staff-only Clerk and research-role access; this preview does not bypass that boundary.",
    examples: ["Find reviewed Sarawak judgments about land", "Show criminal access records that still need verification"],
    keywords: ["case", "cases", "judgment", "citation", "authority", "research", "find", "law", "precedent", "statute"],
    workspaceDestination: "search",
  },
  {
    id: "lawyes-practitioner-templates",
    name: "Practitioner-review template packs",
    description: "Create local civil, criminal, and Sarawak land/NCR working templates from reviewed preview playbooks.",
    category: "Litigation",
    currentService: "LAWYes Safe Preview",
    serviceRoutes: ["Local template generator; no production request"],
    requiredInputs: ["Selected pack", "Client or matter reference", "Pack-specific instructions", "Safeguard acknowledgements"],
    outputTypes: ["Editable practitioner-review template", "TXT", "DOCX", "Print view"],
    permissions: "No authentication in this standalone preview.",
    verification: "A qualified practitioner must verify facts, authorities, forms, deadlines, fees, and filing requirements before use.",
    readiness: "Available in LAWYes preview",
    authModel: "Standalone browser-only preview",
    ownershipModel: "Generated text remains in the current browser session",
    adapterBoundary: "This is a conservative local template, not the specialist portals' AI drafting service.",
    examples: ["Prepare a civil application working pack", "Create criminal hearing preparation notes", "Map documents for a Sarawak land issue"],
    keywords: ["draft", "template", "affidavit", "civil", "criminal", "land", "ncr", "application", "hearing", "document"],
    workspaceDestination: "draft",
  },
  {
    id: "litigation-ai-toolkit",
    name: "Litigation analysis and drafting toolkit",
    description: "Implemented specialist tools cover briefs, pleadings review, opinions, affidavits, cross-examination, quantum, hearing preparation, costs, settlement, limitation, and cause-of-action analysis.",
    category: "Litigation",
    currentService: "MyLitAI",
    serviceRoutes: ["/api/lit/ai/*", "/api/lit/matters", "/api/lit/saved-work", "/api/lit/uploads"],
    requiredInputs: ["Tool-specific facts and questions", "Party and court details where applicable", "Optional documents or matter context"],
    outputTypes: ["Streamed or JSON legal analysis", "Draft legal text", "Matter work", "Exports"],
    permissions: "Litigation session is required; most generation routes also require an active subscription.",
    verification: "Generated text and every authority must be checked by a qualified Malaysian Advocate & Solicitor before reliance or filing.",
    readiness: "Implemented; adapter required",
    authModel: "Litigation access-code/cookie session with subscription checks",
    ownershipModel: "Matters and saved work are scoped to the authenticated litigation identity",
    adapterBoundary: "LAWYes must exchange identity and preserve litigation owner scope; it must not reuse another portal's session or owner key.",
    examples: ["Review this pleading", "Prepare cross-examination topics", "Estimate litigation costs from these facts"],
    keywords: ["litigation", "pleading", "affidavit", "cross examination", "hearing", "costs", "settlement", "limitation", "cause of action", "quantum"],
  },
  {
    id: "irac-case-workspace",
    name: "IRAC case workspace",
    description: "Implemented extraction, issue spotting, research, application, opinion, analysis, drafting, chat, and transcription tools use the IRAC service.",
    category: "IRAC",
    currentService: "MyLitAI IRAC",
    serviceRoutes: ["/api/lit/irac/extract", "/api/lit/irac/issues", "/api/lit/irac/research", "/api/lit/irac/application", "/api/lit/irac/opinion", "/api/lit/irac/analyze", "/api/lit/irac/draft", "/api/lit/irac/chat"],
    requiredInputs: ["Case or uploaded document", "Pathway and requested mode", "Instructions or legal issue", "Optional matter context"],
    outputTypes: ["Extracted text", "Issues", "Research", "Application analysis", "Opinion", "Draft", "Chat with citations"],
    permissions: "Litigation authentication applies; generation paths may require an active subscription.",
    verification: "Citations, sections, forms, deadlines, fees, and drafts require primary-source and practitioner verification.",
    readiness: "Implemented; adapter required",
    authModel: "Shared MyLitAI litigation session",
    ownershipModel: "IRAC work is governed by litigation matter/session ownership",
    adapterBoundary: "The LAWYes adapter must retain the litigation identity and must not imply that generated work has been filed into a matter.",
    examples: ["Extract the issues from these pleadings", "Apply the authorities to the disputed facts", "Draft an IRAC opinion"],
    keywords: ["irac", "issue", "rule", "application", "conclusion", "opinion", "analyze", "analysis", "case workspace"],
  },
  {
    id: "conveyancing-workspace",
    name: "Conveyancing forms, drafting, and matters",
    description: "Implemented conveyancing workflows include forms, AI drafting, case-law search, document extraction, DOCX export, text-to-speech, and matter work.",
    category: "Conveyancing",
    currentService: "MyConveyLitAI",
    serviceRoutes: ["/api/convey/*", "/api/convey/export-docx"],
    requiredInputs: ["Selected form or workflow", "Transaction facts and parties", "Optional document upload", "Optional matter"],
    outputTypes: ["Generated legal text", "Extracted text", "DOCX", "Audio", "Matter records"],
    permissions: "A valid conveyancing account/session and active subscription are required for gated operations.",
    verification: "A lawyer must verify land records, forms, instruments, citations, and transaction requirements against current primary sources.",
    readiness: "Implemented; adapter required",
    authModel: "Conveyancing bearer/session authentication with subscription gate",
    ownershipModel: "Conveyancing user and matter ownership",
    adapterBoundary: "Its credential model is incompatible with cookie-session portals; upload ownership must be carried explicitly.",
    examples: ["Draft from these conveyancing facts", "Extract this land document", "Export the working draft to DOCX"],
    keywords: ["conveyancing", "land", "property", "transaction", "transfer", "form", "instrument", "docx"],
  },
  {
    id: "corporate-legal-workspace",
    name: "Corporate legal analysis and drafting",
    description: "An implemented corporate chat/tool service accepts prompts and matter context, with stored-document extraction, matters, clients, billing, and saved work.",
    category: "Corporate",
    currentService: "MyCorpLegalAI",
    serviceRoutes: ["/api/corp/legal/ai-tools/chat", "/api/corp/legal/uploads/*", "/api/corp/matters", "/api/corp/clients"],
    requiredInputs: ["Tool or chat instruction", "Corporate facts", "Optional matter context", "Optional stored upload"],
    outputTypes: ["AI legal text", "Extracted document text", "Matter and client records", "Saved work"],
    permissions: "A corporate session and applicable subscription entitlement are required.",
    verification: "Professional review and primary-source verification are required for corporate legal output.",
    readiness: "Implemented; verification pending",
    authModel: "Corporate password or SSO cookie session",
    ownershipModel: "Corporate session scopes matters, clients, and work",
    adapterBoundary: "Stored-upload ownership persistence is not yet proven across restarts, so LAWYes must not route private uploads until that boundary is verified.",
    examples: ["Analyze this corporate document", "Draft from these company facts", "Use this matter as context"],
    keywords: ["corporate", "company", "director", "shareholder", "agreement", "resolution", "business", "client"],
  },
  {
    id: "criminal-ai-toolkit",
    name: "Criminal practice AI toolkit",
    description: "Implemented tools cover research, case and charge analysis, drafting, cross-examination, witness and judge practice, sentencing, opinions, strategy, and appeal grounds.",
    category: "Criminal",
    currentService: "MyCrimAI",
    serviceRoutes: ["/api/crim/ai/*"],
    requiredInputs: ["Tool-specific questions and facts", "Charge or case details", "Witness, document, or sentencing details where applicable"],
    outputTypes: ["Research", "Case or charge analysis", "Draft document", "Practice feedback", "Opinion or strategy"],
    permissions: "A valid criminal-practice session, active entitlement, and seat are required.",
    verification: "Counsel must verify facts, citations, procedure, and all draft text before use.",
    readiness: "Implemented; verification pending",
    authModel: "Criminal access-code/SSO cookie session with seat and expiry enforcement",
    ownershipModel: "Criminal session identity; not every AI tool is currently proven to file into a matter",
    adapterBoundary: "LAWYes must preserve the criminal owner and cannot promise save-to-matter for every tool.",
    examples: ["Analyze these charges", "Prepare cross-examination questions", "Suggest appeal grounds for lawyer review"],
    keywords: ["criminal", "charge", "sentencing", "appeal", "cross examination", "witness", "strategy", "prosecution", "defence"],
  },
  {
    id: "syariah-ai-workspace",
    name: "Syariah research, analysis, and drafting",
    description: "Implemented tools include smart search, kitab and tafsir analysis, legal opinions, document and cause-paper drafting, intake briefs, compliance analysis, voice, and conversations.",
    category: "Syariah",
    currentService: "MySyalitAI",
    serviceRoutes: ["/api/sya/smart-search", "/api/sya/kitab-analysis", "/api/sya/legal-opinion", "/api/sya/document-generator", "/api/sya/client-intake", "/api/sya/compliance-check", "/api/sya/cause-papers", "/api/sya/tafsir", "/api/sya/voice", "/api/sya/gemini"],
    requiredInputs: ["Question, facts, or client intake", "Selected sources or template where applicable", "Optional text or audio"],
    outputTypes: ["Search results", "Structured analysis", "Legal opinion", "Draft document or cause paper", "Audio or conversation response"],
    permissions: "A valid Syariah session, active code/seat, and applicable tier are required.",
    verification: "A qualified Syariah practitioner must verify sources, citations, facts, and drafts.",
    readiness: "Implemented; verification pending",
    authModel: "Syariah access-code/account/SSO cookie session",
    ownershipModel: "Syariah session and matter ownership",
    adapterBoundary: "Matter filing exists but browser end-to-end filing is not yet proven; LAWYes must not claim successful filing.",
    examples: ["Search for sources relevant to this Syariah issue", "Prepare a client intake brief", "Draft cause papers for review"],
    keywords: ["syariah", "kitab", "tafsir", "cause paper", "compliance", "islamic", "intake", "hukum"],
  },
  {
    id: "banking-litigation-workspace",
    name: "Corporate and banking litigation workspace",
    description: "The implemented workspace exposes strategy, chat, calculators, references, case-law, matters, and specialist tools.",
    category: "Banking litigation",
    currentService: "MyCorpCommBankLitAI",
    serviceRoutes: ["/api/ccb/*", "Shared corporate/litigation services behind the workspace"],
    requiredInputs: ["Selected tool", "Commercial or banking facts", "Calculator values", "Optional matter and files"],
    outputTypes: ["AI response", "Strategy", "Calculator result", "Reference material", "Matter work"],
    permissions: "A valid CCB access-code or SSO session and applicable entitlement are required.",
    verification: "A lawyer must verify legal output, references, calculations, and underlying financial records.",
    readiness: "Implemented; verification pending",
    authModel: "CCB access-code/SSO cookie session",
    ownershipModel: "CCB tenant identity with shared underlying services",
    adapterBoundary: "The shared-service owner mapping and subscriber chat isolation must be verified before a LAWYes adapter is enabled.",
    examples: ["Build a banking litigation strategy", "Run the available calculator from these values", "Research authorities for this commercial dispute"],
    keywords: ["banking", "commercial", "bank", "loan", "facility", "calculator", "foreclosure", "debt", "strategy"],
  },
  {
    id: "accident-claims-workspace",
    name: "Accident analysis, damages, and drafting",
    description: "Implemented accident tools provide assistant chat, case analysis, damages support, drafting, matters, deadlines, and work files.",
    category: "Accident",
    currentService: "MyAccidentAI",
    serviceRoutes: ["/api/accident/ai/chat", "/api/accident/ai/analyze-case", "/api/accident/matters"],
    requiredInputs: ["Question or case facts", "Optional conversation history", "Optional matter context"],
    outputTypes: ["AI response", "Structured case analysis", "Damages support", "Draft text", "Matter records"],
    permissions: "A valid accident access-code session and seat are required.",
    verification: "A lawyer must verify medical facts, authorities, calculations, and generated legal text.",
    readiness: "Implemented; verification pending",
    authModel: "Accident session_id cookie resolved from access-code login",
    ownershipModel: "Accident tenant owner; master sessions use a distinct synthetic tenant",
    adapterBoundary: "LAWYes must map normal and master ownership deliberately and cannot assume cross-portal upload ownership.",
    examples: ["Analyze this accident claim", "Discuss damages from these injuries", "Draft from this matter context"],
    keywords: ["accident", "injury", "damages", "medical", "collision", "claim", "quantum", "motor"],
  },
  {
    id: "secure-research-repository",
    name: "Secure legal research repository",
    description: "Implemented staff tools cover search, judgment reading, quotations, citations, annotations, comparisons, authority tables, case analysis, and headnotes.",
    category: "Research",
    currentService: "Case Law Research",
    serviceRoutes: ["/api/research/search", "/api/research/judgments/*", "/api/research/workspace/*", "/api/research/analysis/*", "/api/research/authorities/*"],
    requiredInputs: ["Search query and filters", "Permitted judgment or container", "Workspace or analysis instructions"],
    outputTypes: ["Search and judgment data", "Exact quotations", "Workspace records", "Draft analysis", "Headnotes and authority data"],
    permissions: "Clerk staff authentication, active research role, and per-container ACL are required.",
    verification: "AI analysis and authority treatment remain drafts until the explicit legal-review lifecycle approves them.",
    readiness: "Implemented; adapter required",
    authModel: "Clerk staff plus research_users role and CSRF protection",
    ownershipModel: "Per-container view/process restrictions and private staff workspaces",
    adapterBoundary: "Ordinary portal identities cannot be treated as research staff; invisible containers must remain invisible.",
    examples: ["Search permitted judgments", "Collect exact quotations", "Compare approved authorities"],
    keywords: ["repository", "research", "judgment", "quotation", "citation", "headnote", "authority", "annotation"],
  },
  {
    id: "research-publication-pipeline",
    name: "Research ingestion and legal-review pipeline",
    description: "Implemented operational tools register sources, extract and segment documents, validate rights, classify sections, review AI analysis, and publish approved material.",
    category: "Research",
    currentService: "Case Law Research and Research Admin",
    serviceRoutes: ["/api/research/*", "/api/research-admin/*"],
    requiredInputs: ["Registered source and file metadata", "Container or section", "Rights and editorial decisions"],
    outputTypes: ["Processing jobs", "Validation records", "Rights records", "Editorial revisions", "Published or restricted content"],
    permissions: "Research roles govern legal/rights actions; the separate password admin session does not grant legal sign-off.",
    verification: "Rights and legal review are mandatory at defined transitions; publication is bound to an approved content revision.",
    readiness: "Implemented; adapter required",
    authModel: "Clerk research roles plus a separate password-authenticated admin console",
    ownershipModel: "Restricted containers, immutable revisions, and role-specific approvals",
    adapterBoundary: "The password admin and Clerk legal-review identities are intentionally incompatible and must never be merged implicitly.",
    examples: ["Register an authorised source batch", "Review extracted sections", "Approve a specific analysis revision"],
    keywords: ["ingest", "extract", "segment", "rights", "editorial", "publish", "approval", "research admin"],
  },
  {
    id: "legal-education-generation",
    name: "Study guides and flashcards",
    description: "Public rate-limited endpoints generate study guides and flashcards for implemented academic app topics.",
    category: "Education",
    currentService: "MyLawAcad",
    serviceRoutes: ["/api/acad/apps/:slug/study-guide", "/api/acad/apps/:slug/flashcards"],
    requiredInputs: ["Academic app slug", "Topic, focus, or request fields"],
    outputTypes: ["Study guide", "Flashcards"],
    permissions: "Public generation is IP-rate-limited.",
    verification: "Educational output is AI-generated and is not automatically teacher-approved or suitable as legal advice.",
    readiness: "Implemented; integration required",
    authModel: "Public IP-rate-limited generation",
    ownershipModel: "No shared LAWYes user ownership contract",
    adapterBoundary: "LAWYes needs an abuse-safe routing contract before exposing public generation in an authenticated workspace.",
    examples: ["Create a study guide for this topic", "Generate flashcards from this focus area"],
    keywords: ["study", "guide", "flashcards", "education", "academic", "student", "learn", "revision"],
  },
  {
    id: "legal-exam-workspace",
    name: "Legal assessment and exam workspace",
    description: "Implemented candidate and teacher flows cover exam creation, materials, questions, rubrics, attempts, AI grading, marking, sign-off, analytics, and proctoring.",
    category: "Education",
    currentService: "MyLawAcad",
    serviceRoutes: ["/api/acad/exams/*", "/api/acad/studio/*", "/api/acad/templates/*"],
    requiredInputs: ["Exam or template", "Materials, questions, and rubrics", "Candidate answer or upload", "Attempt token for candidate actions"],
    outputTypes: ["Exam content", "Generated questions or rules", "Scores and feedback", "Marking/sign-off records", "Proctor records"],
    permissions: "Teachers/admins use acad sessions; candidates use scoped attempt tokens.",
    verification: "AI grading exposes confidence and supports teacher marking/sign-off; it is not universally human-approved by default.",
    readiness: "Implemented; adapter required",
    authModel: "Acad user session plus separate X-Attempt-Token candidate capability",
    ownershipModel: "Assessment ownership and attempt-scoped candidate access",
    adapterBoundary: "LAWYes must not exchange a lawyer session for a candidate token or teacher/admin authority.",
    examples: ["Build an assessment blueprint", "Mark this candidate attempt", "Review proctor events"],
    keywords: ["exam", "assessment", "candidate", "rubric", "marking", "grading", "proctor", "question"],
  },
  {
    id: "firm-work-management",
    name: "Firm tasks, goals, meetings, and team insights",
    description: "Implemented firm tools manage tasks, evidence, collaborators, goals/KPIs, meetings, action extraction, dashboards, activity, recognition, and AI briefings.",
    category: "Firm management",
    currentService: "MyLawFirmAi",
    serviceRoutes: ["/api/firm/tasks/*", "/api/firm/goals/*", "/api/firm/meetings/*", "/api/firm/dashboard", "/api/firm/ai-briefing", "/api/firm/recognition/*"],
    requiredInputs: ["Task, goal, meeting, or briefing data", "Acting user where required", "Manager decision for controlled actions"],
    outputTypes: ["Tasks and activity", "Goals and KPIs", "Minutes and action items", "Dashboards", "AI briefing", "DOCX or Google Doc export"],
    permissions: "Firm session is required; manager verification protects assessments, evidence removal, dashboards, and controlled mutations.",
    verification: "AI triage/briefings require human review; exports depend on configured document integrations.",
    readiness: "Implemented; integration required",
    authModel: "Signed firm staff or manager cookie with seat and expiry checks",
    ownershipModel: "Staff access-code identity or verified manager identity",
    adapterBoundary: "LAWYes needs a firm-role adapter; a practice-portal subscriber must not inherit manager permissions.",
    examples: ["Triage this task", "Turn meeting actions into tasks", "Summarize team risks for a manager"],
    keywords: ["firm", "task", "goal", "kpi", "meeting", "minutes", "team", "dashboard", "briefing", "recognition"],
  },
  {
    id: "firm-operations",
    name: "Firm HR, accounts, voice, and document ingest",
    description: "Implemented firm operations cover employee self-service, leave, attendance, payroll, budgets, ledgers, financial reports, voice transcription, and task ingest.",
    category: "Firm management",
    currentService: "MyLawFirmAi",
    serviceRoutes: ["/api/firm/hr/*", "/api/firm/accounts/*", "/api/firm/voice/parse", "/api/firm/ingest/*"],
    requiredInputs: ["HR or finance records and filters", "Audio/transcript or supported ingest material", "Manager authority for controlled operations"],
    outputTypes: ["HR and payroll records", "Budgets, ledgers, and reports", "PDFs", "Transcript and task drafts"],
    permissions: "Firm session is required; accounts and administrative HR operations require a verified manager.",
    verification: "Managers must review financial, payroll, and extracted task data; transcription and external ingest require configured integrations.",
    readiness: "Implemented; integration required",
    authModel: "Signed firm staff or manager cookie",
    ownershipModel: "Self-service records are staff-scoped; finance and administrative records are manager-controlled",
    adapterBoundary: "Role mapping, payroll confidentiality, and external integration consent must be explicit before LAWYes routing.",
    examples: ["Parse this meeting audio into task drafts", "Review a budget report", "Open my payslip"],
    keywords: ["hr", "payroll", "leave", "attendance", "accounts", "budget", "ledger", "voice", "transcript", "ingest"],
  },
]);

export function findCapabilities(instruction: string, limit = 3): readonly Capability[] {
  const terms = instruction
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);

  if (terms.length === 0) return [];

  return CAPABILITY_REGISTRY
    .map((capability) => {
      const haystack = [
        capability.name,
        capability.description,
        capability.category,
        ...capability.keywords,
        ...capability.examples,
      ].join(" ").toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { capability, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.capability.name.localeCompare(right.capability.name))
    .slice(0, limit)
    .map(({ capability }) => capability);
}