import {
  FileText, Scale, Shield, Calculator, ClipboardList,
  FileSearch, Gavel, Building2, ScrollText, AlertTriangle,
  BookOpen, Landmark, Users, Banknote, CalendarClock,
  PenTool, MessageSquare, Search, ListChecks, BrainCircuit,
  FileSignature, Receipt, TrendingUp, Briefcase, Globe,
  Swords, FileCheck, Handshake, Building, Drama,
  UserRoundSearch, Mic, GraduationCap, Presentation
} from "lucide-react";

export type ToolCategory = "transactional" | "compliance" | "drafting" | "advisory" | "litigation" | "specialized" | "simulation";

export interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number" | "files";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
  /** For type "files": heading injected before the extracted document text in the prompt. */
  filesHeading?: string;
  /** For type "files": dropzone hint line. */
  filesHint?: string;
}

export interface PractitionerTool {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: ToolCategory;
  icon: React.ElementType;
  color: string;
  formFields: FormField[];
  buildPrompt: (values: Record<string, string>) => string;
  exampleScenario?: string;
  /** Optional cross-field validation (e.g. "facts typed OR documents uploaded"). */
  isValid?: (values: Record<string, string>) => boolean;
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string; description: string }[] = [
  { id: "transactional", label: "Transactional", description: "M&A, due diligence, deal structuring" },
  { id: "compliance", label: "Compliance & Regulatory", description: "SSM filings, deadlines, MACC, AML" },
  { id: "drafting", label: "Drafting & Documents", description: "Resolutions, opinions, agreements" },
  { id: "advisory", label: "Advisory & Analysis", description: "Risk analysis, case research, opinions" },
  { id: "litigation", label: "Dispute Resolution", description: "Litigation strategy, arbitration, mediation" },
  { id: "specialized", label: "Specialized Practice", description: "IPO, employment, cross-border, Islamic finance" },
  { id: "simulation", label: "Practice Simulators", description: "Mock negotiations, mediations, arbitrations, client handling" },
];

