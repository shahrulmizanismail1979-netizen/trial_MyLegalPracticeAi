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
        title: "e-Reporting PDRM",
        authority: "Royal Malaysia Police",
        jurisdiction: "Malaysia — police e-reporting service",
        sourceUrl: "https://ereporting.rmp.gov.my/index.aspx?lang=english",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "Search and page metadata identify an official e-reporting service; the service notice limits online reporting to specified categories and directs emergencies to police channels.",
        verificationLimit:
          "Automated fetch was unavailable and the service is not treated here as an accident-reporting route. Confirm directly with PDRM how and where the particular incident must be reported.",
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
        title: "Pengkelasan Kes Mal",
        authority: "Department of Syariah Judiciary Malaysia (JKSM)",
        jurisdiction: "Malaysia — general JKSM public information",
        sourceUrl: "https://www.jksm.gov.my/pengkelasan-kes-mal",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "The official search result describes two categories used for registration of Mal cases and identifies JKSM as the coordinating federal department for Syariah legal/judicial administration.",
        verificationLimit:
          "Automated fetch was unavailable. Search metadata is not enough to classify or file a matter; confirm the live page and the competent state court.",
      },
      {
        title: "Borang-Borang Mahkamah Syariah",
        authority: "Selangor Syariah Judiciary Department (JAKESS)",
        jurisdiction: "Selangor only",
        sourceUrl: "https://www.jakess.gov.my/rujukan/muat-turun-borang",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "Official search results identify the JAKESS court-form download area and describe it as access to current Syariah court forms.",
        verificationLimit:
          "The searched path returned a not-found response when fetched. Do not use a cached/search copy; navigate from the JAKESS home page and confirm the current form and filing instructions.",
      },
      {
        title: "Enakmen / Ordinen / Akta Mahkamah Syariah",
        authority: "Selangor Syariah Judiciary Department (JAKESS)",
        jurisdiction: "Selangor only",
        sourceUrl: "https://www.jakess.gov.my/rujukan/akta-enakmen-odinen",
        checkedDate: CHECKED_DATE,
        verifiedUse:
          "Official search results list Selangor Syariah enactment and rules categories, including civil procedure, criminal procedure and evidence materials.",
        verificationLimit:
          "The searched path returned a not-found response when fetched. Verify gazette text, amendments, commencement and a stable official location before citation.",
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
