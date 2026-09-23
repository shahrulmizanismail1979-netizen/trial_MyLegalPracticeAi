export type ProductGuide = {
  portalId: string;
  bestFor: string;
  prepare: string[];
  example: string;
  interpret: string[];
  review: string[];
};

export const PRODUCT_GUIDES: ProductGuide[] = [
  {
    portalId: "lit",
    bestFor: "Organising a civil-litigation question, preparing a first working draft, and testing a case theory against the material supplied.",
    prepare: [
      "Identify the court, procedural stage, parties, relief sought, and the precise task you want completed.",
      "Provide the relevant pleading, order, chronology, correspondence, and extracts of evidence rather than an undifferentiated file bundle.",
      "State any deadline and the date on which it was calculated; do not ask the assistant to assume that a date is current.",
    ],
    example: "Example instruction: “Using this defence and the attached chronology, list the factual propositions that still need witness support. Separate admitted facts, disputed facts, and facts not addressed.”",
    interpret: [
      "Treat an issue list or draft as a working structure, not as a conclusion about prospects or procedure.",
      "A confident sentence does not prove that an authority, rule, date, or factual premise is correct.",
    ],
    review: [
      "Compare every factual statement with the filed documents and evidence.",
      "Check current legislation, rules, practice directions, court requirements, authorities, citation text, and all time calculations before use.",
    ],
  },
  {
    portalId: "syariah",
    bestFor: "Structuring a Syariah matter, preparing working cause-paper text, and identifying questions that require jurisdiction-specific checking.",
    prepare: [
      "State the relevant State or Federal Territory, court, matter type, procedural stage, and orders sought.",
      "Supply the documents and facts that may affect jurisdiction, status, service, proof, or available relief.",
      "Identify the materials the lawyer has already selected; do not combine material from different jurisdictions without labelling it.",
    ],
    example: "Example instruction: “From these client instructions, prepare a neutral chronology and a missing-information checklist for counsel. Do not add legal propositions.”",
    interpret: [
      "Outputs may help organise instructions but do not establish the applicable enactment, procedure, hukum, or court practice.",
      "A generated form or pleading may omit mandatory local content or use language that is unsuitable for the specific court.",
    ],
    review: [
      "Have qualified syarie counsel check jurisdiction, governing materials, forms, evidence, relief, and filing practice.",
      "Confirm all Arabic, Malay, translated, quoted, and attributed material against the authoritative source.",
    ],
  },
  {
    portalId: "corporate",
    bestFor: "Preparing a first draft of routine corporate material and turning instructions into a compliance or approval checklist.",
    prepare: [
      "Identify the entity, transaction, decision-makers, governing documents, relevant dates, and intended approval route.",
      "Provide the current constitution, prior resolutions, transaction papers, and verified company particulars where they matter.",
      "Remove unnecessary personal data and clearly mark information that is incomplete, disputed, or awaiting a registry search.",
    ],
    example: "Example instruction: “Prepare a board-paper outline from these commercial terms. Put unresolved authority, conflict, execution, and filing points in a separate review list.”",
    interpret: [
      "A draft resolution or checklist does not confirm corporate capacity, authority, beneficial ownership, filing duties, or completion.",
      "Generated language may be internally consistent while relying on an incomplete transaction description.",
    ],
    review: [
      "Check the constitution, current company and regulator records, approvals, conflicts, execution requirements, filings, and transaction documents.",
      "Obtain the required legal, company-secretarial, tax, accounting, regulatory, and commercial review for the actual transaction.",
    ],
  },
  {
    portalId: "convey",
    bestFor: "Organising transaction information, preparing working clauses, and building a matter-specific due-diligence or completion list.",
    prepare: [
      "State the property, title or tenure information, parties, transaction structure, financing position, and intended completion sequence.",
      "Provide current searches, title documents, the agreed commercial terms, existing agreements, and known consent or restriction issues.",
      "Distinguish verified registry information from client instructions and assumptions.",
    ],
    example: "Example instruction: “Compare these agreed terms with the draft agreement and list inconsistencies by clause. Do not infer title status or consent requirements.”",
    interpret: [
      "A generated checklist cannot establish title, encumbrances, consent, duty, tax, financing, or registry requirements.",
      "A clause comparison identifies text differences; it does not decide which term should prevail.",
    ],
    review: [
      "Undertake the required searches and verify current land, registry, revenue, financing, execution, stamping, and presentation requirements.",
      "Check every party name, identifier, property description, sum, date, condition, apportionment, and completion deliverable.",
    ],
  },
  {
    portalId: "criminal",
    bestFor: "Organising a criminal brief, testing the completeness of a factual account, and preparing working questions or submissions.",
    prepare: [
      "Identify the charge as actually framed, court, stage, custody or bail status, next date, and the exact material supplied.",
      "Provide the charge, notes of evidence, statements, exhibits, orders, and an attributed chronology where available.",
      "Separate instructions, prosecution allegations, admitted facts, disputed facts, and matters not yet verified.",
    ],
    example: "Example instruction: “Create a witness-by-witness contradiction table from these supplied statements. Quote the relevant words and label the source document and page.”",
    interpret: [
      "A contradiction table is a review aid; it does not establish admissibility, credibility, guilt, innocence, or the proper forensic use of the material.",
      "Sentencing or outcome comparisons can be misleading where facts, charges, procedure, or governing law differ.",
    ],
    review: [
      "Counsel must check the complete record, current law and procedure, admissibility, disclosure, client instructions, and ethical obligations.",
      "Urgent liberty, limitation, appeal, attendance, and court-date issues require direct professional checking rather than reliance on generated text.",
    ],
  },
  {
    portalId: "ccb",
    bestFor: "Structuring corporate, commercial, or banking disputes and preparing a working analysis of documents, issues, or draft correspondence.",
    prepare: [
      "Describe the parties, facility or transaction, contractual chain, alleged breach, sums, security, demands, and present procedural status.",
      "Supply executed agreements, variations, statements, notices, correspondence, securities, orders, and a calculation supplied by the responsible reviewer.",
      "Label documents that are unsigned, incomplete, superseded, privileged, or subject to authenticity questions.",
    ],
    example: "Example instruction: “Build a table matching each alleged breach in the letter of demand to the relied-on clause, event, evidence, response, and unresolved factual question.”",
    interpret: [
      "A document map does not validate execution, enforceability, indebtedness, interest, security, default, or remedies.",
      "Generated calculations and contract references should be treated as items for checking, even when presented precisely.",
    ],
    review: [
      "Reperform all calculations and verify source records, contractual wording, notices, authority, security, procedure, and current legal materials.",
      "Keep legal analysis distinct from accounting, valuation, restructuring, regulatory, and commercial advice.",
    ],
  },
  {
    portalId: "accident",
    bestFor: "Organising an accident file, summarising supplied evidence, and preparing a working schedule of missing proof or heads of claim.",
    prepare: [
      "Provide the accident date and place, party and vehicle details, police and medical material, photographs, witness material, expenses, and procedural status.",
      "Use a dated treatment and earnings chronology, and identify records that remain outstanding.",
      "Do not include unnecessary medical identifiers or third-party personal data in a general prompt.",
    ],
    example: "Example instruction: “From the supplied medical records only, prepare a dated treatment chronology and list gaps. Attribute every entry to a document and page.”",
    interpret: [
      "A chronology or draft schedule does not prove causation, liability, prognosis, reasonableness, or quantum.",
      "Comparisons with other matters require careful checking of injuries, evidence, dates, jurisdiction, and the basis of any award.",
    ],
    review: [
      "Verify source medical and financial records, arithmetic, liability evidence, current authorities, pleadings, limitation, and procedural requirements.",
      "Obtain appropriate medical, actuarial, employment, accounting, and legal input where the matter requires it.",
    ],
  },
  {
    portalId: "firm",
    bestFor: "Turning firm information into working tasks, meeting records, internal summaries, and management follow-up lists.",
    prepare: [
      "State the owner, participants, objective, due date, dependencies, and whether an item is a decision, action, risk, or information note.",
      "Provide approved internal terminology and avoid including client-confidential content when a management-level summary is sufficient.",
      "For meeting notes, identify the source recording or notes and distinguish confirmed decisions from proposed actions.",
    ],
    example: "Example instruction: “Turn these approved meeting notes into decisions, action items, owners, and dates. Put anything without an owner or date in an unresolved list.”",
    interpret: [
      "Generated priorities or performance summaries are organisational aids and may omit context or misclassify tone.",
      "A task appearing in a draft does not mean it has been assigned, accepted, calendared, or completed.",
    ],
    review: [
      "Confirm assignments and deadlines with responsible people and record final decisions in the firm’s authoritative system.",
      "Review outputs for confidentiality, employment sensitivity, fairness, and access before sharing.",
    ],
  },
  {
    portalId: "acad",
    bestFor: "Preparing working lesson, assessment, rubric, and academic-administration material for educator review.",
    prepare: [
      "State the learning outcomes, learner level, topic boundary, format, duration, permitted materials, and marking approach.",
      "Provide the institution’s approved syllabus, assessment rules, citation style, accessibility needs, and integrity requirements.",
      "Use fictional or properly authorised scenarios; remove student personal data unless the workflow specifically requires and protects it.",
    ],
    example: "Example instruction: “Draft three issue-spotting prompts aligned to these learning outcomes, with a marking outline that separates issue identification, authority, application, and communication.”",
    interpret: [
      "Generated teaching and marking material may contain legal, pedagogical, or alignment errors and should not be issued automatically.",
      "Assisted grading is an input to academic judgment, not a substitute for the institution’s moderation and sign-off process.",
    ],
    review: [
      "Check legal accuracy, source permissions, learning alignment, difficulty, accessibility, bias, answerability, and academic-integrity controls.",
      "Apply the institution’s moderation, approval, retention, appeal, and final-mark processes.",
    ],
  },
];