export const PRACTITIONER_TOOLS: PractitionerTool[] = [
  {
    id: "legal-opinion",
    name: "Legal Opinion Writer",
    shortName: "Legal Opinion",
    description: "Generate structured legal opinions on Malaysian corporate law issues with proper formatting, analysis, and conclusions.",
    category: "advisory",
    icon: ScrollText,
    color: "text-blue-400",
    exampleScenario: "Client needs opinion on whether proposed related-party transaction requires shareholder approval under CA 2016",
    formFields: [
      { id: "clientName", label: "Client / Addressee", type: "text", placeholder: "e.g., Board of Directors, ABC Sdn Bhd", required: true },
      { id: "matterTitle", label: "Matter / Subject", type: "text", placeholder: "e.g., Proposed Franchise Arrangement with XYZ Sdn Bhd", required: true },
      {
        id: "factDocs",
        label: "Client Instructions & Background Documents",
        type: "files",
        helpText: "Upload the client's instruction email, agreements, and correspondence. The AI will use these to establish the factual background — and, if you leave the issues blank, to frame the legal questions itself.",
        filesHint: "Client email (EML/TXT), agreements, correspondence — PDF, DOCX, TXT, MD, EML",
        filesHeading: "CLIENT INSTRUCTIONS & BACKGROUND DOCUMENTS (uploaded by the practitioner — treat these as the factual record and the source of the client's instructions):",
      },
      { id: "facts", label: "Key Facts & Background (Optional if documents uploaded)", type: "textarea", placeholder: "Set out or supplement the relevant factual background, parties involved, transaction details, and key commercial terms..." },
      { id: "issues", label: "Legal Issues to Address (Optional)", type: "textarea", placeholder: "Leave blank to let the AI identify and frame the questions from the client's instructions, or list them:\n1. Whether the arrangement is a franchise under the Franchise Act 1998\n2. Whether registration is required before signing", helpText: "If left blank, the AI will derive the questions to be answered from the uploaded client instructions." },
      {
        id: "lawDocs",
        label: "Legislation, Cases & Authorities",
        type: "files",
        helpText: "Upload the primary legislation (e.g. Franchise Act 1998) and all relevant cases. The analysis will be grounded primarily in what you upload.",
        filesHint: "Acts, regulations, guidelines, judgments — PDF, DOCX, TXT, MD",
        filesHeading: "PRIMARY LEGISLATION, CASES & AUTHORITIES (uploaded by the practitioner — ground the legal analysis primarily in these materials, citing exact sections and cases from them):",
      },
      { id: "jurisdiction", label: "Or Pick Common Legislation (Optional)", type: "select", helpText: "Quick pick for common corporate statutes — skip this if you uploaded the legislation above.", options: [
        { value: "ca2016", label: "Companies Act 2016" },
        { value: "cmsa2007", label: "CMSA 2007 (Listed Company)" },
        { value: "both", label: "Both CA 2016 & CMSA 2007" },
        { value: "macc", label: "MACC Act 2009 / Anti-Corruption" },
        { value: "aml", label: "AMLA 2001 / AML Compliance" },
      ]},
      {
        id: "templateDocs",
        label: "Firm Opinion Template / House Style (Optional)",
        type: "files",
        helpText: "Upload a past opinion or your firm's template — the opinion will follow its structure, headings and house style exactly.",
        filesHint: "One or two examples of your firm's opinion format — PDF, DOCX, TXT",
        filesHeading: "FIRM TEMPLATE / HOUSE STYLE (follow the structure, section headings, numbering and drafting style of this template exactly when producing the opinion):",
      },
      { id: "additionalContext", label: "Additional Context (Optional)", type: "textarea", placeholder: "Any other relevant information, prior advice, or specific concerns..." },
    ],
    isValid: (v) =>
      Boolean(v.clientName?.trim()) &&
      Boolean(v.matterTitle?.trim()) &&
      Boolean(v.facts?.trim() || v.factDocs?.trim()),
    buildPrompt: (v) => {
      const legislationLabel =
        v.jurisdiction === "ca2016" ? "Companies Act 2016"
        : v.jurisdiction === "cmsa2007" ? "CMSA 2007"
        : v.jurisdiction === "both" ? "CA 2016 and CMSA 2007"
        : v.jurisdiction === "macc" ? "MACC Act 2009"
        : v.jurisdiction === "aml" ? "AMLA 2001"
        : "";
      return `Draft a formal legal opinion letter addressed to ${v.clientName} regarding: ${v.matterTitle}
${v.factDocs ? `\n${v.factDocs}\n` : ""}
KEY FACTS:
${v.facts?.trim() ? v.facts : "Derive the factual background from the uploaded client instructions and documents above. Recite the material facts accurately and note any factual gaps as assumptions."}

LEGAL ISSUES TO ADDRESS:
${v.issues?.trim() ? v.issues : "No issues were specified. Carefully analyse the client's instructions and documents, identify the legal questions the client needs answered, state them expressly in the opinion, and then answer each one."}
${v.lawDocs ? `\n${v.lawDocs}\n` : ""}${legislationLabel ? `\nPrimary legislation focus: ${legislationLabel}` : ""}${!v.lawDocs && !legislationLabel ? "\nPrimary legislation: identify the applicable Malaysian legislation yourself from the facts and issues." : ""}
${v.lawDocs ? "Ground the applicable-law analysis primarily in the uploaded legislation and authorities, citing exact section numbers and the uploaded cases. Only go beyond the uploaded materials where necessary, and flag clearly when you do." : ""}
${v.templateDocs ? `\n${v.templateDocs}\n` : ""}${v.additionalContext ? `\nAdditional context: ${v.additionalContext}` : ""}

${v.templateDocs ? "Follow the uploaded firm template's structure, headings, numbering and house style exactly." : "Format as a proper legal opinion with: (1) Introduction and scope, (2) Facts recited, (3) Issues identified, (4) Applicable law and analysis with section references, (5) Conclusions and recommendations, (6) Qualifications and assumptions."} Use Malaysian legal drafting conventions.`;
    }
  },
  {
    id: "transaction-advisor",
    name: "Transaction Structure Advisor",
    shortName: "Deal Structure",
    description: "Compare share sale vs asset sale vs scheme of arrangement. Get AI analysis of tax, regulatory, and commercial implications.",
    category: "transactional",
    icon: Building2,
    color: "text-emerald-400",
    exampleScenario: "Acquiring 100% of a manufacturing Sdn Bhd with RM50m turnover — which structure is optimal?",
    formFields: [
      {
        id: "dealDocs",
        label: "Deal Documents (Term Sheet, LOI, Heads of Terms)",
        type: "files",
        helpText: "Upload the term sheet, letter of intent, draft SPA, or any deal documents — the structuring advice will be grounded in what you upload, so you don't need to retype the deal terms.",
        filesHint: "Term sheet, LOI, heads of terms, draft agreements — PDF, DOCX, TXT, MD",
        filesHeading: "DEAL DOCUMENTS (uploaded by the practitioner — extract the parties, target, consideration, structure and key commercial terms from these documents and ground the structuring analysis in them):",
      },
      { id: "dealDescription", label: "Transaction Description (Optional if documents uploaded)", type: "textarea", placeholder: "Describe or supplement the proposed deal: buyer, target, industry, size, rationale..." },
      { id: "targetType", label: "Target Company Type", type: "select", required: true, options: [
        { value: "sdn-bhd", label: "Private Company (Sdn Bhd)" },
        { value: "bhd", label: "Public Company (Bhd)" },
        { value: "listed", label: "Public Listed Company (Bursa)" },
        { value: "llp", label: "LLP" },
        { value: "foreign", label: "Foreign-Owned Company" },
      ]},
      { id: "dealValue", label: "Approximate Deal Value (RM)", type: "text", placeholder: "e.g., RM 50,000,000" },
      { id: "percentageAcquired", label: "Percentage Being Acquired", type: "text", placeholder: "e.g., 100% or 51%" },
      { id: "keyAssets", label: "Key Assets of Target", type: "textarea", placeholder: "Land, plant & machinery, licenses, contracts, IP, employees, inventory..." },
      { id: "concerns", label: "Specific Concerns", type: "textarea", placeholder: "Tax efficiency, speed, regulatory approvals needed, existing liabilities, employee transfer, change of control clauses..." },
    ],
    isValid: (v) =>
      Boolean(v.targetType?.trim()) &&
      Boolean(v.dealDescription?.trim() || v.dealDocs?.trim()),
    buildPrompt: (v) => `Advise on the optimal transaction structure for the following proposed deal in Malaysia:
${v.dealDocs ? `\n${v.dealDocs}\n` : ""}
TRANSACTION: ${v.dealDescription?.trim() ? v.dealDescription : "Derive the transaction details (buyer, target, industry, size, rationale, key commercial terms) from the uploaded deal documents above. Note any gaps as assumptions."}
TARGET TYPE: ${v.targetType}
DEAL VALUE: ${v.dealValue || "Not specified"}
STAKE: ${v.percentageAcquired || "Not specified"}
KEY ASSETS: ${v.keyAssets || "Not specified"}
CONCERNS: ${v.concerns || "None specified"}
${v.dealDocs ? "\nGround the analysis in the uploaded deal documents: reference their actual terms (consideration, conditions, warranties, structure) when comparing structures, and flag any provisions in them that favour or preclude a particular structure.\n" : ""}
Compare and analyze:
1. **Share Acquisition** — process, stamp duty (0.3%), RPGT implications, successor liability, regulatory approvals
2. **Asset/Business Acquisition** — process, stamp duty on assets, GST/SST, cherry-picking assets, employee transfer (s.20A EA 1955), license transferability
3. **Scheme of Arrangement (s.366 CA 2016)** — when appropriate, court process, creditor/member approval thresholds
4. **Merger (s.439A-439Y CA 2016)** — statutory merger procedure, when available

For each structure, analyze: (a) legal process and timeline, (b) tax implications (stamp duty, RPGT, withholding tax), (c) regulatory approvals needed, (d) treatment of liabilities, (e) treatment of employees, (f) treatment of contracts and licenses, (g) cost estimate. Recommend the optimal structure with reasons.`
  },
  {
    id: "dd-report",
    name: "Due Diligence Report Generator",
    shortName: "DD Report",
    description: "Generate a structured legal due diligence report from your findings, organized by category with risk ratings.",
    category: "transactional",
    icon: FileSearch,
    color: "text-orange-400",
    exampleScenario: "Preparing DD report for acquisition of manufacturing company with land assets and 200 employees",
    formFields: [
      { id: "targetName", label: "Target Company Name", type: "text", placeholder: "e.g., XYZ Manufacturing Sdn Bhd", required: true },
      { id: "targetRegNo", label: "Company Registration No.", type: "text", placeholder: "e.g., 201901012345 (1234567-A)" },
      { id: "transactionType", label: "Transaction Type", type: "select", required: true, options: [
        { value: "share-acquisition", label: "Share Acquisition" },
        { value: "asset-acquisition", label: "Asset/Business Acquisition" },
        { value: "joint-venture", label: "Joint Venture" },
        { value: "investment", label: "Investment / Subscription of Shares" },
        { value: "merger", label: "Merger / Scheme of Arrangement" },
      ]},
      {
        id: "ddDocs",
        label: "DD Documents & Source Materials",
        type: "files",
        helpText: "Upload the documents you reviewed — constitution, SSM searches, material contracts, litigation searches, title searches, DD questionnaire responses. The AI will extract findings from them and organise the report.",
        filesHint: "Constitution, searches, material contracts, DD responses — PDF, DOCX, TXT, MD",
        filesHeading: "DUE DILIGENCE DOCUMENTS & SOURCE MATERIALS (uploaded by the practitioner — extract the legal DD findings and issues directly from these documents, citing the specific document and clause/section each finding comes from):",
      },
      { id: "findings", label: "Key Findings & Issues Identified (Optional if documents uploaded)", type: "textarea", placeholder: "List or supplement your DD findings, e.g.:\n- Constitution has pre-emption rights requiring waiver\n- Undisclosed litigation by former employee\n- Land title has caveat registered\n- Related party contracts not at arm's length\n- Tax returns not filed for 2 years\n- Directors' service contracts have 2-year notice periods" },
      { id: "ddScope", label: "DD Scope / Categories Reviewed", type: "textarea", placeholder: "e.g., Corporate, Shareholding, Directors, Constitution, Material Contracts, Employment, Litigation, Real Property, IP, Tax, Regulatory" },
      { id: "additionalNotes", label: "Additional Notes", type: "textarea", placeholder: "Any qualifications, limitations of scope, or additional context..." },
    ],
    isValid: (v) =>
      Boolean(v.targetName?.trim()) &&
      Boolean(v.transactionType?.trim()) &&
      Boolean(v.findings?.trim() || v.ddDocs?.trim()),
    buildPrompt: (v) => `Generate a formal Legal Due Diligence Report for:

TARGET: ${v.targetName} ${v.targetRegNo ? `(${v.targetRegNo})` : ""}
TRANSACTION TYPE: ${v.transactionType}
${v.ddDocs ? `\n${v.ddDocs}\n` : ""}
FINDINGS:
${v.findings?.trim() ? v.findings : "Extract the DD findings from the uploaded documents above. For each finding, cite the source document and the specific clause, section or entry it comes from. Flag anything in the documents that appears incomplete or requires further investigation."}
${v.ddDocs && v.findings?.trim() ? "\nGround the report in the uploaded documents: verify and expand the typed findings against them, cite the source document for each finding, and add any additional issues apparent from the documents that were not listed above.\n" : ""}
DD SCOPE: ${v.ddScope || "Full corporate legal DD"}
NOTES: ${v.additionalNotes || "None"}

Format as a proper legal DD report with:
1. Executive Summary with overall risk assessment (High/Medium/Low)
2. Scope and Limitations
3. Findings organized by category:
   - Corporate (incorporation, constitution, registers)
   - Shareholding and Capital Structure
   - Directors and Officers
   - Material Contracts
   - Real Property and Assets
   - Employment
   - Litigation and Disputes
   - Tax Compliance
   - Regulatory and Licenses
   - Insurance
   - Environmental
   - Intellectual Property
4. For each finding: Description, Risk Level (Red/Amber/Green), Legal Implication, Recommended Action / Condition Precedent
5. Summary of Recommended CPs for the SPA
6. Items Requiring Further Investigation

Use Malaysian legal DD report conventions and reference relevant CA 2016 sections.`
  },
  {
    id: "spa-reviewer",
    name: "SPA Clause Reviewer",
    shortName: "SPA Review",
    description: "Paste any SPA clause or full agreement section — get detailed risk analysis, missing protections, and suggested improvements.",
    category: "transactional",
    icon: FileText,
    color: "text-violet-400",
    formFields: [
      {
        id: "spaDocs",
        label: "Upload the SPA / Agreement",
        type: "files",
        helpText: "Upload the SPA or the relevant sections — the review will be grounded in the uploaded document, so you don't need to retype the clauses.",
        filesHint: "SPA, draft agreement, or extracted clauses — PDF, DOCX, TXT, MD",
        filesHeading: "SPA / AGREEMENT UNDER REVIEW (uploaded by the practitioner — review the clauses in this document, quoting the exact clause numbers and language from it):",
      },
      { id: "clauseText", label: "Or Paste the SPA Clause(s) (Optional if document uploaded)", type: "textarea", placeholder: "Paste the warranty clause, indemnity clause, condition precedent, MAC clause, non-compete, or any other SPA provision here..." },
      { id: "actingFor", label: "You Are Acting For", type: "select", required: true, options: [
        { value: "buyer", label: "Buyer / Purchaser" },
        { value: "seller", label: "Seller / Vendor" },
        { value: "both", label: "Both Parties (Neutral Review)" },
      ]},
      { id: "dealContext", label: "Deal Context (Optional)", type: "textarea", placeholder: "Brief description of the deal, target company, industry, deal value..." },
      { id: "specificConcerns", label: "Specific Concerns (Optional)", type: "textarea", placeholder: "Any particular issues you want analyzed..." },
    ],
    isValid: (v) =>
      Boolean(v.actingFor?.trim()) &&
      Boolean(v.clauseText?.trim() || v.spaDocs?.trim()),
    buildPrompt: (v) => `Review the following SPA clause(s) from a Malaysian share/asset sale transaction. I am acting for the ${v.actingFor}.
${v.spaDocs ? `\n${v.spaDocs}\n` : ""}
CLAUSE TEXT:
${v.clauseText?.trim() ? v.clauseText : "Review the clauses in the uploaded agreement above. Quote the exact clause numbers and language from the uploaded document in your analysis and redrafts."}
${v.spaDocs && v.clauseText?.trim() ? "\nGround the review in the uploaded agreement: read the pasted clauses in the context of the full uploaded document, and cite exact clause numbers from it.\n" : ""}
${v.dealContext ? `DEAL CONTEXT: ${v.dealContext}` : ""}
${v.specificConcerns ? `SPECIFIC CONCERNS: ${v.specificConcerns}` : ""}

Provide:
1. **Plain Language Summary** — what does this clause actually do?
2. **Risk Analysis** for ${v.actingFor === "buyer" ? "the buyer" : v.actingFor === "seller" ? "the seller" : "both parties"} — identify hidden risks, onerous terms, gaps
3. **Benchmark Against Market Standard** — is this standard/aggressive/weak compared to Malaysian M&A market practice?
4. **Missing Protections** — what standard protections are missing?
5. **Suggested Redraft / Markup** — provide improved language protecting ${v.actingFor === "buyer" ? "the buyer" : v.actingFor === "seller" ? "the seller" : "both parties"}
6. **Negotiation Points** — key points to raise with the counterparty
7. **Malaysian Law Considerations** — any CA 2016, stamp duty, or regulatory implications`
  },
  {
    id: "drafter",
    name: "AI Corporate Drafter",
    shortName: "Corporate Draft",
    description: "Draft partner-grade corporate legal documents, agreements, resolutions, notices, and ancillary documents in Malaysian format.",
    category: "drafting",
    icon: PenTool,
    color: "text-purple-400",
    exampleScenario: "Prepare a board resolution and supporting documents approving a share allotment for a Malaysian company",
    formFields: [
      {
        id: "documentType",
        label: "Document to Draft",
        type: "select",
        required: true,
        options: [
          { value: "board-resolution", label: "Board / Directors' Resolution" },
          { value: "shareholders-resolution", label: "Members' / Shareholders' Resolution" },
          { value: "share-purchase-agreement", label: "Share Purchase Agreement" },
          { value: "shareholders-agreement", label: "Shareholders Agreement" },
          { value: "non-disclosure-agreement", label: "Non-Disclosure Agreement" },
          { value: "service-agreement", label: "Service / Consultancy Agreement" },
          { value: "employment-agreement", label: "Executive Employment Agreement" },
          { value: "notice", label: "Corporate Notice / Circular" },
          { value: "undertaking", label: "Corporate Undertaking / Letter" },
          { value: "other", label: "Other Corporate Document" },
        ],
      },
      { id: "companyName", label: "Company / Principal", type: "text", placeholder: "e.g., ABC Holdings Sdn Bhd", required: true },
      { id: "parties", label: "Parties and Their Roles", type: "textarea", placeholder: "List every party, registration number, address, and role. Identify the party you act for.", required: true },
      { id: "instructions", label: "Key Facts, Terms & Instructions", type: "textarea", placeholder: "Set out the transaction, commercial terms, dates, amounts, approvals, obligations, and any clauses the document must contain.", required: true },
      {
        id: "sourceDocs",
        label: "Source Documents / Precedents (Optional)",
        type: "files",
        helpText: "Upload term sheets, existing agreements, board papers, or a firm precedent. The draft will use the uploaded material as factual and stylistic source material.",
        filesHint: "Term sheets, agreements, board papers, precedents — PDF, DOCX, TXT, MD",
        filesHeading: "SOURCE DOCUMENTS AND FIRM PRECEDENTS (uploaded by the practitioner — use as evidence and follow the requested house style):",
      },
      { id: "additionalRequirements", label: "Additional Requirements (Optional)", type: "textarea", placeholder: "Governing law, dispute resolution, execution method, stamping, filing requirements, schedules, or specific risk allocation..." },
    ],
    buildPrompt: (v) => `Draft a complete ${v.documentType} for ${v.companyName}.

PARTIES AND ROLES:
${v.parties}

KEY FACTS, COMMERCIAL TERMS AND INSTRUCTIONS:
${v.instructions}
${v.sourceDocs ? `\n${v.sourceDocs}\n` : ""}
${v.additionalRequirements ? `\nADDITIONAL REQUIREMENTS:\n${v.additionalRequirements}` : ""}

Produce a complete, execution-ready Malaysian corporate document. Preserve every supplied name, date, number and commercial term exactly. Include appropriate recitals, definitions, operative clauses, conditions precedent, schedules, notices, governing law, dispute resolution, stamping and filing provisions, and complete execution blocks where applicable. Identify any essential missing information with [●] rather than inventing it. If the selected document requires ancillary resolutions, certificates, notices, or other supporting documents, include them or clearly list them after the main document.`
  },
  {
    id: "board-resolution",
    name: "Board Resolution Generator",
    shortName: "Resolutions",
    description: "Generate properly formatted board resolutions, members resolutions, or circular resolutions for any corporate action.",
    category: "drafting",
    icon: FileSignature,
    color: "text-amber-400",
    formFields: [
      { id: "companyName", label: "Company Name", type: "text", placeholder: "e.g., ABC Holdings Sdn Bhd", required: true },
      { id: "companyNo", label: "Company No.", type: "text", placeholder: "e.g., 202301012345 (1456789-X)" },
      { id: "resolutionType", label: "Resolution Type", type: "select", required: true, options: [
        { value: "driw", label: "Directors' Resolution in Writing (DRIW)" },
        { value: "board-meeting", label: "Board Resolution (at Meeting)" },
        { value: "members-ordinary", label: "Members' Ordinary Resolution" },
        { value: "members-special", label: "Members' Special Resolution" },
        { value: "members-written", label: "Members' Written Resolution" },
      ]},
      { id: "subjectMatter", label: "Subject Matter", type: "select", required: true, options: [
        { value: "allot-shares", label: "Allotment of Shares" },
        { value: "transfer-shares", label: "Approval of Share Transfer" },
        { value: "appoint-director", label: "Appointment of Director" },
        { value: "remove-director", label: "Removal of Director" },
        { value: "change-secretary", label: "Change of Company Secretary" },
        { value: "bank-mandate", label: "Bank Account / Mandate Change" },
        { value: "approve-accounts", label: "Approval of Financial Statements" },
        { value: "declare-dividend", label: "Declaration of Dividend" },
        { value: "change-name", label: "Change of Company Name" },
        { value: "change-address", label: "Change of Registered Address" },
        { value: "amend-constitution", label: "Amendment of Constitution" },
        { value: "related-party", label: "Related Party Transaction (s.228)" },
        { value: "loan-facility", label: "Approval of Loan Facility / Charge" },
        { value: "winding-up", label: "Members' Voluntary Winding Up" },
        { value: "capital-reduction", label: "Capital Reduction" },
        { value: "other", label: "Other (specify in details)" },
      ]},
      { id: "details", label: "Key Details", type: "textarea", placeholder: "Include all relevant details: names, amounts, dates, share numbers, prices, bank details, etc.", required: true },
      { id: "additionalResolutions", label: "Additional Ancillary Resolutions Needed", type: "textarea", placeholder: "e.g., Authority to company secretary to lodge with SSM, authorization of signatories, etc." },
    ],
    buildPrompt: (v) => `Draft a ${v.resolutionType} for ${v.companyName} ${v.companyNo ? `(${v.companyNo})` : ""} regarding: ${v.subjectMatter}

DETAILS:
${v.details}

${v.additionalResolutions ? `ADDITIONAL RESOLUTIONS: ${v.additionalResolutions}` : ""}

Requirements:
- Use proper Malaysian corporate resolution format
- Include all legally required recitals and "WHEREAS" clauses
- Include "IT WAS RESOLVED THAT" operative clauses
- Reference specific CA 2016 sections where applicable
- Include ancillary resolutions (authorization to secretary to lodge with SSM, etc.)
- Include proper execution block for the resolution type
- For DRIW: include signature blocks for all directors
- For board meeting: include attendance, quorum, chairman declaration
- For members' resolutions: include proper majority requirement notation
- Flag any SSM filings triggered by the resolution`
  },
  {
    id: "macc-17a",
    name: "S.17A MACC Adequate Procedures",
    shortName: "Anti-Corruption",
    description: "Build a tailored adequate procedures framework under s.17A MACC Act 2009 to defend against corporate liability for corruption.",
    category: "compliance",
    icon: Shield,
    color: "text-red-400",
    exampleScenario: "Mid-size construction company bidding for government contracts needs adequate procedures framework",
    formFields: [
      { id: "companyName", label: "Company Name", type: "text", placeholder: "e.g., ABC Construction Sdn Bhd", required: true },
      { id: "industry", label: "Industry / Sector", type: "select", required: true, options: [
        { value: "construction", label: "Construction & Infrastructure" },
        { value: "oil-gas", label: "Oil & Gas" },
        { value: "finance", label: "Financial Services" },
        { value: "manufacturing", label: "Manufacturing" },
        { value: "property", label: "Property Development" },
        { value: "healthcare", label: "Healthcare & Pharmaceutical" },
        { value: "technology", label: "Technology" },
        { value: "trading", label: "Trading / Distribution" },
        { value: "plantation", label: "Plantation / Agriculture" },
        { value: "government-contractor", label: "Government Contractor / GLC" },
        { value: "other", label: "Other" },
      ]},
      { id: "companySize", label: "Company Size", type: "select", required: true, options: [
        { value: "micro", label: "Micro (< 5 employees)" },
        { value: "small", label: "Small (5-75 employees)" },
        { value: "medium", label: "Medium (75-200 employees)" },
        { value: "large", label: "Large (200+ employees)" },
        { value: "group", label: "Group of Companies" },
        { value: "listed", label: "Public Listed Company" },
      ]},
      { id: "riskAreas", label: "Key Risk Areas", type: "textarea", placeholder: "e.g., Government procurement, licensing, permit applications, customs clearance, agent/intermediary payments, political donations, sponsorships, entertainment expenses...", required: true },
      { id: "existingMeasures", label: "Existing Anti-Corruption Measures (if any)", type: "textarea", placeholder: "e.g., Code of conduct exists but not enforced, no whistleblower channel, no agent due diligence..." },
    ],
    buildPrompt: (v) => `Build a comprehensive Adequate Procedures framework under Section 17A of the Malaysian Anti-Corruption Commission Act 2009 for:

COMPANY: ${v.companyName}
INDUSTRY: ${v.industry}
SIZE: ${v.companySize}
KEY RISK AREAS: ${v.riskAreas}
EXISTING MEASURES: ${v.existingMeasures || "None currently in place"}

Based on the Prime Minister's Guidelines on Adequate Procedures (T.R.U.S.T. principles), create a tailored framework covering:

**T — Top Level Commitment**
- Board Anti-Corruption Policy
- Tone from the top measures
- Resource allocation
- Board oversight structure

**R — Risk Assessment**
- Corruption risk assessment matrix specific to ${v.industry}
- High-risk areas identification
- Risk mitigation measures per risk area

**U — Undertake Control Measures**
- Gift and hospitality policy (with specific thresholds)
- Agent/intermediary due diligence procedures
- Third-party risk management
- Financial controls and approval limits
- Conflict of interest policy
- Political and charitable donation policy
- Procurement controls

**S — Systematic Review, Monitoring and Enforcement**
- Compliance monitoring program
- Internal audit procedures
- KPIs for compliance
- Disciplinary framework

**T — Training and Communication**
- Training program by role level
- Communication strategy
- Annual certification requirements

Also include:
- Whistleblower Protection Policy (per Whistleblower Protection Act 2010)
- Implementation timeline for a ${v.companySize} company
- Estimated budget range
- Annual review schedule`
  },
  {
    id: "ssm-filing",
    name: "SSM Filing Navigator",
    shortName: "SSM Filing",
    description: "Identify exactly which SSM forms to file, deadlines, fees, and penalties for any corporate action.",
    category: "compliance",
    icon: Landmark,
    color: "text-cyan-400",
    formFields: [
      { id: "corporateAction", label: "Corporate Action / Event", type: "select", required: true, options: [
        { value: "incorporate", label: "New Company Incorporation" },
        { value: "director-change", label: "Change of Director (Appointment/Resignation/Removal)" },
        { value: "secretary-change", label: "Change of Company Secretary" },
        { value: "share-allotment", label: "Allotment of Shares" },
        { value: "share-transfer", label: "Transfer of Shares" },
        { value: "annual-return", label: "Annual Return" },
        { value: "financial-statements", label: "Financial Statements Lodgement" },
        { value: "change-name", label: "Change of Company Name" },
        { value: "change-address", label: "Change of Registered Address" },
        { value: "amend-constitution", label: "Alteration of Constitution" },
        { value: "register-charge", label: "Registration of Charge / Debenture" },
        { value: "strike-off", label: "Application to Strike Off Company" },
        { value: "winding-up", label: "Voluntary Winding Up" },
        { value: "convert-company", label: "Conversion (Private to Public / Vice Versa)" },
        { value: "branch-registration", label: "Foreign Company Branch Registration" },
        { value: "special-resolution", label: "Lodgement of Special Resolution" },
        { value: "capital-reduction", label: "Capital Reduction" },
        { value: "financial-assistance", label: "Financial Assistance (Whitewash)" },
      ]},
      { id: "eventDate", label: "Date of Event / Resolution", type: "date" },
      { id: "companyType", label: "Company Type", type: "select", required: true, options: [
        { value: "sdn-bhd", label: "Private Company (Sdn Bhd)" },
        { value: "bhd", label: "Public Company (Bhd)" },
        { value: "listed", label: "Listed Company" },
        { value: "foreign", label: "Foreign Company" },
        { value: "clbg", label: "Company Limited by Guarantee" },
      ]},
      { id: "additionalDetails", label: "Additional Details", type: "textarea", placeholder: "Any specific details about the corporate action..." },
    ],
    buildPrompt: (v) => `Provide complete SSM filing guidance for: ${v.corporateAction} by a ${v.companyType}
${v.eventDate ? `Event/Resolution Date: ${v.eventDate}` : ""}
${v.additionalDetails ? `Details: ${v.additionalDetails}` : ""}

For this corporate action, provide:
1. **Exact SSM Form(s) Required** — form name, section reference
2. **Filing Deadline** — exact number of days from event date, with ${v.eventDate ? "calculated calendar deadline" : "formula"}
3. **Filing Fee** — exact amount in RM
4. **Supporting Documents Required** — list everything that must be attached
5. **Penalty for Late Filing** — fine amount, compounding, potential prosecution
6. **Step-by-Step Filing Process** — how to file via MyCoID/MBRS
7. **Pre-Requisites** — any prior approvals, resolutions, or filings needed first
8. **Common Mistakes to Avoid** — practical tips from experience
9. **Related Filings** — any additional filings triggered by this action (e.g., stamp duty, SC notification)

Reference specific CA 2016 sections throughout.`
  },
  {
    id: "stamp-duty",
    name: "Stamp Duty Calculator & Advisor",
    shortName: "Stamp Duty",
    description: "Calculate stamp duty on share transfers, loan agreements, tenancy agreements, and all corporate instruments under the Stamp Act 1949.",
    category: "compliance",
    icon: Receipt,
    color: "text-green-400",
    formFields: [
      { id: "instrumentType", label: "Type of Instrument", type: "select", required: true, options: [
        { value: "share-transfer", label: "Share Transfer (s.105 CA 2016)" },
        { value: "loan-agreement", label: "Loan / Facility Agreement" },
        { value: "debenture", label: "Debenture / Charge Document" },
        { value: "tenancy", label: "Tenancy Agreement" },
        { value: "sale-of-property", label: "Sale & Purchase of Property" },
        { value: "sha", label: "Shareholders Agreement" },
        { value: "jva", label: "Joint Venture Agreement" },
        { value: "service-agreement", label: "Service Agreement" },
        { value: "other", label: "Other Instrument" },
      ]},
      { id: "consideration", label: "Consideration / Value (RM)", type: "text", placeholder: "e.g., 5,000,000", required: true },
      { id: "marketValue", label: "Market Value (if different from consideration)", type: "text", placeholder: "e.g., 8,000,000 — for shares, based on NTA or valuation" },
      { id: "executionDate", label: "Date of Execution", type: "date" },
      { id: "additionalContext", label: "Additional Context", type: "textarea", placeholder: "e.g., transfer between related parties, exempt transaction, multiple instruments..." },
    ],
    buildPrompt: (v) => `Calculate the stamp duty payable and provide comprehensive stamp duty advice for:

INSTRUMENT TYPE: ${v.instrumentType}
CONSIDERATION: RM ${v.consideration}
${v.marketValue ? `MARKET VALUE: RM ${v.marketValue}` : ""}
${v.executionDate ? `EXECUTION DATE: ${v.executionDate}` : ""}
${v.additionalContext ? `CONTEXT: ${v.additionalContext}` : ""}

Provide:
1. **Stamp Duty Calculation** — exact amount payable, show working
2. **Basis of Assessment** — consideration vs market value (whichever higher per Stamp Act 1949)
3. **Applicable Rate** — exact rate and Stamp Act schedule reference
4. **Payment Deadline** — 30 days from execution for Malaysian instruments
5. **Late Payment Penalty** — penalty rates (5% within 3 months, 10% within 6 months, 20% beyond)
6. **Exemptions/Relief Available** — any applicable exemptions (e.g., restructuring relief under s.15/15A, related company relief)
7. **Adjudication** — whether LHDN adjudication is required
8. **Practical Process** — how to stamp at LHDN (STAMPS system)
9. **Related Instruments** — any other instruments arising from the same transaction that need stamping`
  },
  {
    id: "compliance-calendar",
    name: "Annual Compliance Calendar",
    shortName: "Compliance Calendar",
    description: "Generate a full-year compliance calendar with all statutory deadlines based on your company's financial year end.",
    category: "compliance",
    icon: CalendarClock,
    color: "text-teal-400",
    formFields: [
      { id: "companyName", label: "Company Name", type: "text", placeholder: "e.g., ABC Sdn Bhd", required: true },
      { id: "fyeMonth", label: "Financial Year End Month", type: "select", required: true, options: [
        { value: "January", label: "January" }, { value: "February", label: "February" },
        { value: "March", label: "March" }, { value: "April", label: "April" },
        { value: "May", label: "May" }, { value: "June", label: "June" },
        { value: "July", label: "July" }, { value: "August", label: "August" },
        { value: "September", label: "September" }, { value: "October", label: "October" },
        { value: "November", label: "November" }, { value: "December", label: "December" },
      ]},
      { id: "fyeYear", label: "Financial Year End Year", type: "text", placeholder: "e.g., 2024", required: true },
      { id: "companyType", label: "Company Type", type: "select", required: true, options: [
        { value: "sdn-bhd", label: "Private Company (Sdn Bhd)" },
        { value: "bhd-unlisted", label: "Public Unlisted Company (Bhd)" },
        { value: "listed", label: "Public Listed Company (Bursa)" },
      ]},
      { id: "incorporationDate", label: "Date of Incorporation", type: "date", helpText: "For annual return calculation" },
      { id: "auditExempt", label: "Audit Exempt?", type: "select", options: [
        { value: "no", label: "No — Full audit required" },
        { value: "yes-dormant", label: "Yes — Dormant company" },
        { value: "yes-threshold", label: "Yes — Below threshold (revenue < RM300k)" },
      ]},
    ],
    buildPrompt: (v) => `Generate a comprehensive annual corporate compliance calendar for:

COMPANY: ${v.companyName}
TYPE: ${v.companyType}
FINANCIAL YEAR END: ${v.fyeMonth} ${v.fyeYear}
${v.incorporationDate ? `INCORPORATION DATE: ${v.incorporationDate}` : ""}
AUDIT STATUS: ${v.auditExempt || "Full audit required"}

Create a month-by-month compliance calendar covering the FULL 12-month cycle following the FYE, including:

**Financial Reporting:**
- Preparation of financial statements
- Audit completion deadline
- Circulation to members deadline (within 6 months of FYE)
- Lodgement with SSM (within 30 days of circulation/AGM)

**AGM (if applicable — ${v.companyType === "sdn-bhd" ? "optional for Sdn Bhd" : "mandatory"}):**
- AGM deadline (within 6 months of FYE for public companies)
- Notice period requirements

**Annual Return (s.68):**
- Filing deadline (within 30 days of incorporation anniversary)
- Fee: RM50 (private) / RM500 (public)

**Tax Compliance:**
- Form C submission deadline (within 7 months of FYE)
- CP204 estimated tax (30 days before start of basis period)
- CP204A revision deadlines (6th and 9th month)
- Monthly tax installment dates

**Other Statutory Obligations:**
- Insurance renewals
- Secretary qualification verification
- Director standing verification
- Register maintenance
- MACC Act compliance review
${v.companyType === "listed" ? "- Bursa quarterly reporting deadlines\n- Annual report publication deadline\n- SC notifications" : ""}

Format as a clear calendar table: Month | Deadline | Obligation | CA 2016 Section | Penalty for Non-Compliance. Calculate actual dates based on FYE ${v.fyeMonth} ${v.fyeYear}.`
  },
  {
    id: "client-letter",
    name: "Client Advisory Letter",
    shortName: "Client Letter",
    description: "Generate professional client advisory letters, engagement letters, and legal updates on corporate law developments.",
    category: "advisory",
    icon: PenTool,
    color: "text-pink-400",
    formFields: [
      { id: "letterType", label: "Letter Type", type: "select", required: true, options: [
        { value: "advisory", label: "Legal Advisory Letter" },
        { value: "engagement", label: "Engagement / Retainer Letter" },
        { value: "legal-update", label: "Client Legal Update / Alert" },
        { value: "completion", label: "Completion Letter / Confirmation" },
        { value: "demand", label: "Letter of Demand (Corporate)" },
        { value: "undertaking", label: "Letter of Undertaking" },
      ]},
      { id: "firmName", label: "Your Firm Name", type: "text", placeholder: "e.g., Messrs. Lee & Partners" },
      { id: "clientName", label: "Client Name", type: "text", placeholder: "e.g., Dato' Ahmad bin Abdullah, Managing Director of ABC Sdn Bhd", required: true },
      { id: "subject", label: "Subject Matter", type: "text", placeholder: "e.g., Proposed Share Buy-Back by ABC Sdn Bhd", required: true },
      { id: "content", label: "Key Points / Instructions", type: "textarea", placeholder: "Describe the advice, update, or instructions you want to convey to the client...", required: true },
      { id: "tone", label: "Tone", type: "select", options: [
        { value: "formal", label: "Formal / Traditional" },
        { value: "professional", label: "Professional / Modern" },
        { value: "urgent", label: "Urgent / Time-Sensitive" },
      ]},
    ],
    buildPrompt: (v) => `Draft a ${v.letterType} ${v.firmName ? `from ${v.firmName}` : ""} to ${v.clientName} regarding: ${v.subject}

KEY CONTENT:
${v.content}

TONE: ${v.tone || "Professional"}

Draft in proper Malaysian legal correspondence format with:
- Firm letterhead reference (Our Ref / Your Ref)
- Proper salutation (using Malaysian honorifics: Dato', Tan Sri, etc. if applicable)
- Clear subject line
- Professional opening referencing the matter
- Substantive content with legal analysis where relevant
- Clear action items or next steps
- Appropriate disclaimers/qualifications
- Professional closing
${v.letterType === "engagement" ? "\nInclude: scope of work, fees and billing, team, conflict check, terms of engagement, data protection, termination" : ""}
${v.letterType === "demand" ? "\nInclude: statement of facts, legal basis, demand with timeline, consequences of non-compliance" : ""}
${v.letterType === "undertaking" ? "\nInclude: clear undertaking terms, conditions, timeline, consequences of breach" : ""}`
  },
  {
    id: "sha-builder",
    name: "SHA Clause Builder",
    shortName: "SHA Builder",
    description: "Build customized shareholders agreement clauses — drag-along, tag-along, deadlock, pre-emption, reserved matters, and more.",
    category: "drafting",
    icon: Users,
    color: "text-indigo-400",
    formFields: [
      { id: "clauseType", label: "Clause Type to Draft", type: "select", required: true, options: [
        { value: "pre-emption", label: "Pre-Emption Rights / Right of First Refusal" },
        { value: "drag-along", label: "Drag-Along Rights" },
        { value: "tag-along", label: "Tag-Along / Co-Sale Rights" },
        { value: "deadlock", label: "Deadlock Resolution Mechanism" },
        { value: "reserved-matters", label: "Reserved Matters / Veto Rights" },
        { value: "board-composition", label: "Board Composition & Nomination Rights" },
        { value: "dividend-policy", label: "Dividend Policy" },
        { value: "non-compete", label: "Non-Compete & Non-Solicitation" },
        { value: "information-rights", label: "Information Rights & Reporting" },
        { value: "exit-mechanisms", label: "Exit Mechanisms (Put/Call Options)" },
        { value: "anti-dilution", label: "Anti-Dilution Protection" },
        { value: "transfer-restrictions", label: "Transfer Restrictions & Lock-Up" },
        { value: "new-issue", label: "New Issue / Subscription Rights" },
        { value: "full-sha", label: "Full Shareholders Agreement Structure" },
      ]},
      { id: "shareholdingStructure", label: "Shareholding Structure", type: "textarea", placeholder: "e.g., Party A: 60%, Party B: 30%, Party C: 10%", required: true },
      { id: "companyDescription", label: "Company / JV Description", type: "textarea", placeholder: "Brief description of the company, its business, and the commercial context of the SHA...", required: true },
      { id: "specificTerms", label: "Specific Terms / Requirements", type: "textarea", placeholder: "e.g., Drag-along threshold: 75%, Notice period: 30 days, Valuation method: Independent valuer..." },
      { id: "protectParty", label: "Clause Should Primarily Protect", type: "select", options: [
        { value: "majority", label: "Majority Shareholder" },
        { value: "minority", label: "Minority Shareholder" },
        { value: "balanced", label: "Balanced / Neutral" },
        { value: "investor", label: "Investor / PE Fund" },
      ]},
    ],
    buildPrompt: (v) => `Draft a ${v.clauseType} clause for a Malaysian Shareholders Agreement:

SHAREHOLDING: ${v.shareholdingStructure}
COMPANY: ${v.companyDescription}
SPECIFIC TERMS: ${v.specificTerms || "Standard market terms"}
PROTECTION BIAS: ${v.protectParty || "Balanced"}

Draft the clause in proper Malaysian SHA drafting style with:
1. Clear definitions
2. Operative provisions with precise mechanics (notice, timelines, valuation)
3. Fallback mechanisms if primary mechanism fails
4. Interaction with CA 2016 provisions (ensure SHA does not conflict with mandatory statutory requirements)
5. Dispute resolution for clause-specific disputes
6. Common variations / alternatives for negotiation
7. Practical notes on enforceability under Malaysian law
8. Reference to relevant Malaysian case law on the clause type

${v.clauseType === "full-sha" ? "Provide a complete SHA structure/table of contents with key terms for each section." : ""}
Ensure the clause coordinates with the company's Constitution requirements under s.33 CA 2016.`
  },
  {
    id: "aml-checker",
    name: "AML/CFT Risk Assessment",
    shortName: "AML Check",
    description: "Conduct an AML/CFT risk assessment for corporate clients and transactions under AMLA 2001 and BNM guidelines.",
    category: "compliance",
    icon: AlertTriangle,
    color: "text-yellow-400",
    formFields: [
      { id: "clientType", label: "Client Type", type: "select", required: true, options: [
        { value: "individual", label: "Individual Client" },
        { value: "sdn-bhd", label: "Sdn Bhd (Private Company)" },
        { value: "bhd", label: "Public Company (Bhd)" },
        { value: "foreign", label: "Foreign Entity" },
        { value: "trust", label: "Trust / Foundation" },
        { value: "pep", label: "Politically Exposed Person" },
      ]},
      { id: "transactionType", label: "Transaction", type: "select", required: true, options: [
        { value: "company-formation", label: "Company Incorporation" },
        { value: "share-sale", label: "Share Sale / Transfer" },
        { value: "property-purchase", label: "Property Acquisition" },
        { value: "large-payment", label: "Large Cash / Wire Transfer" },
        { value: "offshore", label: "Offshore Structure / Cross-Border" },
        { value: "general", label: "General Client Onboarding" },
      ]},
      { id: "riskIndicators", label: "Risk Indicators Observed", type: "textarea", placeholder: "e.g., Complex ownership structure, nominee shareholders, unusual urgency, cash-heavy business, high-risk jurisdiction connections, reluctance to provide information...", required: true },
      { id: "jurisdictions", label: "Jurisdictions Involved", type: "textarea", placeholder: "e.g., Malaysia, BVI, Cayman Islands, Singapore" },
    ],
    buildPrompt: (v) => `Conduct an AML/CFT risk assessment under Malaysian law for:

CLIENT TYPE: ${v.clientType}
TRANSACTION: ${v.transactionType}
RISK INDICATORS: ${v.riskIndicators}
JURISDICTIONS: ${v.jurisdictions || "Malaysia only"}

Provide:
1. **Risk Rating** — Overall risk level (Low/Medium/High/Very High) with justification
2. **CDD Requirements** — Standard CDD, Enhanced CDD, or Simplified CDD under AMLA 2001 and BNM Anti-Money Laundering Policy
3. **Beneficial Ownership** — UBO identification requirements, verification steps
4. **Red Flags Analysis** — assess each risk indicator against FATF typologies and BNM AML/CFT guidelines
5. **Sanctions Screening** — requirement to screen against UN, OFAC, EU, and BNM sanctions lists
6. **STR Obligations** — when a Suspicious Transaction Report must be filed, process, legal protections
7. **Record Keeping** — retention requirements (6 years under AMLA)
8. **Ongoing Monitoring** — recommended monitoring frequency and triggers for review
9. **Firm's Obligations** — as a reporting institution under AMLA 2001 s.16
10. **Practical Recommendations** — specific steps to mitigate identified risks

Reference AMLA 2001, BNM AML/CFT Policy, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act, and relevant BNM guidelines.`
  },
  {
    id: "corporate-secretary",
    name: "Company Secretary Advisor",
    shortName: "CoSec Advisor",
    description: "Get guidance on company secretarial procedures, register maintenance, statutory books, and compliance obligations.",
    category: "compliance",
    icon: BookOpen,
    color: "text-lime-400",
    formFields: [
      { id: "queryType", label: "Query Category", type: "select", required: true, options: [
        { value: "registers", label: "Statutory Registers & Books" },
        { value: "meetings", label: "Board & General Meetings" },
        { value: "filings", label: "SSM Filings & Returns" },
        { value: "constitution", label: "Company Constitution Matters" },
        { value: "corporate-changes", label: "Corporate Changes (Name/Address/FYE)" },
        { value: "share-matters", label: "Share Capital Matters" },
        { value: "director-matters", label: "Director & Secretary Matters" },
        { value: "compliance-audit", label: "Annual Compliance Review" },
        { value: "best-practices", label: "Best Practices & Governance" },
      ]},
      { id: "specificQuestion", label: "Specific Question", type: "textarea", placeholder: "Describe your company secretarial question or scenario in detail...", required: true },
      { id: "companyType", label: "Company Type", type: "select", options: [
        { value: "sdn-bhd", label: "Private Company (Sdn Bhd)" },
        { value: "bhd", label: "Public Company (Bhd)" },
        { value: "listed", label: "Listed Company" },
      ]},
    ],
    buildPrompt: (v) => `As an expert Malaysian company secretary advisor, answer the following query:

CATEGORY: ${v.queryType}
COMPANY TYPE: ${v.companyType || "Private Company (Sdn Bhd)"}

QUESTION:
${v.specificQuestion}

Provide comprehensive guidance with:
1. Direct answer to the question
2. Applicable CA 2016 sections and requirements
3. Step-by-step procedure (if procedural query)
4. Required forms and documents
5. Timeline and deadlines
6. Fees payable (if any)
7. Penalties for non-compliance
8. Practical tips and best practices
9. Common errors to avoid
10. Relevant MAICSA (Malaysian Institute of Chartered Secretaries and Administrators) practice guidelines`
  },
  {
    id: "ipo-readiness",
    name: "IPO Readiness Assessment",
    shortName: "IPO Readiness",
    description: "Assess a company's readiness for listing on Bursa Malaysia (Main Market or ACE Market) with a comprehensive gap analysis.",
    category: "specialized",
    icon: TrendingUp,
    color: "text-purple-400",
    exampleScenario: "Technology company with RM200m revenue wants to assess Main Market listing readiness",
    formFields: [
      { id: "companyName", label: "Company Name", type: "text", placeholder: "e.g., TechPrime Sdn Bhd", required: true },
      { id: "industry", label: "Industry / Sector", type: "select", required: true, options: [
        { value: "technology", label: "Technology" },
        { value: "manufacturing", label: "Manufacturing" },
        { value: "property", label: "Property & Construction" },
        { value: "healthcare", label: "Healthcare" },
        { value: "consumer", label: "Consumer Products" },
        { value: "financial", label: "Financial Services" },
        { value: "energy", label: "Energy & Utilities" },
        { value: "plantation", label: "Plantation" },
        { value: "other", label: "Other" },
      ]},
      { id: "targetMarket", label: "Target Market", type: "select", required: true, options: [
        { value: "main", label: "Main Market (Bursa Malaysia)" },
        { value: "ace", label: "ACE Market (Bursa Malaysia)" },
        { value: "leap", label: "LEAP Market" },
      ]},
      { id: "revenue", label: "Latest Annual Revenue (RM)", type: "text", placeholder: "e.g., 200,000,000" },
      { id: "profitTrack", label: "Profit Track Record", type: "textarea", placeholder: "e.g., FY2022: RM15m, FY2023: RM22m, FY2024: RM30m net profit after tax", required: true },
      { id: "shareholders", label: "Current Shareholding Structure", type: "textarea", placeholder: "e.g., Founder A: 60%, Founder B: 20%, PE Fund: 15%, ESOP: 5%", required: true },
      { id: "concerns", label: "Key Concerns / Issues", type: "textarea", placeholder: "e.g., Related-party transactions, pending litigation, corporate restructuring needed, key-man dependency..." },
    ],
    buildPrompt: (v) => `Conduct a comprehensive IPO readiness assessment for listing on Bursa Malaysia:

COMPANY: ${v.companyName}
INDUSTRY: ${v.industry}
TARGET MARKET: ${v.targetMarket}
REVENUE: ${v.revenue || "Not specified"}
PROFIT TRACK RECORD: ${v.profitTrack}
SHAREHOLDING: ${v.shareholders}
CONCERNS: ${v.concerns || "None specified"}

Provide a full IPO readiness report covering:

1. **Eligibility Assessment** — Does the company meet the quantitative listing requirements for ${v.targetMarket === "main" ? "Main Market (profit test or market cap test)" : v.targetMarket === "ace" ? "ACE Market" : "LEAP Market"}?
2. **Corporate Restructuring Needed** — pre-IPO corporate structure, group reorganization, elimination of related-party transactions
3. **Corporate Governance Gaps** — board composition (independent directors), audit committee, nomination committee, MCCG compliance
4. **Financial Readiness** — audit trail, accounting standards (MFRS), historical financial clean-up, working capital adequacy
5. **Legal & Regulatory Compliance** — material contracts review, litigation exposure, regulatory approvals, IP protection, employment compliance
6. **Public Shareholding Spread** — minimum 25% public spread requirement, cornerstone investors, institutional placement
7. **Adviser Appointments** — principal adviser, underwriter, reporting accountant, solicitors, independent valuer, share registrar
8. **Timeline** — realistic IPO timeline from appointment of advisers to listing (typically 12-18 months)
9. **Estimated Costs** — SC fees, Bursa fees, professional fees, underwriting commission
10. **Key Risk Factors** — risks that SC/Bursa may flag
11. **Pre-IPO Action Items** — prioritized list of steps with timeline

Reference SC Equity Guidelines, Bursa Malaysia Listing Requirements, and MCCG 2021.`
  },
  {
    id: "employment-advisor",
    name: "Employment Law Advisor",
    shortName: "Employment Law",
    description: "Navigate Malaysian employment law issues in corporate transactions — retrenchment, transfer of undertaking, service contracts, and employee benefits.",
    category: "specialized",
    icon: Briefcase,
    color: "text-rose-400",
    exampleScenario: "Restructuring a company with 500 employees — need guidance on retrenchment and transfer of undertaking",
    formFields: [
      { id: "issueType", label: "Issue Type", type: "select", required: true, options: [
        { value: "retrenchment", label: "Retrenchment / VSS / MSS" },
        { value: "transfer-undertaking", label: "Transfer of Undertaking (s.20A EA)" },
        { value: "service-contract", label: "Executive Service Contracts" },
        { value: "termination", label: "Termination / Dismissal" },
        { value: "restructuring", label: "Corporate Restructuring Impact on Employees" },
        { value: "foreign-workers", label: "Foreign Workers & Immigration" },
        { value: "benefits", label: "Employee Benefits & SOCSO/EPF" },
        { value: "restraint-trade", label: "Restraint of Trade / Non-Compete" },
        { value: "industrial-dispute", label: "Industrial Dispute / IR" },
      ]},
      { id: "scenario", label: "Describe Your Scenario", type: "textarea", placeholder: "Describe the employment issue, number of affected employees, nature of business, any existing agreements...", required: true },
      { id: "employeeCount", label: "Number of Affected Employees", type: "text", placeholder: "e.g., 150" },
      { id: "urgency", label: "Timeline", type: "select", options: [
        { value: "immediate", label: "Immediate (within 30 days)" },
        { value: "short", label: "Short-term (1-3 months)" },
        { value: "medium", label: "Medium-term (3-6 months)" },
        { value: "planning", label: "Planning stage" },
      ]},
    ],
    buildPrompt: (v) => `Advise on the following Malaysian employment law issue in a corporate context:

ISSUE TYPE: ${v.issueType}
SCENARIO: ${v.scenario}
AFFECTED EMPLOYEES: ${v.employeeCount || "Not specified"}
TIMELINE: ${v.urgency || "Not specified"}

Provide comprehensive advice covering:
1. **Legal Framework** — applicable legislation (Employment Act 1955, Industrial Relations Act 1967, SOCSO Act 1969, EPF Act 1991, Minimum Wages Order)
2. **Legal Requirements & Procedure** — step-by-step process, notice requirements, mandatory notifications (Labour Department, SOCSO)
3. **Employee Entitlements** — termination benefits, lay-off benefits (Employment (Termination and Lay-Off Benefits) Regulations 1980), outstanding wages, accrued leave
4. **Risk Analysis** — unfair dismissal exposure under IRA 1967 s.20, constructive dismissal risk, IR Court claims
5. **Tax Implications** — tax treatment of compensation payments, exemptions
6. **Best Practices** — LIFO principle, selection criteria, consultation process, communication strategy
7. **Documentation Required** — letters, agreements, statutory notifications
8. **Estimated Costs** — severance calculations, legal costs
9. **Key Cases** — relevant Industrial Court / High Court / Federal Court decisions
10. **Practical Recommendations** — timeline and action plan

${v.issueType === "transfer-undertaking" ? "Focus specifically on s.20A Employment Act 1955 — automatic transfer of employees, preservation of terms, continuity of service, and interaction with M&A transaction structure." : ""}
${v.issueType === "retrenchment" ? "Address the Employment (Retrenchment) Notification Requirement under the Employment Act and Code of Conduct for Industrial Harmony 1975." : ""}`
  },
  {
    id: "cross-border",
    name: "Cross-Border Transaction Advisor",
    shortName: "Cross-Border",
    description: "Navigate regulatory requirements for cross-border M&A, foreign investments, and international JVs involving Malaysian companies.",
    category: "specialized",
    icon: Globe,
    color: "text-sky-400",
    exampleScenario: "Singapore PE fund acquiring 70% of a Malaysian manufacturing company with MITI approval needed",
    formFields: [
      { id: "transactionType", label: "Transaction Type", type: "select", required: true, options: [
        { value: "inbound-ma", label: "Inbound M&A (Foreign → Malaysia)" },
        { value: "outbound-ma", label: "Outbound M&A (Malaysia → Foreign)" },
        { value: "cross-border-jv", label: "Cross-Border Joint Venture" },
        { value: "foreign-branch", label: "Foreign Company Branch Registration" },
        { value: "rep-office", label: "Representative / Regional Office" },
        { value: "foreign-fund", label: "Foreign Fund Investment" },
      ]},
      { id: "description", label: "Transaction Description", type: "textarea", placeholder: "Describe the parties (nationality), target, deal structure, value, and commercial rationale...", required: true },
      { id: "sector", label: "Target Sector", type: "select", required: true, options: [
        { value: "manufacturing", label: "Manufacturing" },
        { value: "services", label: "Services" },
        { value: "property", label: "Property / Real Estate" },
        { value: "oil-gas", label: "Oil & Gas" },
        { value: "financial", label: "Financial Services (BNM-regulated)" },
        { value: "telco", label: "Telecommunications" },
        { value: "education", label: "Education" },
        { value: "healthcare", label: "Healthcare" },
        { value: "technology", label: "Technology / Digital" },
        { value: "plantation", label: "Plantation / Agriculture" },
      ]},
      { id: "foreignEquity", label: "Foreign Equity Percentage", type: "text", placeholder: "e.g., 70%" },
      { id: "jurisdictions", label: "Jurisdictions Involved", type: "textarea", placeholder: "e.g., Singapore, Malaysia, BVI" },
    ],
    buildPrompt: (v) => `Advise on the regulatory requirements for the following cross-border transaction involving Malaysia:

TYPE: ${v.transactionType}
DESCRIPTION: ${v.description}
SECTOR: ${v.sector}
FOREIGN EQUITY: ${v.foreignEquity || "Not specified"}
JURISDICTIONS: ${v.jurisdictions || "Not specified"}

Provide comprehensive cross-border advice covering:
1. **Foreign Equity Restrictions** — MITI equity policy, sector-specific restrictions, Bumiputera equity requirements, WRT/Services sub-sector conditions
2. **Regulatory Approvals Required** — EPU (for >RM50m acquisitions of local interest), MITI/MIDA, BNM (financial sector), SC (listed companies), FIC, CCPT
3. **Exchange Control** — BNM rules on cross-border capital flows, repatriation of dividends/profits, foreign currency borrowing
4. **Withholding Tax** — rates on dividends, interest, royalties, management fees, service fees; applicable DTAs
5. **Transfer Pricing** — LHDN transfer pricing guidelines, arm's length principle, TP documentation requirements
6. **Corporate Structure Options** — subsidiary vs branch vs representative office, holding company jurisdiction, tax-efficient structuring
7. **Competition Law** — Malaysia Competition Act 2010, merger control (if applicable)
8. **Data Protection** — PDPA 2010 cross-border transfer restrictions
9. **Immigration** — employment pass requirements for foreign personnel (EP, PVP, DP)
10. **Timeline & Process** — realistic timeline for all regulatory approvals
11. **Key Documents** — list of documents required for each approval

Reference specific Malaysian legislation, MITI guidelines, BNM regulations, and relevant bilateral agreements.`
  },
  {
    id: "dispute-resolution",
    name: "Dispute Resolution Advisor",
    shortName: "Dispute Resolution",
    description: "Analyze corporate disputes and recommend optimal resolution strategy — litigation, arbitration, mediation, or statutory remedies.",
    category: "litigation",
    icon: Swords,
    color: "text-red-500",
    exampleScenario: "Minority shareholder oppression claim against majority in a family-owned Sdn Bhd",
    formFields: [
      { id: "disputeType", label: "Nature of Dispute", type: "select", required: true, options: [
        { value: "shareholder-oppression", label: "Shareholder Oppression (s.346)" },
        { value: "derivative-action", label: "Derivative Action (s.347)" },
        { value: "breach-director-duty", label: "Breach of Directors' Duties" },
        { value: "breach-sha", label: "Breach of Shareholders Agreement" },
        { value: "breach-spa", label: "Breach of SPA / Post-Completion Dispute" },
        { value: "winding-up", label: "Just & Equitable Winding Up" },
        { value: "debt-recovery", label: "Corporate Debt Recovery" },
        { value: "jv-dispute", label: "Joint Venture Dispute" },
        { value: "ip-dispute", label: "IP / Trade Secret Dispute" },
        { value: "employment-dispute", label: "Senior Executive Dispute" },
      ]},
      {
        id: "caseDocs",
        label: "Case Documents & Correspondence",
        type: "files",
        helpText: "Upload the key documents — SHA/SPA/JVA, letters of demand, correspondence, pleadings, board minutes. The strategy will be grounded in the actual documents rather than a retyped summary.",
        filesHint: "Agreements, letters of demand, correspondence, pleadings — PDF, DOCX, TXT, MD, EML",
        filesHeading: "CASE DOCUMENTS & CORRESPONDENCE (uploaded by the practitioner — treat these as the factual and documentary record; extract the chronology, parties, contractual terms and dispute resolution clauses from them, citing the specific document and clause for each point):",
      },
      { id: "facts", label: "Key Facts (Optional if documents uploaded)", type: "textarea", placeholder: "Describe or supplement the dispute: parties involved, chronology of events, amounts in dispute, key documents, relationship between parties..." },
      { id: "relief", label: "Relief Sought", type: "textarea", placeholder: "e.g., Buyout order at fair value, damages for breach of warranty, injunction to prevent share disposal..." },
      { id: "existingClauses", label: "Dispute Resolution Clause (if any)", type: "textarea", placeholder: "Paste any existing arbitration or dispute resolution clause from the SHA/SPA/JVA..." },
      { id: "urgency", label: "Urgency", type: "select", options: [
        { value: "urgent-injunction", label: "Urgent — Need interim injunction" },
        { value: "normal", label: "Normal — Strategic planning" },
        { value: "defensive", label: "Defensive — Responding to claim" },
      ]},
    ],
    isValid: (v) =>
      Boolean(v.disputeType?.trim()) &&
      Boolean(v.facts?.trim() || v.caseDocs?.trim()),
    buildPrompt: (v) => `Advise on the optimal dispute resolution strategy for the following Malaysian corporate dispute:
${v.caseDocs ? `\n${v.caseDocs}\n` : ""}
DISPUTE TYPE: ${v.disputeType}
FACTS: ${v.facts?.trim() ? v.facts : "Derive the facts from the uploaded case documents above: reconstruct the chronology, identify the parties and their relationships, and note the amounts in dispute. Flag any factual gaps as assumptions."}
RELIEF SOUGHT: ${v.relief || "Not specified"}
EXISTING DR CLAUSE: ${v.existingClauses?.trim() ? v.existingClauses : v.caseDocs ? "Check the uploaded agreements for any arbitration or dispute resolution clause and apply it in the forum-selection analysis." : "None / silent"}
URGENCY: ${v.urgency || "Normal"}
${v.caseDocs ? "\nGround the entire strategy in the uploaded documents: cite the specific document and clause for each contractual point, and base the evidence strategy on what the uploaded record actually shows.\n" : ""}
Provide a comprehensive dispute resolution strategy covering:
1. **Cause of Action Analysis** — identify all viable causes of action, statutory basis (CA 2016, Contracts Act 1950), and relevant case law
2. **Forum Selection** — recommend Court (High Court / Commercial Division) vs AIAC Arbitration vs AIAC Mediation vs Statutory remedy, with pros/cons of each
3. **Interim Relief** — availability of Mareva injunctions, Anton Piller orders, injunctions to prevent share disposal or asset dissipation
4. **Evidence Strategy** — key documents needed, discovery obligations, expert evidence requirements
5. **Limitation Period** — applicable limitation period under Limitation Act 1953
6. **Estimated Costs** — court fees, legal fees range, arbitration costs, potential security for costs
7. **Timeline** — realistic timeline from filing to trial/hearing/award
8. **Settlement Strategy** — without prejudice offers, consent order possibilities, mediation timing
9. **Enforcement** — enforcement of judgment/award domestically and cross-border (if applicable)
10. **Key Cases** — leading Malaysian authorities on the dispute type
11. **Risk Assessment** — strengths and weaknesses of the claim, probability of success
12. **Recommended Action Plan** — prioritized steps with timeline

${v.disputeType === "shareholder-oppression" ? "Focus on s.346 CA 2016 — test for oppression (visible departure from fair dealing), available remedies (buyout order, regulation of future conduct, amendment of constitution), and key cases (Pioneer Haven, Pan-Pacific, Re Kong Thai Sawmill)." : ""}
${v.urgency === "urgent-injunction" ? "Emphasize urgent interim injunction procedure — ex parte vs inter partes application, American Cyanamid test in Malaysia, undertaking as to damages, timing." : ""}`
  },
  {
    id: "contract-review",
    name: "Contract Review & Markup",
    shortName: "Contract Review",
    description: "Upload or paste any commercial contract for AI-powered review — identify risks, missing clauses, and get suggested markup.",
    category: "advisory",
    icon: FileCheck,
    color: "text-emerald-500",
    exampleScenario: "Review a 20-page supply agreement for a manufacturing company",
    formFields: [
      {
        id: "contractDocs",
        label: "Upload the Contract",
        type: "files",
        helpText: "Upload the contract to review — the clause-by-clause analysis will be grounded in the uploaded document, so you don't need to paste it.",
        filesHint: "Full contract or relevant sections — PDF, DOCX, TXT, MD",
        filesHeading: "CONTRACT UNDER REVIEW (uploaded by the practitioner — perform the review on this document, quoting the exact clause numbers and language from it):",
      },
      { id: "contractText", label: "Or Paste the Contract Text (Optional if document uploaded)", type: "textarea", placeholder: "Paste the full contract or key clauses you want reviewed..." },
      { id: "contractType", label: "Contract Type", type: "select", required: true, options: [
        { value: "spa-shares", label: "Share Purchase Agreement (SPA)" },
        { value: "spa-asset", label: "Asset Purchase Agreement" },
        { value: "sha", label: "Shareholders Agreement" },
        { value: "jva", label: "Joint Venture Agreement" },
        { value: "service", label: "Service Agreement" },
        { value: "supply", label: "Supply / Distribution Agreement" },
        { value: "franchise", label: "Franchise Agreement" },
        { value: "license", label: "License / IP Agreement" },
        { value: "loan", label: "Loan / Facility Agreement" },
        { value: "nda", label: "Non-Disclosure Agreement" },
        { value: "employment", label: "Employment Contract" },
        { value: "tenancy", label: "Tenancy Agreement" },
        { value: "construction", label: "Construction Contract" },
        { value: "other", label: "Other Commercial Contract" },
      ]},
      { id: "actingFor", label: "You Are Acting For", type: "select", required: true, options: [
        { value: "party-a", label: "Party A (First Named)" },
        { value: "party-b", label: "Party B (Second Named)" },
        { value: "neutral", label: "Neutral Review" },
      ]},
      { id: "priorities", label: "Priority Areas (Optional)", type: "textarea", placeholder: "e.g., Focus on limitation of liability, IP ownership, termination rights, governing law..." },
    ],
    isValid: (v) =>
      Boolean(v.contractType?.trim()) &&
      Boolean(v.actingFor?.trim()) &&
      Boolean(v.contractText?.trim() || v.contractDocs?.trim()),
    buildPrompt: (v) => `Review the following ${v.contractType} under Malaysian law. I am acting for ${v.actingFor}.
${v.contractDocs ? `\n${v.contractDocs}\n` : ""}
CONTRACT TEXT:
${v.contractText?.trim() ? v.contractText : "Review the uploaded contract above. Quote the exact clause numbers and language from the uploaded document in your clause-by-clause analysis and suggested markup."}
${v.contractDocs && v.contractText?.trim() ? "\nGround the review in the uploaded contract: read the pasted text in the context of the full uploaded document, and cite exact clause numbers from it.\n" : ""}
${v.priorities ? `PRIORITY AREAS: ${v.priorities}` : ""}

Provide a comprehensive contract review with:
1. **Executive Summary** — overall assessment (Favorable / Balanced / Unfavorable for your client), key concerns
2. **Clause-by-Clause Analysis** — for each material clause:
   - Summary of effect
   - Risk level (High/Medium/Low) for your client
   - Market standard comparison
   - Suggested amendment with tracked-change-style markup
3. **Missing Clauses** — standard clauses for this contract type that are missing (force majeure, limitation of liability, IP assignment, data protection, anti-corruption, dispute resolution, etc.)
4. **Malaysian Law Issues** — provisions that may be unenforceable under Malaysian law (e.g., penalty clauses under Contracts Act 1950, restraint of trade, unconscionable terms)
5. **Stamp Duty** — stamp duty implications under Stamp Act 1949
6. **PDPA Compliance** — Personal Data Protection Act 2010 compliance check
7. **Negotiation Recommendations** — top 5 points to negotiate, ordered by priority
8. **Boilerplate Review** — governing law, jurisdiction, arbitration clause, notice provisions, assignment, entire agreement, severability`
  },
  {
    id: "islamic-finance",
    name: "Islamic Finance & Shariah Advisor",
    shortName: "Islamic Finance",
    description: "Navigate Shariah-compliant corporate structures, sukuk, Islamic banking facilities, and halal business compliance in Malaysia.",
    category: "specialized",
    icon: Building,
    color: "text-amber-500",
    exampleScenario: "Structuring a Shariah-compliant acquisition financing using murabahah facility",
    formFields: [
      { id: "queryType", label: "Query Type", type: "select", required: true, options: [
        { value: "sukuk", label: "Sukuk Issuance / Islamic Bond" },
        { value: "islamic-facility", label: "Islamic Banking Facility (Murabahah/Musharakah/Ijarah)" },
        { value: "shariah-compliant", label: "Shariah-Compliant Business Structure" },
        { value: "takaful", label: "Takaful / Islamic Insurance" },
        { value: "waqf", label: "Waqf / Islamic Endowment" },
        { value: "halal-cert", label: "Halal Certification for Business" },
        { value: "islamic-fund", label: "Islamic Fund / Unit Trust" },
        { value: "screening", label: "Shariah Stock Screening" },
      ]},
      { id: "scenario", label: "Describe Your Scenario", type: "textarea", placeholder: "Describe the Islamic finance transaction, structure, or compliance question...", required: true },
      { id: "amount", label: "Transaction Value (RM)", type: "text", placeholder: "e.g., 50,000,000" },
      { id: "parties", label: "Parties Involved", type: "textarea", placeholder: "e.g., Malaysian Sdn Bhd as customer, Islamic bank as financier, SPV as issuer..." },
    ],
    buildPrompt: (v) => `Advise on the following Islamic finance / Shariah compliance matter in Malaysia:

QUERY TYPE: ${v.queryType}
SCENARIO: ${v.scenario}
VALUE: ${v.amount || "Not specified"}
PARTIES: ${v.parties || "Not specified"}

Provide comprehensive Islamic finance advice covering:
1. **Shariah Principles Applicable** — identify the underlying Shariah contract (murabahah, musharakah, mudarabah, ijarah, istisna, wakalah, etc.) and its key requirements
2. **Regulatory Framework** — BNM Islamic Financial Services Act 2013 (IFSA), SC Guidelines on Sukuk, SAC rulings
3. **Structure & Documentation** — required transaction documents, flow of funds, asset requirements
4. **Shariah Advisory** — need for Shariah committee/advisor, SAC endorsement process
5. **Tax Treatment** — stamp duty neutrality provisions, income tax treatment, withholding tax for sukuk
6. **Comparison with Conventional** — key differences from conventional equivalent, cost implications
7. **Risk Factors** — Shariah non-compliance risk, re-characterization risk, event of default triggers
8. **Practical Timeline** — realistic timeline for structuring and execution
9. **Key Regulatory Approvals** — BNM, SC, or other approvals required
10. **Precedents** — reference landmark Malaysian Islamic finance transactions

Reference IFSA 2013, SC Guidelines on Islamic Securities, BNM Shariah Standards, and relevant SAC rulings.`
  },
  {
    id: "negotiation-points",
    name: "Negotiation Points Generator",
    shortName: "Negotiation Points",
    description: "Generate strategic negotiation points, fallback positions, and BATNA analysis for any corporate deal or agreement.",
    category: "advisory",
    icon: Handshake,
    color: "text-fuchsia-400",
    exampleScenario: "Negotiating a 60/40 JV agreement with a foreign technology partner",
    formFields: [
      { id: "dealType", label: "Deal Type", type: "select", required: true, options: [
        { value: "spa", label: "Share Purchase Agreement" },
        { value: "sha", label: "Shareholders Agreement" },
        { value: "jva", label: "Joint Venture Agreement" },
        { value: "asset-purchase", label: "Asset Purchase" },
        { value: "funding-round", label: "Investment / Funding Round" },
        { value: "licensing", label: "Technology / IP Licensing" },
        { value: "employment", label: "Senior Executive Terms" },
        { value: "settlement", label: "Dispute Settlement" },
      ]},
      { id: "context", label: "Deal Context", type: "textarea", placeholder: "Describe the deal: parties, values, key commercial terms already agreed, relationship dynamics, relative bargaining power...", required: true },
      { id: "actingFor", label: "You Are Acting For", type: "select", required: true, options: [
        { value: "buyer", label: "Buyer / Acquirer / Investor" },
        { value: "seller", label: "Seller / Target / Founder" },
        { value: "majority", label: "Majority Shareholder" },
        { value: "minority", label: "Minority / Incoming Shareholder" },
      ]},
      { id: "keyIssues", label: "Key Unresolved Issues", type: "textarea", placeholder: "e.g., Valuation gap, warranty scope, non-compete duration, board seats, earn-out structure..." },
      { id: "constraints", label: "Non-Negotiable Items", type: "textarea", placeholder: "e.g., Must retain operational control, minimum 2 board seats, no personal guarantees..." },
    ],
    buildPrompt: (v) => `Generate a comprehensive negotiation strategy and key negotiation points for:

DEAL TYPE: ${v.dealType}
CONTEXT: ${v.context}
ACTING FOR: ${v.actingFor}
KEY UNRESOLVED ISSUES: ${v.keyIssues || "Not specified"}
NON-NEGOTIABLES: ${v.constraints || "None stated"}

Provide:
1. **Negotiation Strategy Overview** — overall approach (collaborative vs competitive), leverage points, timing
2. **For Each Key Issue:**
   - Your ideal position (opening ask)
   - Market standard / benchmark
   - Acceptable compromise
   - Walk-away point (BATNA)
   - Suggested language for the agreement
3. **Package Trades** — issues that can be traded against each other (e.g., higher price for wider warranties)
4. **Malaysian Law Leverage Points** — statutory protections that strengthen your position (e.g., s.346 oppression, s.132 pre-emptive rights)
5. **Risk Allocation Matrix** — who bears what risk and why
6. **Common Traps** — negotiation tactics the other side may use and how to counter
7. **Draft Term Sheet** — a summary term sheet reflecting your ideal outcome
8. **Escalation Strategy** — what to do if negotiations stall

Frame all advice in the context of Malaysian corporate law and market practice.`
  },

  {
    id: "negotiation-simulator",
    name: "Mock Negotiation Simulator",
    shortName: "Negotiation Sim",
    description: "Practice negotiating against AI-powered opposing counsel with different personalities — aggressive, collaborative, evasive, or emotional. Build confidence handling tough counterparts.",
    category: "simulation",
    icon: Drama,
    color: "text-rose-400",
    exampleScenario: "Negotiate a shareholders' agreement with an aggressive opposing counsel representing the majority shareholder",
    formFields: [
      { id: "negotiationType", label: "Negotiation Type", type: "select", required: true, options: [
        { value: "spa", label: "Share Purchase Agreement / M&A" },
        { value: "sha", label: "Shareholders' Agreement" },
        { value: "jv", label: "Joint Venture Terms" },
        { value: "settlement", label: "Dispute Settlement / Compromise" },
        { value: "employment", label: "Executive Employment / Termination" },
        { value: "loan", label: "Loan / Financing Terms" },
        { value: "tenancy", label: "Commercial Tenancy / Lease" },
        { value: "ip-license", label: "IP / Technology Licensing" },
      ]},
      { id: "opposingPersonality", label: "Opposing Counsel Personality", type: "select", required: true, options: [
        { value: "aggressive-bulldozer", label: "The Bulldozer — Aggressive, intimidating, takes extreme positions" },
        { value: "smooth-talker", label: "The Smooth Talker — Charming but deceptive, hides traps in friendly language" },
        { value: "stonewall", label: "The Stonewall — Says very little, refuses to budge, poker face" },
        { value: "emotional-dramatic", label: "The Drama Queen — Emotional outbursts, threatens to walk away constantly" },
        { value: "know-it-all", label: "The Professor — Condescending, cites obscure provisions, talks down to you" },
        { value: "nice-but-firm", label: "The Iron Fist in Velvet Glove — Polite but absolutely unyielding on key points" },
        { value: "disorganized", label: "The Scatter — Unprepared, changes positions, wastes time" },
        { value: "old-school", label: "The Old Guard — Traditional, resistant to creative solutions, 'we've always done it this way'" },
      ]},
      { id: "scenario", label: "Scenario & Background", type: "textarea", placeholder: "Describe the deal: e.g., You represent the minority shareholder (30%) in a tech startup. The majority shareholder wants to bring in a new investor that would dilute your client to 15%...", required: true },
      { id: "yourPosition", label: "Your Client's Key Demands", type: "textarea", placeholder: "e.g., Anti-dilution protection, board seat, veto rights on major decisions, minimum exit price of RM5 million...", required: true },
      { id: "difficulty", label: "Difficulty Level", type: "select", required: true, options: [
        { value: "beginner", label: "Junior Associate — Opposing counsel is reasonable with some pushback" },
        { value: "intermediate", label: "Senior Associate — Significant pushback and tactical moves" },
        { value: "advanced", label: "Partner Level — Highly sophisticated, uses advanced tactics" },
        { value: "extreme", label: "War Room — Hostile, unpredictable, high-pressure" },
      ]},
    ],
    buildPrompt: (v) => `You are an opposing counsel in a mock negotiation exercise. Your personality type is: "${v.opposingPersonality}". Difficulty level: ${v.difficulty}.

NEGOTIATION TYPE: ${v.negotiationType}
SCENARIO: ${v.scenario}
THE LAWYER YOU ARE NEGOTIATING AGAINST WANTS: ${v.yourPosition}

Stay FULLY in character as the opposing counsel throughout. You represent the OTHER side.

Begin the negotiation by:
1. **Setting the Scene** — Briefly describe who you are, who you represent, and open with an initial position statement in character
2. **Your Opening Position** — State your client's key demands (which should conflict with what the lawyer wants)
3. **First Tactical Move** — Based on your personality type, make your first negotiation move (e.g., if aggressive, make an extreme demand; if smooth talker, offer something that sounds good but has hidden catches)
4. **Challenge Them** — Pose a specific question or challenge that forces them to respond

Keep all positions grounded in Malaysian corporate law. Reference specific CA 2016 sections, market practice, or legal principles to support your positions.

At the end, provide a [COACHING NOTE] section (clearly marked and separate from the roleplay) with:
- Key tactics this personality type commonly uses
- Recommended counter-strategies
- Malaysian law provisions that could strengthen the lawyer's position
- Red flags to watch for in this type of negotiation`
  },

  {
    id: "mediation-simulator",
    name: "Mock Mediation Simulator",
    shortName: "Mediation Sim",
    description: "Practice mediating disputes between parties with clashing personalities — from hostile shareholders to emotional business partners. Learn to manage difficult room dynamics.",
    category: "simulation",
    icon: UserRoundSearch,
    color: "text-teal-400",
    exampleScenario: "Mediate a shareholder deadlock between an emotional founder and a cold corporate investor demanding exit",
    formFields: [
      { id: "disputeType", label: "Dispute Type", type: "select", required: true, options: [
        { value: "shareholder-deadlock", label: "Shareholder Deadlock / Oppression" },
        { value: "partnership-breakup", label: "Business Partnership Dissolution" },
        { value: "employment-dispute", label: "Senior Executive Dismissal / Dispute" },
        { value: "contract-breach", label: "Commercial Contract Breach" },
        { value: "family-business", label: "Family Business Succession Conflict" },
        { value: "joint-venture", label: "Joint Venture Breakdown" },
        { value: "ip-dispute", label: "IP / Trade Secret Dispute" },
        { value: "construction", label: "Construction / Project Dispute" },
      ]},
      { id: "partyAProfile", label: "Party A — Personality & Role", type: "select", required: true, options: [
        { value: "angry-founder", label: "The Angry Founder — Built the company, feels betrayed, emotional" },
        { value: "cold-investor", label: "The Cold Investor — Numbers-only, no sentiment, wants maximum ROI" },
        { value: "passive-aggressive", label: "The Passive-Aggressive — Agrees to everything but sabotages behind the scenes" },
        { value: "family-elder", label: "The Family Patriarch/Matriarch — 'This is MY company, I built it from nothing'" },
        { value: "scared-minority", label: "The Frightened Minority — Intimidated, doesn't speak up, needs protection" },
        { value: "lawyer-up", label: "The Litigious One — 'My lawyer says I should sue. I want to sue.'" },
      ]},
      { id: "partyBProfile", label: "Party B — Personality & Role", type: "select", required: true, options: [
        { value: "entitled-heir", label: "The Entitled Heir — 'This company is my birthright, I deserve more'" },
        { value: "corporate-bully", label: "The Corporate Bully — Uses size and resources to intimidate" },
        { value: "reasonable-executive", label: "The Reasonable One — Wants fair resolution but has red lines" },
        { value: "blame-shifter", label: "The Blame Shifter — Everything is someone else's fault" },
        { value: "grieving-partner", label: "The Wounded Partner — Deeply hurt, trust completely broken" },
        { value: "strategic-player", label: "The Chess Player — Calm, calculating, always three moves ahead" },
      ]},
      { id: "scenario", label: "Dispute Background", type: "textarea", placeholder: "Describe the dispute: history, relationship between parties, key facts, amounts at stake, previous attempts at resolution...", required: true },
      { id: "role", label: "Your Role", type: "select", required: true, options: [
        { value: "mediator", label: "You are the Mediator — Neutral facilitator" },
        { value: "counsel-a", label: "You represent Party A — Advocate role" },
        { value: "counsel-b", label: "You represent Party B — Advocate role" },
      ]},
    ],
    buildPrompt: (v) => `You are simulating a mediation session for training purposes.

DISPUTE TYPE: ${v.disputeType}
PARTY A PERSONALITY: ${v.partyAProfile}
PARTY B PERSONALITY: ${v.partyBProfile}
SCENARIO: ${v.scenario}
THE TRAINEE'S ROLE: ${v.role}

Simulate both parties speaking in character. Present the mediation as a realistic scenario:

1. **Opening Statements** — Write opening statements from both Party A and Party B, fully in their respective character/personality. Show their emotions, body language cues [in brackets], and their stated positions.

2. **The Flashpoint** — Create a moment of tension where the two personalities clash (e.g., an accusation, an emotional outburst, a threat to walk out). Make it feel real and uncomfortable.

3. **Hidden Interests** — Reveal (subtly through dialogue) what each party actually wants beneath their stated positions.

4. **Your Turn** — Pose the situation to the trainee: "What do you say/do next?" Give them 3-4 specific options to consider, ranging from poor to excellent approaches.

5. **[COACHING NOTES]** (clearly separated):
   - Analysis of each party's underlying interests vs. stated positions
   - Power dynamics and how to manage them
   - Malaysian law relevant to this dispute (specific sections of CA 2016, Contracts Act 1950, or other legislation)
   - Common mediation techniques for this personality combination
   - BATNA analysis for each party
   - Warning signs that mediation might fail and alternatives (arbitration, court action)

Ground everything in Malaysian corporate law context and AIAC/KLRCA mediation practice.`
  },

  {
    id: "arbitration-simulator",
    name: "Arbitration Hearing Simulator",
    shortName: "Arbitration Sim",
    description: "Practice presenting cases before AI arbitrators with different temperaments — from patient academics to impatient commercial arbitrators. Sharpen your advocacy skills.",
    category: "simulation",
    icon: Mic,
    color: "text-amber-400",
    exampleScenario: "Present oral submissions to a strict arbitrator in a breach of shareholders' agreement dispute",
    formFields: [
      { id: "arbitrationType", label: "Arbitration Type", type: "select", required: true, options: [
        { value: "commercial", label: "Commercial Arbitration (AIAC Rules)" },
        { value: "construction", label: "Construction Arbitration (AIAC/CIPAA)" },
        { value: "investment", label: "Investment Arbitration" },
        { value: "maritime", label: "Maritime / Shipping Arbitration" },
        { value: "shareholder", label: "Shareholder Dispute Arbitration" },
        { value: "ip", label: "IP / Technology Dispute Arbitration" },
      ]},
      { id: "arbitratorStyle", label: "Arbitrator Temperament", type: "select", required: true, options: [
        { value: "strict-procedural", label: "The Stickler — Extremely procedural, interrupts for technical objections" },
        { value: "impatient-commercial", label: "The Timekeeper — Impatient, wants bottom line, 'get to the point counsel'" },
        { value: "academic-thorough", label: "The Scholar — Academic, asks deep doctrinal questions, loves legal theory" },
        { value: "hostile-skeptic", label: "The Skeptic — Questions everything, seems hostile to your case" },
        { value: "quiet-observer", label: "The Silent Judge — Says almost nothing, gives no indication of thinking" },
        { value: "interventionist", label: "The Intervener — Constantly asks questions, steers the hearing" },
      ]},
      { id: "claimSummary", label: "Your Case Summary", type: "textarea", placeholder: "Describe your client's claim/defense: key facts, cause of action, relief sought, main arguments, key evidence...", required: true },
      { id: "weaknesses", label: "Weaknesses in Your Case", type: "textarea", placeholder: "What are the weak points the other side will exploit? e.g., late notice, ambiguous contract clause, weak witness..." },
      { id: "stage", label: "Hearing Stage", type: "select", required: true, options: [
        { value: "opening", label: "Opening Submissions" },
        { value: "witness", label: "Witness Examination / Cross-Examination" },
        { value: "closing", label: "Closing Submissions" },
        { value: "costs", label: "Costs Submissions" },
      ]},
    ],
    buildPrompt: (v) => `You are an arbitrator in a mock arbitration hearing training exercise. Your temperament is: "${v.arbitratorStyle}".

ARBITRATION TYPE: ${v.arbitrationType}
HEARING STAGE: ${v.stage}
TRAINEE'S CASE: ${v.claimSummary}
KNOWN WEAKNESSES: ${v.weaknesses || "Not disclosed"}

Stay fully in character as the arbitrator. Simulate a realistic hearing:

1. **Set the Scene** — Describe the hearing room setup, who is present, and any preliminary matters. Open the hearing in character.

2. **Arbitrator's Opening** — In your character's style, address counsel (the trainee). Set expectations for the hearing. If you're the Stickler, raise a procedural point. If you're the Timekeeper, warn about time limits.

3. **The Challenge** — Based on the hearing stage:
   - If Opening: Ask a probing question about the trainee's strongest argument
   - If Witness: Simulate a hostile witness who gives evasive answers
   - If Closing: Challenge the trainee on a gap in their evidence
   - If Costs: Question the reasonableness of claimed costs

4. **Pressure Point** — Hit the known weakness. How does this arbitrator personality react to it? Force the trainee to address it.

5. **Opposing Counsel's Moment** — Simulate opposing counsel making a strong argument or objection that the trainee must respond to.

6. **[COACHING NOTES]** (clearly separated):
   - How to handle this type of arbitrator
   - Malaysian Arbitration Act 2005 provisions relevant to this scenario
   - AIAC Rules relevant procedural points
   - Advocacy tips specific to this hearing stage
   - How to address the case weaknesses effectively
   - Common mistakes to avoid before this type of arbitrator

All references should be to Malaysian arbitration law, AIAC Rules 2021, and Malaysian case law.`
  },

  {
    id: "client-consultation-trainer",
    name: "Client Consultation Trainer",
    shortName: "Client Trainer",
    description: "Practice handling different types of clients — from anxious first-time entrepreneurs to demanding tycoons and hostile litigants. Master the art of client management.",
    category: "simulation",
    icon: GraduationCap,
    color: "text-emerald-400",
    exampleScenario: "Handle an emotional family business owner who wants to disinherit a sibling from the company",
    formFields: [
      { id: "clientType", label: "Client Personality", type: "select", required: true, options: [
        { value: "anxious-entrepreneur", label: "The Anxious Entrepreneur — First business, overwhelmed, needs hand-holding" },
        { value: "demanding-tycoon", label: "The Demanding Tycoon — Expects instant answers, 'I pay you enough for this'" },
        { value: "confused-firsttimer", label: "The Confused First-Timer — No legal knowledge, asks basic questions repeatedly" },
        { value: "hostile-litigant", label: "The Hostile Litigant — Blames you for everything, threatens to change lawyers" },
        { value: "emotional-family", label: "The Emotional Family Member — Business is personal, can't separate emotions from decisions" },
        { value: "know-it-all-client", label: "The Google Lawyer — 'I've already researched this, your advice is wrong'" },
        { value: "indecisive-ditherer", label: "The Ditherer — Cannot make decisions, changes mind constantly, analysis paralysis" },
        { value: "secretive-client", label: "The Secret Keeper — Won't disclose full facts, hides problems, drip-feeds information" },
        { value: "bargain-hunter", label: "The Fee Fighter — Constantly questions fees, wants everything for free, 'why does this cost so much?'" },
        { value: "unrealistic-expectations", label: "The Dreamer — Expects impossible outcomes, 'just make it happen'" },
      ]},
      { id: "legalMatter", label: "Legal Matter", type: "select", required: true, options: [
        { value: "incorporate", label: "Company Incorporation & Startup Advice" },
        { value: "shareholders-dispute", label: "Shareholders' Dispute / Oppression Claim" },
        { value: "ma-deal", label: "M&A Transaction (Buying/Selling Business)" },
        { value: "compliance-issue", label: "Regulatory Compliance Problem / Investigation" },
        { value: "contract-dispute", label: "Contract Dispute / Breach" },
        { value: "employment-issue", label: "Employment Law Problem (Dismissal / Retrenchment)" },
        { value: "debt-recovery", label: "Debt Recovery / Insolvency Threat" },
        { value: "ip-protection", label: "IP Protection / Infringement" },
        { value: "family-succession", label: "Family Business Succession Planning" },
        { value: "regulatory-investigation", label: "SSM / SC / BNM Investigation" },
      ]},
      { id: "specificSituation", label: "Specific Situation", type: "textarea", placeholder: "Describe the client's situation in detail: e.g., 'Client is a 40-year-old second-generation family business owner. His brother (equal shareholder) has been siphoning company funds. He wants to remove his brother from the company but doesn't want to go to court because of their mother...'", required: true },
      { id: "difficulty", label: "Difficulty Level", type: "select", required: true, options: [
        { value: "junior", label: "Junior Associate — Client is somewhat cooperative" },
        { value: "mid", label: "Senior Associate — Client is challenging but manageable" },
        { value: "senior", label: "Partner Level — Client is extremely difficult" },
      ]},
    ],
    buildPrompt: (v) => `You are a client visiting a law firm for a consultation. Your personality type is: "${v.clientType}". Difficulty level: ${v.difficulty}.

LEGAL MATTER: ${v.legalMatter}
YOUR SITUATION: ${v.specificSituation}

Stay FULLY in character as this client throughout. You are NOT a lawyer — you are the client.

Begin the consultation by:

1. **Walk In** — Describe your body language, how you enter the room, your opening demeanor [in brackets describe physical cues]. Start talking as this character would — e.g., if anxious, ramble nervously; if demanding, immediately start giving orders.

2. **Tell Your Story** — Explain your legal problem AS this character would tell it. Include:
   - Relevant facts (but based on your personality, you might leave out key facts, exaggerate, or be emotional)
   - What you THINK the law says (which may be completely wrong)
   - What outcome you want (which may be unrealistic)
   - Hidden concerns you won't mention unless specifically asked

3. **The Curveball** — Drop a complicating factor that the lawyer didn't expect. Something that changes the legal analysis significantly (e.g., a secret agreement, an undisclosed debt, a family relationship, a deadline that's almost expired).

4. **Test the Lawyer** — Based on your personality, test the lawyer:
   - If demanding: challenge their competence or experience
   - If emotional: start crying or getting angry
   - If know-it-all: insist they're wrong about a legal point
   - If secretive: give contradictory information
   - If bargain-hunter: ask why they charge so much

5. **[COACHING NOTES]** (clearly separated from roleplay):
   - Communication strategies for this client type
   - Key information to extract and how to draw it out
   - Malaysian law applicable to this matter (specific sections)
   - Ethical obligations when dealing with this type of client (SBC Rules, legal profession ethics)
   - Red flags that this client type typically hides
   - Fee management advice for this personality
   - When to set boundaries or decline instructions

Ground everything in Malaysian corporate legal practice and Malaysian Bar professional conduct rules.`
  },

  {
    id: "board-presentation-simulator",
    name: "Board Presentation Simulator",
    shortName: "Board Sim",
    description: "Practice presenting legal advice to a board of directors with different personalities — skeptical chairman, aggressive shareholder representative, and disengaged directors. Master boardroom dynamics.",
    category: "simulation",
    icon: Presentation,
    color: "text-sky-400",
    exampleScenario: "Present a corporate restructuring proposal to a board with a hostile activist shareholder and a cautious chairman",
    formFields: [
      { id: "presentationTopic", label: "Presentation Topic", type: "select", required: true, options: [
        { value: "ma-proposal", label: "M&A / Acquisition Proposal" },
        { value: "restructuring", label: "Corporate Restructuring" },
        { value: "compliance-update", label: "Regulatory Compliance Update / Risk Report" },
        { value: "litigation-report", label: "Litigation Status / Risk Assessment" },
        { value: "governance-reform", label: "Corporate Governance Reform" },
        { value: "ipo-readiness", label: "IPO Readiness / Listing Proposal" },
        { value: "crisis-management", label: "Crisis Management / Investigation Report" },
        { value: "related-party", label: "Related Party Transaction Approval" },
      ]},
      { id: "boardComposition", label: "Board Personality Mix", type: "select", required: true, options: [
        { value: "hostile-board", label: "Hostile Board — Activist shareholder + skeptical INED + controlling MD" },
        { value: "disengaged-board", label: "Disengaged Board — Members checking phones, rubber-stamping, not reading papers" },
        { value: "divided-board", label: "Divided Board — Two factions with opposing views, each lobbying you" },
        { value: "micromanager-board", label: "Micromanager Board — Chairman who questions every line item and legal detail" },
        { value: "crisis-board", label: "Crisis Board — Panicking, looking for someone to blame, demanding immediate answers" },
        { value: "sophisticated-board", label: "Sophisticated Board — Highly knowledgeable, asks expert-level questions" },
      ]},
      { id: "scenario", label: "Scenario Details", type: "textarea", placeholder: "Describe the specific situation you're presenting about: the company, its financial position, the issue at hand, any political dynamics on the board...", required: true },
      { id: "challengeLevel", label: "Challenge Level", type: "select", required: true, options: [
        { value: "moderate", label: "Moderate — Some tough questions but generally receptive" },
        { value: "difficult", label: "Difficult — Aggressive questioning, conflicting agendas" },
        { value: "extreme", label: "Extreme — Hostile environment, potential for personal attacks" },
      ]},
    ],
    buildPrompt: (v) => `You are simulating a board of directors meeting for training purposes. Board personality mix: "${v.boardComposition}". Challenge level: ${v.challengeLevel}.

PRESENTATION TOPIC: ${v.presentationTopic}
SCENARIO: ${v.scenario}

Simulate a realistic board meeting with multiple director characters:

1. **The Boardroom** — Set the scene: describe who is seated where, the atmosphere, any tension in the room [in brackets describe body language and dynamics].

2. **Chairman Opens** — The Chairman (in character based on the board type) opens the agenda item and invites the lawyer (trainee) to present.

3. **Director Reactions** — After a brief moment for the trainee to begin, have 2-3 different directors interject with questions or comments, each in their distinct personality:
   - One supportive but with concerns
   - One hostile or skeptical
   - One whose agenda is unclear

4. **The Tough Question** — Have the most difficult board member ask a question that:
   - Challenges the legal advice directly
   - Implies personal liability concerns for directors
   - Questions the cost or value of the legal work
   - Or puts the lawyer in a political bind between board factions

5. **The Surprise** — Introduce an unexpected development mid-presentation (e.g., a director reveals new information, a conflict of interest emerges, or someone threatens to resign).

6. **[COACHING NOTES]** (clearly separated):
   - How to handle each personality type in a boardroom setting
   - Malaysian director duties relevant to this topic (CA 2016 s.211-s.223)
   - Board procedural requirements (quorum, interested directors, voting)
   - Tips for presenting legal advice effectively to non-lawyers
   - Managing board politics while maintaining professional independence
   - Relevant MCCG practices and Bursa Listing Requirements

All references should be to Malaysian corporate governance framework and practice.`
  },
];
