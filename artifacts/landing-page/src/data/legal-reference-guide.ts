/**
 * Source-aware drafting aids for Malaysian legal work.
 *
 * These are practitioner issue-spotting guides, not filed precedents, legal
 * advice, or a representation that any instrument is current. A user must
 * verify the governing law, court/state rules, forms, practice directions,
 * parties, evidence, relief and filing requirements for the matter.
 */

export type LegalReferenceDomain =
  | "civil-irac"
  | "criminal"
  | "corporate-ccb"
  | "conveyance-accident"
  | "syariah"
  | "academic-firm"
  | "employment"
  | "probate-estate"
  | "judicial-review"
  | "banking-disputes"
  | "accident-claims"
  | "property-jurisdictions"
  | "sarawak";

export interface OfficialLegalSource {
  title: string;
  authority: string;
  jurisdiction: string;
  sourceUrl: string;
  checkedDate: string;
  verifiedUse: string;
  verificationLimit: string;
}

export interface DraftingSection {
  heading: string;
  prompts: string[];
}

export interface LegalReferenceGuide {
  id: LegalReferenceDomain;
  title: string;
  jurisdiction: string;
  scopeNote: string;
  caution: string;
  sources: OfficialLegalSource[];
  practitionerChecklist: string[];
  templateTitle: string;
  templateSections: DraftingSection[];
  finalReview: string[];
}

const CHECKED_DATE = "2026-09-23";