export const PUBLIC_FAQS = [
  {
    question: "What should I provide before asking for a draft or analysis?",
    answer: "Start with the task, jurisdiction, forum, matter stage, intended reader, relevant dates, and desired output. Add only the source material needed for that task. Label facts that are disputed or unverified, identify missing documents, and say whether you want a neutral summary, an issue list, questions for review, or working draft language.",
  },
  {
    question: "How specific should an instruction be?",
    answer: "Give a bounded instruction that describes both the job and its limits. For example: “Compare clauses 4–9 with the signed term sheet, quote each inconsistency, and put missing information in a separate list. Do not add authorities.” A bounded task is easier to review than “advise on this file.”",
  },
  {
    question: "How should I treat a generated answer?",
    answer: "Treat it as a working aid. Check whether it answered the task, identify each factual and legal premise, trace factual statements to the file, and independently verify law, authorities, quotations, dates, calculations, forms, and procedural requirements. Edit only after you understand what the output relied on.",
  },
  {
    question: "Does a citation or link mean the proposition is verified?",
    answer: "No. In LAWYes, the verified-library lane is distinct from the separately selected public-web lane. Verified-library work should be grounded in exact returned passages. Public-web material remains visibly unverified and requires independent checking. In either lane, the lawyer decides whether an authority is current, applicable, complete, and suitable for the proposition.",
  },
  {
    question: "What happens when verified-library research finds no relevant authority?",
    answer: "That research lane is intended to fail closed rather than silently replace reviewed material with public-web results. Public-web research, where offered, is a separate lawyer-selected mode and should remain labelled as unverified in the result and any saved citation.",
  },
  {
    question: "Can I upload an entire file?",
    answer: "A smaller, purposeful set is usually easier to review. Remove duplicates, name files clearly, identify the operative version, provide a short chronology or index, and point to the pages that matter. Before upload, consider confidentiality, privilege, personal data, protective orders, client instructions, and whether you are authorised to use the material in the selected workflow.",
  },
  {
    question: "How do I review dates and calculations?",
    answer: "Identify the source date, rule or contractual term, assumptions, inclusions and exclusions, calendar convention, and reviewer. Reperform the calculation independently using current authoritative material. Do not rely on an automatically generated deadline, limitation date, interest figure, damages total, fee, tax, duty, or apportionment.",
  },
  {
    question: "What should be checked before sharing, filing, or advising?",
    answer: "Confirm the audience and purpose; compare the output with the complete file; verify names, roles, facts, quotes, authorities, law, procedure, dates, sums, annexures, and requested relief; remove internal notes and unsupported assertions; apply privilege and confidentiality controls; and obtain the responsible professional’s approval.",
  },
] as const;
