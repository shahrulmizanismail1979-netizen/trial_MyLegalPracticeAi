export type EditorialState =
  | "Verified source"
  | "Access record"
  | "Verification required";

export type SarawakSourceRecord = Readonly<{
  id: string;
  title: string;
  summary: string;
  jurisdiction: "Sarawak" | "Federal / Sarawak" | "Malaysia";
  sourceType: string;
  practiceAreas: readonly string[];
  languages: readonly string[];
  url: string;
  lastVerified: string;
  currency: string;
  editorialState: EditorialState;
  searchTerms: readonly string[];
}>;

export type PracticePlaybook = Readonly<{
  id: string;
  title: string;
  area: string;
  jurisdictionCheck: string;
  steps: readonly string[];
  riskFlags: readonly string[];
  sourceIds: readonly string[];
  editorialState: EditorialState;
}>;

export type PrecedentPack = Readonly<{
  id: string;
  title: string;
  area: string;
  description: string;
  intake: readonly string[];
  exhibits: readonly string[];
  filingChecks: readonly string[];
  sourceIds: readonly string[];
  editorialState: EditorialState;
}>;

export const SARAWAK_SOURCE_RECORDS: readonly SarawakSourceRecord[] = Object.freeze([
  {
    id: "lawnet-home",
    title: "Statutes of Sarawak and Government Gazette gateway",
    summary:
      "Official Sarawak State Attorney-General's Chambers gateway for Ordinances, subsidiary legislation and Sarawak Government Gazette material.",
    jurisdiction: "Sarawak",
    sourceType: "Official legislation and Gazette gateway",
    practiceAreas: ["All practice areas", "Public law", "State regulatory"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPubHome.jsp",
    lastVerified: "30 August 2026",
    currency: "Gateway verified; currency must be checked on each instrument",
    editorialState: "Verified source",
    searchTerms: ["ordinance", "gazette", "subsidiary legislation", "lawnet", "undang-undang"],
  },
  {
    id: "lawnet-list",
    title: "Sarawak LawNet public law list",
    summary:
      "Official searchable listing of Sarawak Ordinances and subsidiary legislation. Use the instrument page and amendment history before relying on a provision.",
    jurisdiction: "Sarawak",
    sourceType: "Official legislation index",
    practiceAreas: ["All practice areas"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublicLawList.jsp?Display=",
    lastVerified: "30 August 2026",
    currency: "Live index; instrument-level verification required",
    editorialState: "Verified source",
    searchTerms: ["statute", "ordinance", "rules", "order", "enactment"],
  },
  {
    id: "land-code",
    title: "Land Code (Chapter 81, 1958 Edition)",
    summary:
      "Official online compilation issued through Sarawak LawNet. The displayed compilation states that it incorporates amendments up to 31 December 2024.",
    jurisdiction: "Sarawak",
    sourceType: "Official consolidated legislation PDF",
    practiceAreas: ["Land", "Conveyancing", "Native Customary Rights", "Development"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet_file/Ordinance/ORD_2025%20LANDCODE%20LAWNET%20%20(1).pdf",
    lastVerified: "30 August 2026",
    currency: "Compilation states amendments incorporated to 31 December 2024",
    editorialState: "Verified source",
    searchTerms: ["land code", "chapter 81", "native area land", "mixed zone land", "NCR", "caveat", "charge", "transfer"],
  },
  {
    id: "estate-ordinance",
    title: "Administration of Estates Ordinance, 1933",
    summary:
      "Official Sarawak LawNet access record for the Sarawak estate-administration statute. Provision-level practitioner content remains under editorial verification.",
    jurisdiction: "Sarawak",
    sourceType: "Official legislation PDF",
    practiceAreas: ["Probate", "Estate administration"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet_file/Ordinance/ORD_F-ADMIN%20ESTATE%20LawNet%202024.pdf",
    lastVerified: "30 August 2026",
    currency: "Current consolidation date to be confirmed from the instrument",
    editorialState: "Access record",
    searchTerms: ["probate", "letters of administration", "estate", "transmission"],
  },
  {
    id: "probate-rules",
    title: "Administration of Estates (Probate and Letters of Administration) Rules, 2023",
    summary:
      "Official Sarawak LawNet access record for Swk. L.N. 66/2023. Forms, registry steps and fees are not reproduced until instrument-level verification is complete.",
    jurisdiction: "Sarawak",
    sourceType: "Official subsidiary legislation PDF",
    practiceAreas: ["Probate", "Estate administration"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet_file/Subsidiary/SUB_Issue%20No.%2018_L.N.%2066%20probate.pdf",
    lastVerified: "30 August 2026",
    currency: "2023 instrument; later amendments must be checked",
    editorialState: "Access record",
    searchTerms: ["probate rules", "letters of administration", "Swk L.N. 66/2023"],
  },
  {
    id: "advocates-ordinance",
    title: "Advocates Ordinance, 1953",
    summary:
      "Official Sarawak LawNet listing for the Sarawak advocates' statutory framework. Admission and practice guidance remains subject to provision-level editorial review.",
    jurisdiction: "Sarawak",
    sourceType: "Official legislation access record",
    practiceAreas: ["Professional practice", "Admission", "Ethics"],
    languages: ["English"],
    url: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublicLawList.jsp?Display=",
    lastVerified: "30 August 2026",
    currency: "Instrument and amendments must be opened and checked before reliance",
    editorialState: "Access record",
    searchTerms: ["advocates ordinance", "admission", "practice", "professional duties", "undertaking"],
  },
  {
    id: "ekss-judgments",
    title: "e-Kehakiman Sabah and Sarawak judgment collection",
    summary:
      "Official Judiciary portal for accessible Sabah and Sarawak judgments. A listing is not a LAWYes report until the full judgment and paragraph support are reviewed.",
    jurisdiction: "Federal / Sarawak",
    sourceType: "Official judgment gateway",
    practiceAreas: ["Civil litigation", "Criminal litigation", "Land", "Public law"],
    languages: ["English", "Bahasa Malaysia"],
    url: "https://ekss-portal.kehakiman.gov.my/portals/web/home/list_judgment/",
    lastVerified: "30 August 2026",
    currency: "Live official collection",
    editorialState: "Verified source",
    searchTerms: ["judgment", "penghakiman", "Kuching", "Sibu", "Miri", "Bintulu", "Court of Appeal"],
  },
  {
    id: "ekss-advocates",
    title: "Roll of Advocates and practising-certificate services",
    summary:
      "Official e-Kehakiman Sabah and Sarawak advocate directory and practising-certificate gateway.",
    jurisdiction: "Federal / Sarawak",
    sourceType: "Official court administration gateway",
    practiceAreas: ["Professional practice", "Admission"],
    languages: ["English"],
    url: "https://ekss-portal.kehakiman.gov.my/portals/web/home/advocate_admission_lists/?c=roa",
    lastVerified: "30 August 2026",
    currency: "Live official directory",
    editorialState: "Verified source",
    searchTerms: ["roll of advocates", "practising certificate", "Sarawak advocate"],
  },
  {
    id: "native-courts",
    title: "Native Courts of Sarawak official portal",
    summary:
      "Official Sarawak Government portal for Native Courts information and public links. Jurisdiction and custom-specific propositions require direct statutory or reported-authority support.",
    jurisdiction: "Sarawak",
    sourceType: "Official agency gateway",
    practiceAreas: ["Native law", "Native Courts", "Jurisdiction"],
    languages: ["English", "Bahasa Malaysia"],
    url: "https://nativecourt.sarawak.gov.my/web/home/index/",
    lastVerified: "30 August 2026",
    currency: "Live official portal",
    editorialState: "Verified source",
    searchTerms: ["native court", "mahkamah bumiputera", "adat", "native customary law", "appeal"],
  },
  {
    id: "native-appeals",
    title: "Native Court of Appeal judgment gateway",
    summary:
      "Official e-Kehakiman gateway for accessible Native Court of Appeal judgments. Community custom is not generalised beyond the cited judgment or instrument.",
    jurisdiction: "Federal / Sarawak",
    sourceType: "Official judgment gateway",
    practiceAreas: ["Native law", "Appeals", "Jurisdiction"],
    languages: ["English", "Bahasa Malaysia"],
    url: "https://ekss-portal.kehakiman.gov.my/portals/web/home/list_native_judgment",
    lastVerified: "30 August 2026",
    currency: "Live official collection",
    editorialState: "Verified source",
    searchTerms: ["native court appeal", "adat", "custom", "jurisdiction"],
  },
  {
    id: "land-survey",
    title: "Sarawak Land and Survey Department",
    summary:
      "Official department gateway for land-administration services and public information. Transaction requirements must be verified against the current service and governing instrument.",
    jurisdiction: "Sarawak",
    sourceType: "Official agency gateway",
    practiceAreas: ["Land", "Conveyancing", "Development", "Registration"],
    languages: ["English", "Bahasa Malaysia"],
    url: "https://landsurvey.sarawak.gov.my/",
    lastVerified: "30 August 2026",
    currency: "Live official portal; service-level currency varies",
    editorialState: "Verified source",
    searchTerms: ["land search", "title", "caveat", "consent", "transfer", "charge", "registration"],
  },
  {
    id: "judiciary-registry",
    title: "Sarawak court administration and registry directory",
    summary:
      "Official e-Kehakiman Sabah and Sarawak court-administration gateway. Registry-specific filing requirements, fees and timelines remain verification-required unless directly sourced.",
    jurisdiction: "Federal / Sarawak",
    sourceType: "Official Judiciary directory",
    practiceAreas: ["Civil litigation", "Criminal litigation", "Court administration"],
    languages: ["English", "Bahasa Malaysia"],
    url: "https://ekss-portal.kehakiman.gov.my/portals/web/home/sarawak_state_court_director",
    lastVerified: "30 August 2026",
    currency: "Live official directory",
    editorialState: "Verified source",
    searchTerms: ["Kuching registry", "Sibu registry", "Miri registry", "Bintulu registry", "court directory"],
  },
]);

export const SARAWAK_PLAYBOOKS: readonly PracticePlaybook[] = Object.freeze([
  {
    id: "civil-interlocutory",
    title: "Civil interlocutory application",
    area: "Civil litigation",
    jurisdictionCheck:
      "Confirm the court, registry, governing national rules, enabling provision, and any current Sarawak registry direction before drafting.",
    steps: [
      "Identify the relief, legal basis and evidential burden.",
      "Confirm cause-paper, supporting affidavit, exhibits and draft order requirements.",
      "Check filing, service and hearing directions directly with the selected registry.",
      "Verify every authority and pinpoint against an accessible judgment.",
    ],
    riskFlags: ["Do not infer registry practice from a West Malaysia filing.", "No fee or timeline is stated until directly verified."],
    sourceIds: ["ekss-judgments", "judiciary-registry"],
    editorialState: "Verification required",
  },
  {
    id: "criminal-bail",
    title: "Bail and criminal representation preparation",
    area: "Criminal litigation",
    jurisdictionCheck:
      "Apply current federal criminal law and verify the Sarawak court, charge, custody status and local listing requirements.",
    steps: [
      "Record charge particulars, custody history, proposed surety and release conditions.",
      "Separate statutory submissions from discretionary factual mitigation.",
      "Prepare a verified chronology and supporting documents.",
      "Check current filing or representation channel with the relevant registry or prosecuting office.",
    ],
    riskFlags: ["No promise of bail outcome.", "Sentencing ranges and local directions require current authority."],
    sourceIds: ["ekss-judgments", "judiciary-registry"],
    editorialState: "Verification required",
  },
  {
    id: "sarawak-land",
    title: "Sarawak land transaction and registration",
    area: "Conveyancing and land",
    jurisdictionCheck:
      "Use the Sarawak Land Code and verified Land and Survey requirements; do not import National Land Code assumptions.",
    steps: [
      "Capture title particulars, land classification, registered interests and transaction parties.",
      "Identify restrictions, native-status questions, consents, caveats, charges or leases requiring investigation.",
      "Prepare searches, completion documents, tax/stamp interfaces and registration sequence.",
      "Confirm post-registration deliverables and retained evidence.",
    ],
    riskFlags: ["NCR and native-status issues require matter-specific authority.", "Forms, fees and turnaround times require live verification."],
    sourceIds: ["land-code", "land-survey", "lawnet-home"],
    editorialState: "Access record",
  },
  {
    id: "native-jurisdiction",
    title: "Native law jurisdiction triage",
    area: "Native law and jurisdiction",
    jurisdictionCheck:
      "Identify parties, subject matter, court hierarchy and exact statutory basis before expressing any view on jurisdiction or custom.",
    steps: [
      "Record the parties and the specific native-law or custom issue raised.",
      "Locate the current governing Ordinance, subsidiary legislation and relevant appellate authority.",
      "Separate jurisdiction from the merits of any asserted custom.",
      "Flag cultural or factual matters that require qualified evidence rather than generalisation.",
    ],
    riskFlags: ["Do not state uncited cultural claims as law.", "Do not assume the same custom applies across communities."],
    sourceIds: ["native-courts", "native-appeals", "lawnet-list"],
    editorialState: "Verification required",
  },
  {
    id: "professional-practice",
    title: "Sarawak professional-practice file opening",
    area: "Professional practice",
    jurisdictionCheck:
      "Confirm the applicable Sarawak advocates framework and any current professional or court-issued requirements.",
    steps: [
      "Complete client identity, authority, conflict and scope checks.",
      "Record undertakings, privilege issues, stakeholder-money handling and costs basis.",
      "Open limitation and diary controls with source and verification dates.",
      "Record who approved departures from the standard file-opening checklist.",
    ],
    riskFlags: ["No professional rule is paraphrased without an authoritative source.", "Stakeholder-money handling requires current rule verification."],
    sourceIds: ["advocates-ordinance", "ekss-advocates", "lawnet-home"],
    editorialState: "Verification required",
  },
]);

export const SARAWAK_PRECEDENT_PACKS: readonly PrecedentPack[] = Object.freeze([
  {
    id: "affidavit-pack",
    title: "Sarawak civil affidavit pack",
    area: "Civil litigation",
    description: "Guided drafting template requiring practitioner review; no registry-specific filing claim is implied.",
    intake: ["Court and registry", "Cause number and parties", "Deponent capacity", "Relief supported", "Chronology and source of knowledge"],
    exhibits: ["Source documents", "Correspondence", "Orders or pleadings relied on", "Exhibit identification schedule"],
    filingChecks: ["Heading and cause paper checked", "Authority and rules verified", "Exhibits legible", "Service method confirmed", "Draft order considered"],
    sourceIds: ["judiciary-registry", "ekss-judgments"],
    editorialState: "Verification required",
  },
  {
    id: "criminal-pack",
    title: "Bail, representation and mitigation pack",
    area: "Criminal litigation",
    description: "Court-ready preparation workspace, not an assurance of outcome or a substitute for current statutory verification.",
    intake: ["Charge and provision", "Court and registry", "Custody and remand history", "Surety proposal", "Personal mitigation", "Prosecution correspondence"],
    exhibits: ["Identity and address evidence", "Employment or medical material", "Surety documents", "Supporting correspondence"],
    filingChecks: ["Charge verified", "Federal law checked", "Local channel confirmed", "Authorities checked", "Client instructions approved"],
    sourceIds: ["ekss-judgments", "judiciary-registry"],
    editorialState: "Verification required",
  },
  {
    id: "land-pack",
    title: "Sarawak transfer, charge and caveat pack",
    area: "Conveyancing and land",
    description: "Sarawak-specific transaction intake and completion checklist anchored to the Land Code and current agency source.",
    intake: ["Title particulars", "Land classification", "Registered proprietor", "Transaction and consideration", "Native-status information", "Restrictions and consents"],
    exhibits: ["Official search", "Title copy", "Identity/authority documents", "Consent evidence", "Tax and stamp records"],
    filingChecks: ["Land Code checked", "Restrictions investigated", "Consents verified", "Completion sequence approved", "Registration evidence retained"],
    sourceIds: ["land-code", "land-survey"],
    editorialState: "Access record",
  },
  {
    id: "probate-pack",
    title: "Sarawak probate and administration pack",
    area: "Probate and estates",
    description: "Guided estate intake tied to the official Ordinance and 2023 Rules access records; forms and fees remain verification-required.",
    intake: ["Deceased and domicile", "Will and executors", "Beneficiaries", "Asset/liability schedule", "Prior grants or proceedings"],
    exhibits: ["Death record", "Original will if any", "Identity and relationship evidence", "Asset evidence", "Renunciation or consent if relevant"],
    filingChecks: ["Jurisdiction checked", "Instrument currency checked", "Registry forms verified", "Notices/service checked", "Transmission steps planned"],
    sourceIds: ["estate-ordinance", "probate-rules", "judiciary-registry"],
    editorialState: "Verification required",
  },
]);

export const SARAWAK_REGISTRY_LINKS = Object.freeze([
  { name: "Kuching", kind: "High Court and subordinate courts", sourceId: "judiciary-registry" },
  { name: "Sibu", kind: "High Court and subordinate courts", sourceId: "judiciary-registry" },
  { name: "Bintulu", kind: "Subordinate court and registry information", sourceId: "judiciary-registry" },
  { name: "Miri", kind: "High Court and subordinate courts", sourceId: "judiciary-registry" },
  { name: "Sri Aman and other registries", kind: "Verify current official directory", sourceId: "judiciary-registry" },
]);

export const SARAWAK_UPDATES = Object.freeze([
  {
    date: "30 August 2026",
    title: "Sarawak source baseline verified",
    detail:
      "Official LawNet, e-Kehakiman Sabah and Sarawak, Native Courts and Land and Survey gateways were checked for the Safe Preview.",
  },
  {
    date: "30 August 2026",
    title: "Land Code currency displayed",
    detail:
      "The linked official online Land Code compilation states amendments incorporated up to 31 December 2024; later changes remain a live verification step.",
  },
  {
    date: "30 August 2026",
    title: "Editorial gap made explicit",
    detail:
      "Registry fees, filing timelines, forms and uncited local practices remain verification-required instead of being generated.",
  },
]);

export function sourceById(id: string) {
  return SARAWAK_SOURCE_RECORDS.find((source) => source.id === id);
}

export function searchSarawakSources(query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return SARAWAK_SOURCE_RECORDS;
  return SARAWAK_SOURCE_RECORDS.filter((source) =>
    [
      source.title,
      source.summary,
      source.jurisdiction,
      source.sourceType,
      source.currency,
      source.editorialState,
      ...source.practiceAreas,
      ...source.languages,
      ...source.searchTerms,
    ]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}