export const legalReferenceGuides: LegalReferenceGuide[] = [
  {
    id: "civil-irac",
    title: "Civil litigation and IRAC working guide",
    jurisdiction: "Malaysia; confirm the court, registry and territorial jurisdiction",
    scopeNote:
      "A neutral structure for early merits analysis and preparation of a civil claim or response. It does not select a cause of action, originating process, remedy or court.",
    caution:
      "Do not rely on monetary-jurisdiction figures or procedural descriptions without rechecking the current legislation, rules, registry directions and the official page. Calculate limitation separately and obtain review by Malaysian counsel.",
    sources: [
      {
        title: "Procedures In Civil Cases",
        authority: "Office of the Chief Registrar, Federal Court of Malaysia",
        jurisdiction: "Malaysia — civil courts",
        sourceUrl: "https://www.kehakiman.gov.my/en/procedures-civil-cases",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The page describes starting, trial and post-trial stages; distinguishes writ and originating-summons routes at a general level; and tells a prospective claimant to consider cause of action, limitation, evidence and costs.",
        verificationLimit:
          "Public orientation material, not a substitute for legislation, the Rules of Court, registry requirements or matter-specific advice. Any figures and procedural statements must be checked at use time.",
      },
      {
        title: "Federal Legislation Portal — legislation search",
        authority: "Attorney General's Chambers of Malaysia",
        jurisdiction: "Malaysia — federal legislation",
        sourceUrl: "https://lom.agc.gov.my/search-legislation.php",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page identifies itself as the Federal Legislation Portal and offers searches across principal Acts, amendment Acts and P.U. (A)/(B) instruments by title or content.",
        verificationLimit:
          "The portal is a research starting point. Consolidation status, commencement, amendments and any applicable state law still require instrument-level verification.",
      },
    ],
    practitionerChecklist: [
      "Record client identity, opposing parties, capacity, conflict-check result and privilege/confidentiality handling.",
      "Create a dated chronology separating client instructions, documents, admissions, disputed facts and inferences.",
      "Identify each proposed issue without assuming the client's preferred legal characterisation is correct.",
      "For every issue, locate the current primary legislation, rules and binding or persuasive authorities; record court, date, citation and proposition actually supported.",
      "Map each element to admissible evidence, likely witness, authenticity/foundation question and evidential gap.",
      "Check jurisdiction, standing, parties, pre-action requirements, service route, limitation and available relief with current official materials.",
      "Analyse both sides: strongest response, procedural objection, factual alternative and remedy/costs exposure.",
      "State what remains unknown and the concrete investigation needed before advice or filing.",
    ],
    templateTitle: "Source-led civil IRAC memorandum",
    templateSections: [
      {
        heading: "Mandate and question presented",
        prompts: [
          "Identify client, audience, purpose and the precise question without asserting an outcome.",
          "State the court/state assumptions and the date to which law was checked.",
        ],
      },
      {
        heading: "Material facts and chronology",
        prompts: [
          "Use numbered, sourced facts; label disputed or unverified instructions.",
          "List omitted documents, witnesses and facts that could change the analysis.",
        ],
      },
      {
        heading: "Issues and governing sources",
        prompts: [
          "Frame each issue neutrally and list primary sources before commentary.",
          "For every authority, state only the proposition verified from the source and note commencement or currency questions.",
        ],
      },
      {
        heading: "Application and counter-analysis",
        prompts: [
          "Apply each required element to supporting and adverse evidence.",
          "Address the best opposing construction and procedural route.",
        ],
      },
      {
        heading: "Provisional conclusion and next steps",
        prompts: [
          "Use calibrated language, identify dependencies, and avoid predicting a guaranteed outcome.",
          "Set out evidence collection, source checking, advice and filing decisions still required.",
        ],
      },
    ],
    finalReview: [
      "No quotation, holding, section, deadline or court requirement appears without source-level verification.",
      "Facts and legal conclusions are visibly separated.",
      "Relief, costs, enforcement and settlement alternatives are addressed without overstatement.",
    ],
  },
  {
    id: "criminal",
    title: "Criminal matter preparation guide",
    jurisdiction: "Malaysia; verify the charging jurisdiction, court and applicable procedure",
    scopeNote:
      "A defence-side matter organisation and issue-spotting aid. It does not advise on plea, bail, remand, disclosure, trial strategy or sentence.",
    caution:
      "Liberty interests and strict procedures require immediate advice from qualified criminal counsel. Never infer a deadline or detention entitlement from this guide.",
    sources: [
      {
        title: "Procedures In Criminal Cases",
        authority: "Malaysian Judiciary — Sabah State Court portal",
        jurisdiction: "Malaysia — criminal courts (general public guidance)",
        sourceUrl: "https://sabah.kehakiman.gov.my/en/procedures-criminal-cases",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The page provides general sections on remand, trial and post-trial, identifies courtroom participants and describes the trial-court hierarchy at a public-information level.",
        verificationLimit:
          "The page is introductory and may not capture current amendments, local directions or the facts affecting arrest, remand, bail, trial or appeal. Recheck primary sources immediately.",
      },
      {
        title: "Forms (Court)",
        authority: "Malaysian Judiciary — Johor State Court portal",
        jurisdiction: "Malaysia — court materials",
        sourceUrl: "https://johor.kehakiman.gov.my/en/forms-court",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched list links court-management forms and a Judiciary infographic concerning self-representation in criminal proceedings.",
        verificationLimit:
          "Presence on a download page does not establish that a form fits a particular case, registry or current filing process.",
      },
    ],
    practitionerChecklist: [
      "Preserve the exact charge, arrest/remand documents, bail terms, hearing record and all versions of disclosed material.",
      "Build a custody and procedural chronology using exact dates, times, locations, officers, applications, orders and source documents.",
      "Confirm identity, language, interpretation, vulnerability, medical needs and access-to-counsel issues with the client.",
      "Break the alleged offence into elements only after checking the current charging provision, amendments and commencement.",
      "Create prosecution and defence evidence tables covering witnesses, exhibits, continuity, identification, statements, digital evidence and disputed admissibility.",
      "Record exculpatory lines of inquiry and preservation requests without altering or coaching evidence.",
      "Separate client instructions from verified facts; record inconsistencies for privileged follow-up rather than silently resolving them.",
      "Have counsel verify all immediate procedural steps, court orders and review/appeal routes from current primary materials.",
    ],
    templateTitle: "Privileged criminal case preparation note",
    templateSections: [
      {
        heading: "Status and immediate safeguards",
        prompts: [
          "Record custody/bail status and the source for each procedural fact.",
          "List urgent welfare, interpretation, preservation and representation needs for counsel.",
        ],
      },
      {
        heading: "Charge and particulars",
        prompts: [
          "Reproduce the charge only from the operative document and attach its version.",
          "List each element as counsel has verified it; flag duplicity, particulars or jurisdiction questions for advice.",
        ],
      },
      {
        heading: "Evidence matrix",
        prompts: [
          "For each element, identify prosecution material, possible defence material, provenance and gaps.",
          "Do not state that evidence is admissible or inadmissible before legal review.",
        ],
      },
      {
        heading: "Defence issues and next instructions",
        prompts: [
          "Set out plausible issues neutrally, including facts that cut against each.",
          "List focused client questions and lawful investigation steps.",
        ],
      },
      {
        heading: "Counsel review record",
        prompts: [
          "Record statutes, rules and authorities checked, with versions and access dates.",
          "Record decisions made by counsel and matters expressly left open.",
        ],
      },
    ],
    finalReview: [
      "No plea, outcome or sentence is promised.",
      "Sensitive data is minimised and access-controlled.",
      "Every procedural assertion and proposed step is escalated for current-law review.",
    ],
  },
  {
    id: "corporate-ccb",
    title: "Corporate, commercial and banking matter guide",
    jurisdiction: "Malaysia; entity, transaction and regulator-specific verification required",
    scopeNote:
      "A due-diligence and drafting framework for corporate compliance and commercial/banking dispute preparation. It is not an SSM filing, beneficial-ownership determination or regulatory opinion.",
    caution:
      "Use the live SSM and regulator materials for the entity and filing concerned. Do not calculate statutory filing dates, identify a beneficial owner or state a financial-regulatory obligation from this summary.",
    sources: [
      {
        title: "Guidelines for the Reporting Framework for Beneficial Ownership of Companies",
        authority: "Companies Commission of Malaysia (SSM)",
        jurisdiction: "Malaysia — companies",
        sourceUrl:
          "https://www.ssm.com.my/bm/Pages/Legal_Framework/document/Guideline%20BO%20%28Revised%29%202025%20fair.pdf",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched guideline states that it assists companies with beneficial-ownership reporting, including identification criteria, senior-management information where an owner cannot be identified, and related obligations.",
        verificationLimit:
          "The guide is not reproduced here and no ownership conclusion is drawn. Confirm revision, commencement, entity coverage, transitional treatment and current SSM process before acting.",
      },
      {
        title: "Legislation",
        authority: "Bank Negara Malaysia",
        jurisdiction: "Malaysia — regulated financial services",
        sourceUrl: "https://www.bnm.gov.my/legislation",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The page provides regulator-hosted access to central banking and financial-services legislation and displays instrument-specific amendment/commencement notes.",
        verificationLimit:
          "BNM itself flags that at least some hosted text may not incorporate a later amendment. Check the AGC portal, gazette material and current BNM policy documents for the issue.",
      },
      {
        title: "Federal Legislation Portal",
        authority: "Attorney General's Chambers of Malaysia",
        jurisdiction: "Malaysia — federal legislation",
        sourceUrl: "https://lom.agc.gov.my/",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The portal publishes and provides search access to principal Acts, amendment Acts and subsidiary instruments.",
        verificationLimit:
          "Search results and online copies still require checking for amendments, commencement, subsidiary instruments and transaction-specific application.",
      },
    ],
    practitionerChecklist: [
      "Verify legal names, registration numbers, status, constitution, registered office, group structure and authorised representatives from current records.",
      "Map legal and beneficial ownership from primary records; log unanswered notices, nominees, control rights and conflicting evidence for specialist review.",
      "Build an authority matrix for board, shareholder, delegated and signatory approvals, including conflicts and interested-party issues.",
      "For a transaction, identify conditions, consents, security, completion deliverables, funds flow, post-completion filings and documentary dependencies.",
      "For a dispute, preserve the contract set, variations, notices, statements, facility/security documents, transaction data and communications with provenance.",
      "Check the entity-specific SSM guidance, current federal instruments, and any BNM legislation/policy documents actually applicable.",
      "Distinguish contractual breach, corporate compliance, regulatory exposure and evidential proof; do not collapse them into one conclusion.",
      "Record counsel, company-secretarial, tax, accounting and regulatory questions that require separate professional sign-off.",
    ],
    templateTitle: "Corporate / CCB verification memorandum",
    templateSections: [
      {
        heading: "Entity and mandate",
        prompts: [
          "State verified entity identifiers, client capacity and scope of instructions.",
          "Attach the records relied upon and their retrieval dates.",
        ],
      },
      {
        heading: "Transaction or dispute architecture",
        prompts: [
          "List operative documents, parties, governing-law/forum clauses, security and dependencies.",
          "Create separate contractual, corporate and regulatory issue lists.",
        ],
      },
      {
        heading: "Authority and compliance matrix",
        prompts: [
          "Record each required approval or filing, source, responsible person and verification status.",
          "Mark timing as 'requires calculation' until checked against current official material.",
        ],
      },
      {
        heading: "Evidence and risk analysis",
        prompts: [
          "Link each position to a document, witness or data source and identify contrary material.",
          "Use ranges and dependencies rather than unsupported certainty.",
        ],
      },
      {
        heading: "Actions and professional referrals",
        prompts: [
          "Separate legal actions from company-secretarial, tax, accounting and regulatory tasks.",
          "Name the reviewer required and source that must be rechecked before execution or filing.",
        ],
      },
    ],
    finalReview: [
      "No SSM or BNM status, approval or filing is assumed from a client-supplied copy.",
      "Beneficial ownership is treated as a fact-and-control inquiry requiring current guidance.",
      "Execution, perfection and filing steps receive independent current-law verification.",
    ],
  },
  {
    id: "conveyance-accident",
    title: "Conveyancing and road-accident file guide",
    jurisdiction: "Peninsular Malaysia for the cited JKPTG material; accident forum and location must be confirmed",
    scopeNote:
      "A dual-purpose evidence and workflow guide. Conveyancing and accident claims remain separate legal workflows and must be reviewed under the law governing the land or incident.",
    caution:
      "The National Land Code framework is not a safe assumption for every Malaysian land matter, especially Sabah or Sarawak. Accident reporting, limitation, insurance and compensation questions require immediate current advice; no deadline is supplied here.",
    sources: [
      {
        title: "Land Management FAQ",
        authority: "Department of Director General of Lands and Mines (JKPTG)",
        jurisdiction: "Peninsular Malaysia — land administration",
        sourceUrl: "https://www.jkptg.gov.my/en/soalan-lazim-3/42-faq/pengurusan-tanah",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The official FAQ discusses land-transaction administration and, in a gift-transfer example, refers users to attestation, valuation/stamp-duty and presentation stages.",
        verificationLimit:
          "An FAQ and example are not a transaction checklist. State authority requirements, title conditions, consent, tax, duty, forms and professional obligations must be checked independently.",
      },
      {
        title: "Procedures In Civil Cases",
        authority: "Office of the Chief Registrar, Federal Court of Malaysia",
        jurisdiction: "Malaysia — civil courts",
        sourceUrl: "https://www.kehakiman.gov.my/en/procedures-civil-cases",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The Judiciary page lists motor-vehicle accident and personal-injury claims as examples of civil claims and highlights cause of action, limitation, evidence and costs as pre-filing considerations.",
        verificationLimit:
          "It does not provide an accident-reporting, insurer-notification, damages or limitation protocol. Those matters require current source and fact-specific verification.",
      },
      {
        title: "Cara Membuat Repot Polis",
        authority: "Royal Malaysia Police",
        jurisdiction: "Malaysia — police reports, including traffic reports",
        sourceUrl: "https://www.rmp.gov.my/cara-membuat-repot-polis",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched PDRM page explains oral and written police-report methods, states that reports may be made at a police station including for traffic cases, and gives general report-content guidance.",
        verificationLimit:
          "The page does not establish compliance for a particular accident, current traffic-report timing, investigation outcome, insurer notice or evidential effect. Confirm the specific requirements directly with PDRM and counsel.",
      },
    ],
    practitionerChecklist: [
      "Select the workflow first: land transaction, road-accident evidence/claim, or a connected dispute; never merge their assumptions.",
      "For land: verify title, land jurisdiction, proprietor, tenure, category/conditions, restrictions, encumbrances, caveats, consents and state authority requirements from current searches.",
      "For land: reconcile sale terms, financing, stakeholder sums, apportionments, tax/duty advice, completion documents, presentation and post-registration evidence.",
      "For an accident: record time, location, vehicles, occupants, conditions, scene evidence, witnesses, injuries, treatment and contemporaneous accounts without reconstruction or embellishment.",
      "Preserve original photographs/video, reports, medical records, repair evidence, income/loss documents, insurance communications and metadata.",
      "Identify potentially involved drivers, owners, employers, insurers and other parties without asserting liability before evidence and legal review.",
      "Ask counsel to verify reporting, notice, limitation, forum, evidence and expert requirements immediately from current sources.",
      "Maintain a provenance log and redact unnecessary personal/medical data from working copies.",
    ],
    templateTitle: "Conveyance or accident verification worksheet",
    templateSections: [
      {
        heading: "Matter classification and jurisdiction",
        prompts: [
          "Identify land state/title system or accident location/forum and explain the source.",
          "List every jurisdictional assumption requiring local review.",
        ],
      },
      {
        heading: "Parties, assets and records",
        prompts: [
          "Use verified identifiers and distinguish registered/legal interests from allegations.",
          "Index originals, searches, reports, media and communications with dates and custodians.",
        ],
      },
      {
        heading: "Chronology and dependencies",
        prompts: [
          "Record events in source-linked order.",
          "Describe any deadline only after a reviewer records the governing source and calculation.",
        ],
      },
      {
        heading: "Issue and evidence matrix",
        prompts: [
          "For conveyancing, cover title, authority, consent, finance, completion and registration.",
          "For accidents, cover occurrence, identity, causation, injury/loss, insurance and contrary evidence.",
        ],
      },
      {
        heading: "Verification and advice required",
        prompts: [
          "List official searches, forms, reports and professional advice still required.",
          "Assign each task without presenting this worksheet as a filing document.",
        ],
      },
    ],
    finalReview: [
      "The correct land jurisdiction and registry have been identified.",
      "No accident reporting route or time limit is inferred from generic web content.",
      "Original evidence and chain of custody/provenance are preserved.",
    ],
  },
  {
    id: "syariah",
    title: "State-specific Syariah matter guide",
    jurisdiction: "Malaysia — state/territory-specific Syariah jurisdiction must be identified",
    scopeNote:
      "An intake and source-verification structure for Syariah matters. It does not determine jurisdiction, available relief, proof, registration route or the effect of any civil-court proceeding.",
    caution:
      "Syariah enactments, rules, forms, practice directions and administration vary by state or Federal Territory. Never transplant a form or proposition from one jurisdiction to another.",
    sources: [
      {
        title: "Enakmen Tatacara Mal Mahkamah Syariah (Negeri Selangor) 2003",
        authority: "Selangor Syariah Judiciary Department (JAKESS)",
        jurisdiction: "Selangor only",
        sourceUrl:
          "https://www.jakess.gov.my/images/pdf/Enakmen%2C%20Kaedah%2C%20Peraturan/A-%20Enakmen/8/ENAKMEN-TATACARA-MAL-MAHKAMAH-SYARIAH-NEGERI-SELANGOR-2003.pdf",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official PDF identifies the Selangor enactment and contains its arrangement of sections, including commencement, parties, service, pleadings, disclosure, settlement and sulh.",
        verificationLimit:
          "A fetched historical enactment PDF is not proof of current consolidation, amendment status or the correct process for a matter. Confirm current gazette text, rules, practice directions and registry forms.",
      },
    ],
    practitionerChecklist: [
      "Identify the state/Federal Territory, court level, parties' status and the factual basis said to confer jurisdiction.",
      "Confirm matter classification and relief with the competent court's current official guidance; do not rely on labels alone.",
      "Obtain the current state enactments, rules, fees, forms, practice directions and registration instructions from official sources.",
      "Record marriage/divorce/ruju', maintenance, custody, property, estate or offence documents exactly as issued and check cross-border or civil-court interactions.",
      "Identify language, translation, service, wali/guardian, capacity, representation and confidentiality/safety issues for qualified review.",
      "Build a chronology and evidence table that distinguishes registered facts, documents, oral instructions and disputed assertions.",
      "Use only forms for the correct state, court, proceeding and version; retain the official download location and access date.",
      "Escalate urgent protection, child welfare, liberty, immigration or parallel-proceeding concerns immediately.",
    ],
    templateTitle: "State-specific Syariah intake and source note",
    templateSections: [
      {
        heading: "Jurisdiction and parties",
        prompts: [
          "Record the state/territory connection, court proposed and facts supporting jurisdiction.",
          "Mark the conclusion as pending Syariah counsel/registry confirmation.",
        ],
      },
      {
        heading: "Relief and classification",
        prompts: [
          "State the client's objective in neutral language.",
          "Record the official source used to verify case classification and available process.",
        ],
      },
      {
        heading: "Facts and documents",
        prompts: [
          "Prepare a sourced chronology and index all certificates, orders, agreements and communications.",
          "Identify safety, child, privacy and parallel-proceeding concerns.",
        ],
      },
      {
        heading: "State law and procedure verification",
        prompts: [
          "List each enactment, rule, practice direction and form with version/access date.",
          "Record registry confirmation and do not import another state's materials.",
        ],
      },
      {
        heading: "Open advice and filing questions",
        prompts: [
          "List proof, service, language, representation and enforcement questions.",
          "Identify the qualified reviewer and next official source check.",
        ],
      },
    ],
    finalReview: [
      "Every source and form matches the identified state or territory.",
      "No religious-law or jurisdictional conclusion is generated from generic intake facts.",
      "Sensitive family and child data is restricted to what the task requires.",
    ],
  },
  {
    id: "academic-firm",
    title: "Academic and law-firm research quality guide",
    jurisdiction: "Malaysia; adapt citation method and research hierarchy to the task",
    scopeNote:
      "A research, teaching and internal knowledge-management framework. It is not a source of legal propositions and must not be presented as a human-reviewed opinion.",
    caution:
      "Secondary summaries, teaching hypotheticals and AI output are not substitutes for primary sources. Copyright, confidentiality, privilege, database terms and assessment integrity still apply.",
    sources: [
      {
        title: "Federal Legislation Portal — legislation search",
        authority: "Attorney General's Chambers of Malaysia",
        jurisdiction: "Malaysia — federal legislation",
        sourceUrl: "https://lom.agc.gov.my/search-legislation.php",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The portal supports title/content searching across principal Acts, amendment Acts and subsidiary instruments, making it an official starting point for legislative research.",
        verificationLimit:
          "A research log must still capture the exact instrument, version, amendment and commencement checks; a portal search page is not authority for a proposition.",
      },
      {
        title: "Forms (Court)",
        authority: "Malaysian Judiciary — Johor State Court portal",
        jurisdiction: "Malaysia — selected court materials",
        sourceUrl: "https://johor.kehakiman.gov.my/en/forms-court",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The official court page demonstrates that forms and court information may be published through Judiciary/state-court portals.",
        verificationLimit:
          "It is not a comprehensive or universal forms library. Researchers must identify the issuing body, court, version and local applicability.",
      },
      {
        title: "Laws of Sarawak — Full Listing",
        authority: "Sarawak State Attorney-General's Chambers / Sarawak LawNet",
        jurisdiction: "Sarawak",
        sourceUrl: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=All",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The official listing exposes Sarawak ordinances and linked subsidiary materials, illustrating the need to include state-specific primary-source repositories.",
        verificationLimit:
          "Listing presence does not establish current consolidation, commencement or application to a research problem.",
      },
    ],
    practitionerChecklist: [
      "Define the question, audience, jurisdiction, date cut-off, deliverable and whether the work is teaching, assessment, client or internal knowledge work.",
      "Create a research plan prioritising constitutions, legislation/gazettes, rules, official directions and judgments before commentary.",
      "Maintain a query and source log with URL/database, document identifier, court/issuer, date, version and access date.",
      "Read the whole relevant passage and disposition; never infer a holding or statutory effect from a search snippet or headnote.",
      "Shepardise/note up authorities using available services and independently check treatment, appeal history, amendments and commencement.",
      "Mark quotations, paraphrases, translations, AI assistance and unresolved verification issues transparently.",
      "For firm use, apply conflicts, privilege, confidentiality, retention, access-control and supervisor-review processes.",
      "For academic use, distinguish hypothetical facts from law and comply with institution assessment and citation rules.",
    ],
    templateTitle: "Research provenance and review memorandum",
    templateSections: [
      {
        heading: "Question, scope and research date",
        prompts: [
          "State the issue, excluded issues, jurisdiction, audience and law-as-checked date.",
          "Identify whether the product is educational, internal or client-facing.",
        ],
      },
      {
        heading: "Method and source hierarchy",
        prompts: [
          "List repositories and search terms used.",
          "Explain how primary sources, later history and adverse material were checked.",
        ],
      },
      {
        heading: "Proposition table",
        prompts: [
          "Pair each proposition with a pinpoint source and verification status.",
          "Separate quotation, paraphrase, interpretation and unresolved inference.",
        ],
      },
      {
        heading: "Analysis and limitations",
        prompts: [
          "Present competing readings and the limits of available materials.",
          "Disclose inaccessible, unofficial, superseded or machine-generated material.",
        ],
      },
      {
        heading: "Reviewer sign-off",
        prompts: [
          "Name the human reviewer only after actual review; otherwise state 'not human-reviewed'.",
          "Record review date, scope, changes requested and sources rechecked.",
        ],
      },
    ],
    finalReview: [
      "No invented citation, case, quotation, pinpoint or reviewer status appears.",
      "The research trail is reproducible.",
      "The output distinguishes verified law from interpretation and open questions.",
    ],
  },
  {
    id: "employment",
    title: "Employment and labour dispute preparation guide",
    jurisdiction: "Malaysia; confirm the governing employment regime, workplace location and forum",
    scopeNote:
      "A neutral intake and evidence framework for workplace payment, discrimination, dismissal and industrial-relations issues. It does not decide employee status, coverage, forum, remedy or merits.",
    caution:
      "Employment routes and coverage are fact- and statute-specific, including distinct Sabah and Sarawak materials. Obtain prompt advice before resignation, dismissal, settlement, complaint or filing, and calculate every time limit from current primary sources.",
    sources: [
      {
        title: "Labour Case",
        authority: "Department of Labour Peninsular Malaysia (JTKSM)",
        jurisdiction: "Peninsular Malaysia — Labour Court public guidance",
        sourceUrl: "https://jtksm.mohr.gov.my/en/services/labour-case",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page describes Labour Court proceedings for specified monetary claims, lists examples of employee and employer claims, and flags coverage qualifications.",
        verificationLimit:
          "The page is a high-level service description, not a coverage opinion or complete claims procedure. Verify the current Act, schedule, regulations, forum guidance and facts; do not transplant it to Sabah or Sarawak.",
      },
      {
        title: "Industrial Court of Malaysia",
        authority: "Industrial Court of Malaysia",
        jurisdiction: "Malaysia — industrial relations",
        sourceUrl: "https://www.mp.gov.my/",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official portal links e-filing, e-mention, case management, hearing schedules, awards, practice notes, forms, legislation and sample statement materials.",
        verificationLimit:
          "A portal link or sample does not establish jurisdiction, a right to commence proceedings, an applicable deadline or acceptance of a document. Verify the live route and governing law.",
      },
    ],
    practitionerChecklist: [
      "Verify the parties, employing entity, work location, role, status asserted, reporting lines and all contract or policy versions.",
      "Build a dated chronology of recruitment, variations, pay, performance, complaints, discipline, leave, suspension, termination and post-employment events.",
      "Reconcile payslips, bank credits, time records, leave records, statutory statements and claimed shortfalls without assuming legal entitlement.",
      "Preserve letters, emails, messages, meeting notes, recordings and system exports lawfully, with provenance and access controls.",
      "Identify each possible route separately: internal process, Labour Department, Industrial Court, civil court, regulator or negotiated resolution; ask counsel to verify coverage and forum.",
      "Record comparators and alleged reasons neutrally in discrimination or retaliation issues; separate direct evidence, inference and disputed fact.",
      "Calculate every complaint, representation, filing and appeal date only after recording the operative source, triggering event and reviewer.",
      "Assess urgent income, immigration, confidentiality, data, safety, reference and return-of-property issues without threatening or destroying evidence.",
    ],
    templateTitle: "Employment dispute chronology and position note",
    templateSections: [
      {
        heading: "Relationship and coverage",
        prompts: [
          "Record entity, workplace, duties, remuneration and contract versions from source documents.",
          "List employee-status, statutory-coverage, territorial and forum questions for current-law review.",
        ],
      },
      {
        heading: "Events and process",
        prompts: [
          "Set out a source-linked chronology and identify each decision-maker.",
          "Distinguish allegations, responses, findings, reasons given and procedural gaps without drawing a premature conclusion.",
        ],
      },
      {
        heading: "Claim and response matrix",
        prompts: [
          "For each possible issue, map required facts, supporting/adverse evidence, disputed calculations and requested outcome.",
          "State the strongest opposing explanation and missing evidence.",
        ],
      },
      {
        heading: "Routes, deadlines and resolution",
        prompts: [
          "List possible internal, statutory, court and settlement routes as questions pending advice.",
          "Record source-checked dates, preservation steps, non-monetary terms and tax/regulatory referrals.",
        ],
      },
    ],
    finalReview: [
      "No forum, coverage, deadline or remedy is asserted from job title or salary alone.",
      "Contemporaneous documents and adverse facts are included, not selectively summarised.",
      "Any settlement draft addresses authority, scope, payment, confidentiality and independent review without coercive language.",
    ],
  },
  {
    id: "probate-estate",
    title: "Probate and estate administration guide",
    jurisdiction: "Malaysia; identify the deceased's domicile, asset locations, applicable personal law and competent route",
    scopeNote:
      "An estate-information and source-verification framework for probate or administration preparation. It is not a will-validity opinion, grant application, distribution calculation or authority to deal with assets.",
    caution:
      "Do not collect, transfer, sell or distribute estate assets without verified authority. Estate routes can differ by asset, value, religion, domicile and location, and Sarawak has its own official ordinance materials.",
    sources: [
      {
        title: "Jurisdiction of High Court",
        authority: "Malaysian Judiciary — Kuala Lumpur Court portal",
        jurisdiction: "Malaysia — High Court public guidance",
        sourceUrl: "https://kl.kehakiman.gov.my/en/jurisdiction-high-court",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page lists letters of administration and probate issues among the High Court's identified exclusive civil jurisdictions.",
        verificationLimit:
          "The page does not determine the correct registry, grant, filing steps, documents, priority, fees or law applicable to a particular estate.",
      },
      {
        title: "Estate Administration",
        authority: "Amanah Raya Berhad",
        jurisdiction: "Malaysia — public trustee service information",
        sourceUrl: "https://www.amanahraya.my/estate-administration",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page describes estate administration at a general level as compiling and managing assets, settling debts and distributing the balance, and describes AmanahRaya's estate-administration service.",
        verificationLimit:
          "Service-provider material is not independent legal advice and does not establish eligibility, exclusive route, time, fee or distribution outcome for a particular estate.",
      },
      {
        title: "Laws of Sarawak — Full Listing",
        authority: "Sarawak State Attorney-General's Chambers / Sarawak LawNet",
        jurisdiction: "Sarawak",
        sourceUrl: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=All",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched listing includes the Administration of Estates Ordinance and an expandable entry for probate and letters-of-administration rules.",
        verificationLimit:
          "Listing presence does not establish the current operative text, commencement, the correct grant route or interaction with federal and personal law.",
      },
    ],
    practitionerChecklist: [
      "Verify identity, death record, domicile/residence, family tree, religion where legally relevant, dependants and every name variation.",
      "Secure the original alleged will and codicils without marking them; record discovery, custody, witnesses and any competing or revoked-looking instrument.",
      "Create an asset-and-liability inventory with ownership form, location, account/title identifier, approximate date-of-death value and supporting record.",
      "Distinguish sole estate property from jointly held, nominated, trust, partnership, company, insurance and disputed property; make no distribution assumption.",
      "Record potential executors, administrators, beneficiaries, creditors, minors, persons lacking capacity and conflicts, without deciding priority.",
      "Preserve property, insurance, tax, business and digital-asset access while avoiding unauthorised dealing or password use.",
      "Identify the possible High Court, small-estate, AmanahRaya, Syariah or Sarawak route only for counsel/authority confirmation.",
      "Maintain receipts and an administration ledger; require documented authority before payment, sale, assent or distribution.",
    ],
    templateTitle: "Estate inventory and grant-preparation memorandum",
    templateSections: [
      {
        heading: "Deceased, family and governing connections",
        prompts: [
          "Record verified identity, death, domicile, residences, religion if relevant and family relationships.",
          "Identify conflicts, foreign connections and missing persons or records.",
        ],
      },
      {
        heading: "Testamentary documents and authority",
        prompts: [
          "Index originals, copies, codicils, custody evidence, witnesses and validity concerns.",
          "State expressly that no person may act merely because named in this working note.",
        ],
      },
      {
        heading: "Asset, liability and claim schedule",
        prompts: [
          "List ownership evidence, location, value source, encumbrance, income and preservation action for each item.",
          "Create separate schedules for debts, expenses, tax questions, guarantees and disputed claims.",
        ],
      },
      {
        heading: "Route, distribution and next verification",
        prompts: [
          "Compare possible routes without selecting one until current eligibility and jurisdiction are verified.",
          "Record consents, renunciations, notices, valuations, accounts and specialist advice still required.",
        ],
      },
    ],
    finalReview: [
      "No asset is treated as estate property solely because the deceased used or mentioned it.",
      "No entitlement, share or authority is represented as final before governing-law and grant review.",
      "Original instruments, personal data and estate funds have controlled custody and a complete audit trail.",
    ],
  },
  {
    id: "judicial-review",
    title: "Judicial review record and grounds guide",
    jurisdiction: "Malaysia; identify the decision-maker, legal source of power and competent High Court",
    scopeNote:
      "A public-law issue-spotting and record-building aid. It does not determine reviewability, standing, leave, remedy, time, exhaustion or the merits of any challenge.",
    caution:
      "Judicial review can involve urgent and strict procedural requirements. Obtain specialist advice immediately and verify the current Rules of Court, legislation, practice directions and relief before any communication or filing.",
    sources: [
      {
        title: "Rules of Court 2012 — Federal Government Gazette P.U. (A) 205",
        authority: "Attorney General's Chambers of Malaysia",
        jurisdiction: "Malaysia — civil procedure",
        sourceUrl:
          "https://lom.agc.gov.my/ilims/upload/portal/akta/outputp/pua_20120702_RULES%20OF%20COURT%202012%20%28FINAL%29%20-%201%20July%202012.pdf",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official Gazette PDF identifies itself as the Rules of Court 2012 and its arrangement of orders identifies Order 53 as applications for judicial review.",
        verificationLimit:
          "The fetched text is the 2012 gazetted instrument, not a certificate that it incorporates later amendments or supplies every applicable requirement. Verify current text, amendments and directions before use.",
      },
      {
        title: "Procedures In Civil Cases",
        authority: "Office of the Chief Registrar, Federal Court of Malaysia",
        jurisdiction: "Malaysia — civil courts",
        sourceUrl: "https://www.kehakiman.gov.my/en/procedures-civil-cases",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page provides general civil-case orientation and emphasises cause of action, limitation, evidence and costs before filing.",
        verificationLimit:
          "It is not judicial-review guidance and does not verify leave, time, service, standing, affidavit or remedy requirements.",
      },
    ],
    practitionerChecklist: [
      "Identify the exact decision, omission, policy or process challenged, the decision-maker and the asserted source of legal power.",
      "Secure the operative decision, reasons, notice, record, correspondence, submissions, hearing materials and proof of receipt dates.",
      "Build a chronology separating knowledge, decision, communication, internal review and continuing effects; escalate time calculation immediately.",
      "Map each proposed ground to verified law and record evidence; distinguish legality review from disagreement with merits.",
      "Identify affected persons, standing facts, necessary parties, alternative remedies and statutory appeal/review routes for counsel.",
      "Record procedural fairness, relevant/irrelevant considerations, purpose, authority, reasons and rationality issues as questions, not conclusions.",
      "Define practical relief and urgency, including whether interim protection is sought and the prejudice to all sides and the public.",
      "Preserve the full administrative record; do not edit metadata, solicit improper material or present a selective bundle as complete.",
    ],
    templateTitle: "Judicial review pre-filing record memorandum",
    templateSections: [
      {
        heading: "Decision and public authority",
        prompts: [
          "Quote the operative decision accurately and identify its date, communicator and asserted legal power.",
          "State what is challenged and what is not.",
        ],
      },
      {
        heading: "Chronology, standing and routes",
        prompts: [
          "Record all knowledge and service dates with evidence and leave time as a source-checked calculation.",
          "Identify the applicant's interest, affected parties and available appeal, complaint or review mechanisms.",
        ],
      },
      {
        heading: "Grounds-to-record matrix",
        prompts: [
          "For each possible ground, identify the legal proposition, supporting record, adverse record and missing material.",
          "Avoid pleading factual inference as if it were an admitted reason.",
        ],
      },
      {
        heading: "Relief, procedure and public interest",
        prompts: [
          "List possible final and interim outcomes for counsel to verify against current law.",
          "Address practicality, third-party effects, undertakings, service, evidence and costs.",
        ],
      },
    ],
    finalReview: [
      "The operative decision and complete material record are identified by source and date.",
      "Every deadline and procedural step is verified from current primary material, not this outline.",
      "Draft language challenges legality with precision and does not allege bad faith without a proper factual basis.",
    ],
  },
  {
    id: "banking-disputes",
    title: "Consumer banking dispute and escalation guide",
    jurisdiction: "Malaysia; product, provider, regulator and dispute-scheme eligibility must be verified",
    scopeNote:
      "An evidence, complaint and route-comparison framework for consumer banking disputes. It is not a chargeback instruction, fraud response protocol, FMOS eligibility opinion or civil claim.",
    caution:
      "For suspected fraud, lost credentials or ongoing unauthorised activity, contact the financial institution through verified channels immediately. Scheme limits, eligible disputes and court rights must be checked live before election or settlement.",
    sources: [
      {
        title: "Banking — Disputes",
        authority: "Bank Negara Malaysia",
        jurisdiction: "Malaysia — financial consumer information",
        sourceUrl: "https://www.bnm.gov.my/faqs/banking/disputes",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched FAQ directs consumers disputing fees or duplicate/unrecognised card charges to contact the bank and links to financial-service-provider complaint units.",
        verificationLimit:
          "The FAQ is general information, not a finding on liability, reimbursement, evidence, response time or the correct escalation route for a specific product.",
      },
      {
        title: "Enquiries or Complaints",
        authority: "Bank Negara Malaysia — BNMLINK",
        jurisdiction: "Malaysia — complaints against financial service providers",
        sourceUrl: "https://bnmlink.bnm.gov.my/",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page provides separate official paths for enquiries/requests and complaints or appeals concerning financial service providers.",
        verificationLimit:
          "Availability of the channel does not establish BNM jurisdiction, admissibility, entitlement or suspension of any contractual or legal deadline.",
      },
      {
        title: "Financial Markets Ombudsman Service launch announcement",
        authority: "Bank Negara Malaysia and Securities Commission Malaysia",
        jurisdiction: "Malaysia — financial consumer and investor dispute resolution",
        sourceUrl: "https://www.bnm.gov.my/-/fmospr",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched 17 January 2025 announcement describes FMOS as a centralised dispute-resolution service formed by merging OFS and SIDREC, providing mediation and adjudication for eligible disputes.",
        verificationLimit:
          "A launch announcement is not the current scheme rules. Verify present membership, eligibility, exclusions, monetary scope, filing time and effect on other remedies directly with FMOS.",
      },
    ],
    practitionerChecklist: [
      "Verify customer, account/product, provider, transaction identifiers and authorised users using redacted working copies.",
      "For active compromise, use independently verified contact details, secure credentials and preserve device/account evidence without circulating passwords or one-time codes.",
      "Create a transaction chronology covering authorisation events, alerts, contact attempts, blocks, reports, reversals, fees and final-response communications.",
      "Preserve statements, terms, disclosure sheets, application records, authentication logs available to the customer, messages and complaint references.",
      "State each disputed amount and calculation separately; distinguish principal, fee, interest, consequential loss and requested correction.",
      "Send a focused provider complaint requesting a reference, investigation, relevant reasons/records and final response; avoid unsupported fraud accusations.",
      "Compare provider review, BNMLINK, FMOS and court routes only after verifying jurisdiction, eligibility, time, monetary scope and interaction.",
      "Record settlement, confidentiality, credit-reporting, tax, subrogation and account-operation consequences for professional review.",
    ],
    templateTitle: "Banking dispute complaint and evidence pack",
    templateSections: [
      {
        heading: "Account, product and disputed events",
        prompts: [
          "Identify provider, product and transaction references without exposing full credentials.",
          "Set out the chronology and the customer's action or non-action for each event.",
        ],
      },
      {
        heading: "Terms, communications and evidence",
        prompts: [
          "Attach the operative terms/version and provider communications, preserving originals and metadata.",
          "List records requested from the provider and evidence not available to the customer.",
        ],
      },
      {
        heading: "Amounts and requested resolution",
        prompts: [
          "Provide a reproducible schedule for each disputed sum and avoid double counting.",
          "State requested investigation, correction, reimbursement, explanation or non-monetary action separately.",
        ],
      },
      {
        heading: "Escalation route review",
        prompts: [
          "Record complaint reference, final-response status and live checks of BNMLINK/FMOS eligibility.",
          "Preserve all other deadline questions for legal advice and document any informed route election.",
        ],
      },
    ],
    finalReview: [
      "Sensitive banking data is minimised, encrypted or access-restricted, and no credential appears in the pack.",
      "The narrative distinguishes unauthorised, mistaken, duplicate, disputed-service and fee issues.",
      "No regulator or ombudsman outcome, recovery or eligibility is promised.",
    ],
  },
  {
    id: "accident-claims",
    title: "Road accident evidence and civil claim guide",
    jurisdiction: "Malaysia; verify accident location, police district, parties, insurer terms and civil forum",
    scopeNote:
      "A post-incident evidence-preservation and claim-preparation framework. It does not determine fault, reporting compliance, insurance coverage, injury causation or damages.",
    caution:
      "Prioritise emergency care and safety. Confirm police reporting, insurer notice, medical evidence, limitation and court requirements immediately from current official/contractual sources; this guide supplies no deadline.",
    sources: [
      {
        title: "Cara Membuat Repot Polis",
        authority: "Royal Malaysia Police",
        jurisdiction: "Malaysia — police reports, including traffic reports",
        sourceUrl: "https://www.rmp.gov.my/cara-membuat-repot-polis",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched PDRM page explains oral and written police-report methods, states that reports may be made at a police station including for traffic cases, and provides general report-content guidance.",
        verificationLimit:
          "The page does not establish compliance for a particular accident, current traffic-report timing, investigation outcome, insurer notice or evidential effect. Confirm directly with PDRM and counsel.",
      },
      {
        title: "Procedures In Civil Cases",
        authority: "Office of the Chief Registrar, Federal Court of Malaysia",
        jurisdiction: "Malaysia — civil courts",
        sourceUrl: "https://www.kehakiman.gov.my/en/procedures-civil-cases",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched page lists motor-vehicle accident and personal-injury claims as civil-claim examples and identifies cause of action, limitation, evidence and costs as pre-filing considerations.",
        verificationLimit:
          "The page does not determine liability, forum for a particular value/type of claim, recoverable loss, limitation or pleading/evidence requirements.",
      },
    ],
    practitionerChecklist: [
      "Address emergency treatment and scene safety before evidence collection; do not obstruct responders or traffic.",
      "Record exact time, location, direction, vehicles, drivers, occupants, road/weather/light conditions, signals and contemporaneous statements.",
      "Preserve original photos, video, dashcam, telematics and device metadata; make working copies and document custodian and collection method.",
      "Obtain and index police documents, vehicle/driver particulars, witness contacts, repair/tow records and insurer communications from lawful sources.",
      "Maintain a treatment chronology linking each visit, diagnosis, restriction and expense to the underlying record; do not embellish symptoms.",
      "Create separate schedules for vehicle/property damage, medical expense, income impact, care, travel and other asserted loss with proof and mitigation.",
      "Identify possible drivers, owners, employers, contractors, road authorities and insurers as investigation leads, not conclusions on liability.",
      "Ask counsel to verify reporting, notice, preservation, expert, limitation, forum, settlement and minor/incapacity requirements immediately.",
    ],
    templateTitle: "Road accident evidence and loss memorandum",
    templateSections: [
      {
        heading: "Incident and participants",
        prompts: [
          "Describe only directly observed or source-identified facts and label estimates.",
          "Record each participant and witness identifier, role and source without publishing unnecessary personal data.",
        ],
      },
      {
        heading: "Reports and physical/digital evidence",
        prompts: [
          "Index police, medical, scene, vehicle, camera and electronic records with dates and custodians.",
          "List preservation requests and unavailable or overwritten material.",
        ],
      },
      {
        heading: "Causation, liability and contrary material",
        prompts: [
          "Map competing event sequences to evidence and identify technical/expert questions.",
          "Include prior damage, prior symptoms, visibility issues and inconsistent accounts for counsel review.",
        ],
      },
      {
        heading: "Loss, insurance and next steps",
        prompts: [
          "Use a documented loss schedule separating paid, outstanding, estimated and continuing items.",
          "Record policy/notice checks, source-verified deadlines, proposed experts and settlement authority.",
        ],
      },
    ],
    finalReview: [
      "The file preserves originals and clearly labels reconstructions, estimates and hearsay accounts.",
      "Medical causation and future loss are not asserted without appropriate evidence.",
      "No admission, release, reporting statement or insurer election is drafted as routine without advice.",
    ],
  },
  {
    id: "property-jurisdictions",
    title: "Malaysian property jurisdiction screening guide",
    jurisdiction: "Malaysia — Peninsular, Sabah and Sarawak land systems must be screened separately",
    scopeNote:
      "A threshold source and due-diligence framework for identifying the relevant land administration before transaction or dispute drafting. It is not a title opinion, search, consent application or conveyancing precedent.",
    caution:
      "Never treat Peninsular guidance as Sabah or Sarawak law. Obtain current official title/registry evidence and local professional advice on tenure, restrictions, native interests, consent, duty/tax, registration and priority.",
    sources: [
      {
        title: "Land Management FAQ",
        authority: "Department of Director General of Lands and Mines (JKPTG)",
        jurisdiction: "Peninsular Malaysia — land administration",
        sourceUrl: "https://www.jkptg.gov.my/en/soalan-lazim-3/42-faq/pengurusan-tanah",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official page is JKPTG's land-management FAQ and provides administrative guidance within its land-management remit.",
        verificationLimit:
          "Navigation and examples are not a transaction checklist or title opinion, and the source is not authority for Sabah or Sarawak land procedure.",
      },
      {
        title: "Sabah Lands and Surveys Department official portal",
        authority: "Sabah Lands and Surveys Department",
        jurisdiction: "Sabah",
        sourceUrl: "https://www.jtu.sabah.gov.my/",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched portal identifies Sabah-specific land services and links public systems for matters including quit-rent checks, land-acquisition enquiry, land development and land-application status.",
        verificationLimit:
          "Portal functionality does not prove title, payment, approval, consent, application status or legal entitlement. Use the correct live service and official certified records.",
      },
      {
        title: "Laws of Sarawak — Full Listing",
        authority: "Sarawak State Attorney-General's Chambers / Sarawak LawNet",
        jurisdiction: "Sarawak",
        sourceUrl: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=All",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official listing provides Sarawak ordinances and expandable subsidiary-material links, supplying a distinct Sarawak primary-source starting point.",
        verificationLimit:
          "The listing is not a land search, current-law certificate or proof that a linked text is the latest operative consolidation.",
      },
    ],
    practitionerChecklist: [
      "Identify the land's state, district, registry/land office, title number, lot, tenure and title system from current official evidence.",
      "Obtain the correct official/certified search and compare proprietor, land description, category/use, conditions, restrictions, encumbrances and endorsements.",
      "Investigate caveats, charges, leases, easements, acquisitions, planning/building status, occupation and pending applications through competent sources.",
      "Verify party identity, capacity, beneficial/registered interest and execution authority; record trusts, nominees, estates, companies and powers separately.",
      "For Sabah or Sarawak, replace every Peninsular assumption with local legislation, registry procedure and local advice; flag native interests where facts require.",
      "Create a consent and approval matrix naming the issuing authority, source, condition, submission, fee and status without predicting approval.",
      "Reconcile contract, finance, valuation, tax/duty advice, stakeholder funds, completion deliverables, presentation sequence and post-registration evidence.",
      "For disputes, preserve title/search history, instruments, plans, possession evidence, payments, notices and communications with provenance.",
    ],
    templateTitle: "Property jurisdiction and title due-diligence note",
    templateSections: [
      {
        heading: "Land identity and jurisdiction",
        prompts: [
          "Record title/lot, physical location, registry and the official evidence used to select Peninsular, Sabah or Sarawak sources.",
          "List any mismatch in address, survey, title description or occupation.",
        ],
      },
      {
        heading: "Title and interests",
        prompts: [
          "Transcribe material search entries accurately and attach the dated official search.",
          "Separate registered interests, contractual claims, occupation, alleged beneficial interests and unresolved native-interest questions.",
        ],
      },
      {
        heading: "Approvals and transaction dependencies",
        prompts: [
          "Map restrictions, consents, finance, planning, tax/duty and execution issues to current sources and responsible reviewers.",
          "Mark every timing and completion assumption as pending calculation or evidence where unverified.",
        ],
      },
      {
        heading: "Completion or dispute plan",
        prompts: [
          "For a transaction, list reciprocal deliverables, funds control, presentation and registration evidence.",
          "For a dispute, list preservation, searches, witnesses, site/survey evidence and interim-risk questions.",
        ],
      },
    ],
    finalReview: [
      "The guide uses the source set for the actual land jurisdiction, not a Malaysia-wide shortcut.",
      "Current official search evidence supports every title statement and all discrepancies are visible.",
      "No approval, priority, registration, vacant possession or tax outcome is promised.",
    ],
  },
  {
    id: "sarawak",
    title: "Sarawak-specific source and matter guide",
    jurisdiction: "Sarawak, Malaysia",
    scopeNote:
      "A jurisdiction-screening and primary-source workflow for matters with a Sarawak connection. It does not state which Sarawak ordinance applies or displace federal law analysis.",
    caution:
      "Do not apply Peninsular land assumptions or a federal-only source set to a Sarawak matter. Verify the current Sarawak instrument, subsidiary legislation, amendments, commencement and interaction with federal law.",
    sources: [
      {
        title: "Laws of Sarawak — Full Listing",
        authority: "Sarawak State Attorney-General's Chambers / Sarawak LawNet",
        jurisdiction: "Sarawak",
        sourceUrl: "https://lawnet.sarawak.gov.my/lawnet/Law/TLnetPublishedOrdList.jsp?LTyp=All",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The fetched official page identifies itself as Laws of Sarawak, offers full/alphabetical/year/search navigation, and lists ordinances with PDF links and expandable subsidiary materials.",
        verificationLimit:
          "A listing or PDF filename does not prove that text is the latest operative consolidation. Verify amendments, commencement and gazette history for the matter.",
      },
      {
        title: "Federal Legislation Portal",
        authority: "Attorney General's Chambers of Malaysia",
        jurisdiction: "Malaysia — federal legislation",
        sourceUrl: "https://lom.agc.gov.my/",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The federal portal supplies the complementary federal primary-source search route needed where federal and Sarawak law may interact.",
        verificationLimit:
          "The division of legislative competence and application of any federal instrument is a legal question requiring qualified analysis.",
      },
    ],
    practitionerChecklist: [
      "Record every Sarawak connection: land, event, residence, entity, court, public authority, instrument and relief.",
      "Identify whether the issue may be governed by Sarawak ordinance, federal law, subsidiary legislation, native law/custom, or more than one source; do not decide by keyword alone.",
      "Search Sarawak LawNet by full listing, title/year and relevant subsidiaries; retain document identifiers, PDFs and access dates.",
      "Check amendments, repeals, savings, commencement, definitions, schedules and subsidiary instruments from official records.",
      "Check the federal portal separately and analyse interaction or inconsistency only with qualified counsel.",
      "For land, obtain current title/registry and Land and Survey or other competent authority material rather than using a Peninsular checklist as law.",
      "For litigation, verify the competent court/registry, local practice directions, forms, service and filing requirements.",
      "Flag native customary rights, community interests, language, access and expert evidence issues where facts indicate them; make no assumption from identity alone.",
    ],
    templateTitle: "Sarawak jurisdiction and sources memorandum",
    templateSections: [
      {
        heading: "Sarawak nexus and forum",
        prompts: [
          "List facts connecting the matter to Sarawak and the evidence for each.",
          "State forum and jurisdiction as questions pending source-based review where unresolved.",
        ],
      },
      {
        heading: "Source map",
        prompts: [
          "Separate Sarawak ordinances/subsidiaries, federal instruments, court materials and official administrative guidance.",
          "Record title, chapter/number, version, amendment and commencement checks.",
        ],
      },
      {
        heading: "Application and interaction",
        prompts: [
          "Apply verified provisions to sourced facts.",
          "Identify any federal/state interaction issue without assuming its resolution.",
        ],
      },
      {
        heading: "Local evidence and process",
        prompts: [
          "List registry, title, agency, community, language or expert materials required.",
          "Confirm local forms and practice with the competent registry.",
        ],
      },
      {
        heading: "Limitations and next verification",
        prompts: [
          "State inaccessible or potentially unconsolidated material.",
          "Assign the next official-source check and qualified reviewer.",
        ],
      },
    ],
    finalReview: [
      "Sarawak and federal source sets were searched separately.",
      "No Peninsular land rule is presumed applicable.",
      "Currency and commencement are recorded as verified facts or explicit open questions.",
    ],
  },
];

export const legalReferenceGuidesByDomain = Object.fromEntries(
  legalReferenceGuides.map((guide) => [guide.id, guide]),
) as Record<LegalReferenceDomain, LegalReferenceGuide>;
