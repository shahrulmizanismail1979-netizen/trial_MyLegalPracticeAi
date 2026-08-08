// ─── "Your Online LA" practice hub configuration ────────────────────────────
// Organises existing content (workflows, cause papers/forms, checklists) around
// practice areas and matter types, mirroring how lawyers work a file.
// Workflows are matched by title keywords against /api/lit/workflows;
// cause papers are matched by formNumber against /api/lit/forms — so no
// content is duplicated here, only organised.

export interface MatterConfig {
  id: string;
  name: string;
  summary: string;
  /** Lower-case substrings matched against workflow titles. */
  workflowKeywords: string[];
  /** Exact formNumber values from the Cause Papers library. */
  formNumbers: string[];
  /** Matter-specific checklist (before/at each stage of the file). */
  checklist: string[];
  /** Optional pointer to a specialised module elsewhere in the app. */
  moduleLink?: { label: string; path: string };
}

export interface PracticeArea {
  id: string;
  name: string;
  description: string;
  icon: 'scale' | 'landmark' | 'gavel' | 'building';
  matters: MatterConfig[];
}

export const PRACTICE_AREAS: PracticeArea[] = [
  {
    id: 'civil-litigation',
    name: 'Civil Litigation',
    description: 'Writ actions, originating summonses, interlocutory applications and trial preparation.',
    icon: 'scale',
    matters: [
      {
        id: 'writ-action',
        name: 'Writ Actions',
        summary: 'Commencing and running a civil claim by writ — from letter of demand to judgment.',
        workflowKeywords: ['writ action', 'breach of contract', 'defamation'],
        formNumbers: ['Letter of Demand', 'Writ of Summons (General)', 'Statement of Claim (Contract)', 'Statement of Claim (Tort)', 'Defence and Counterclaim', 'Affidavit of Service', 'Application for Substituted Service', 'Consent Judgment', 'Notice of Change of Solicitor'],
        checklist: [
          'Confirm limitation period has not expired (Limitation Act 1953)',
          'Issue solicitors’ letter of demand and diarise the deadline',
          'Verify correct parties, capacity and registered addresses',
          'Determine correct court by claim value and subject matter',
          'File writ + statement of claim; extract sealed copies',
          'Effect personal service within validity; affidavit of service',
          'Diarise appearance/defence deadlines; consider default judgment',
          'Prepare for case management (Order 34) and pre-trial directions',
        ],
      },
      {
        id: 'originating-summons',
        name: 'Originating Summons',
        summary: 'Matters commenced by OS — declaratory relief, specific performance, land and probate applications.',
        workflowKeywords: ['originating summons', 'judicial review', 'probate'],
        formNumbers: ['OS (Specific Performance)', 'OS for Grant of Probate', 'OS (Letters of Administration)', 'OS (Rectification of Register)', 'OS (Order 53)', 'Statement (O.53)'],
        checklist: [
          'Confirm OS is the proper mode (no substantial factual dispute)',
          'Draft OS with precise relief and enabling statute cited',
          'Prepare affidavit in support exhibiting all key documents',
          'Check any leave requirement (e.g. Order 53 judicial review)',
          'File, serve and diarise affidavit-in-reply timelines',
          'Prepare written submissions ahead of the OS hearing',
        ],
      },
      {
        id: 'summary-judgment',
        name: 'Summary Judgment (O.14)',
        summary: 'Judgment without trial where the defence discloses no triable issue.',
        workflowKeywords: ['summary judgment'],
        formNumbers: ['Form 26 (O.14)', 'Writ of Summons (General)', 'Statement of Claim (Contract)'],
        checklist: [
          'Confirm statement of claim served and appearance entered',
          'Ensure no defence with triable issues has been disclosed',
          'Prepare affidavit verifying facts and exhibiting the debt/contract documents',
          'File summons + affidavit within time; serve at least 3 clear days before hearing',
          'Anticipate opposing affidavit; prepare reply on triable-issue arguments',
          'Draft order and consider costs submissions',
        ],
      },
      {
        id: 'striking-out',
        name: 'Striking Out (O.18 r 19)',
        summary: 'Disposing of hopeless claims or defences without trial.',
        workflowKeywords: ['striking out'],
        formNumbers: [],
        checklist: [
          'Identify the limb(s) of Order 18 rule 19 relied upon',
          'Act promptly — delay may defeat the application',
          'Affidavit only where relying on limbs (b)–(d), not (a)',
          'Compile authorities on "plain and obvious" threshold',
          'Prepare fallback position (amendment vs dismissal)',
        ],
      },
      {
        id: 'default-judgment',
        name: 'Default Judgment & Setting Aside',
        summary: 'Entering judgment in default and resisting or setting aside such judgments.',
        workflowKeywords: ['default judgment', 'setting aside'],
        formNumbers: ['Summons to Set Aside (O.13)', 'Affidavit of Service', 'Statutory Declaration (Proof of Service)'],
        checklist: [
          'Verify service was properly effected before entering default judgment',
          'Distinguish regular vs irregular judgment — different tests apply',
          'For setting aside: prepare affidavit of merits without delay',
          'Consider terms (payment into court, costs) when setting aside',
        ],
      },
      {
        id: 'injunctions',
        name: 'Injunctions',
        summary: 'Interim, Mareva and Anton Piller relief — urgent interlocutory protection.',
        workflowKeywords: ['injunction', 'mareva', 'anton piller'],
        formNumbers: ['Summons (O.29 Injunction)'],
        checklist: [
          'Apply the American Cyanamid / Keet Gerald Francis principles',
          'Prepare undertaking as to damages with evidence of means',
          'For ex parte: full and frank disclosure in the affidavit',
          'Diarise the inter partes return date immediately',
          'For Mareva: exhibit evidence of risk of dissipation of assets',
        ],
      },
      {
        id: 'trial-docs',
        name: 'Trial Documents & Discovery',
        summary: 'Bundles of pleadings, documents, issues to be tried, statements of agreed facts and discovery applications.',
        workflowKeywords: ['discovery', 'security for costs'],
        formNumbers: ['Application for Security for Costs', 'Bill of Costs (Litigation)'],
        checklist: [
          'Comply with pre-trial case management directions (Order 34)',
          'Prepare bundle of pleadings and common/disputed bundles of documents (Parts A, B, C)',
          'Agree statement of issues to be tried and agreed facts',
          'Exchange witness statements by the directed dates',
          'Consider specific discovery for gaps in documents',
        ],
        moduleLink: { label: 'Open Bundle Builder', path: '/app/bundles' },
      },
    ],
  },
  {
    id: 'insolvency',
    name: 'Insolvency',
    description: 'Bankruptcy of individuals and winding up of companies — statutory demand to order.',
    icon: 'building',
    matters: [
      {
        id: 'winding-up',
        name: 'Winding Up',
        summary: 'Winding up a company debtor: statutory demand → 21 days → petition → affidavit verifying → advertisement → hearing → order.',
        workflowKeywords: ['winding up'],
        formNumbers: ['Form 69 (CWU Rules)', 'Form 3 (Winding Up)', 'Form 78 (CWU Rules)'],
        checklist: [
          'Confirm debt exceeds statutory minimum and is undisputed',
          'Serve s.466 statutory demand (Form 69) at registered office',
          'Wait 21 days — diarise expiry before presenting petition',
          'Prepare petition (Form 3) and affidavit verifying petition',
          'File, fix hearing date, and serve petition on the company',
          'Advertise petition (Gazette + newspaper) and lodge with SSM within time',
          'Prepare supporting affidavits and comply with CWU Rules timelines',
          'Attend hearing; extract winding-up order and notify Official Receiver',
        ],
      },
      {
        id: 'bankruptcy',
        name: 'Bankruptcy',
        summary: 'Bankruptcy of an individual debtor: bankruptcy notice → act of bankruptcy → creditor’s petition → order.',
        workflowKeywords: ['bankruptcy'],
        formNumbers: ['Form 1 (Insolvency)', 'Form 7 (Insolvency)', 'Form 8 (Insolvency)'],
        checklist: [
          'Confirm final judgment and debt above the statutory threshold',
          'Issue and serve bankruptcy notice (Form 1); personal service required',
          'Act of bankruptcy on non-compliance after 7 days — diarise',
          'Present creditor’s petition (Form 7) within 6 months of the act of bankruptcy',
          'Affidavit verifying petition (Form 8); attend hearing',
          'Post-order: file proof of debt with the Director General of Insolvency',
        ],
      },
    ],
  },
  {
    id: 'banking-recovery',
    name: 'Banking & Recovery',
    description: 'Loan recovery, foreclosure, hire purchase and receivership for financial institutions.',
    icon: 'landmark',
    matters: [
      {
        id: 'loan-recovery',
        name: 'Loan Recovery (Writ)',
        summary: 'Civil action on the facility agreement and guarantees, usually with an O.14 application.',
        workflowKeywords: ['recovery of loan', 'summary judgment'],
        formNumbers: ['Letter of Demand', 'Writ of Summons (General)', 'Form 26 (O.14)', 'Guarantee Agreement', 'Letter of Offer'],
        checklist: [
          'Compile facility documents: letter of offer, agreement, statements of account',
          'Issue letters of demand to borrower and each guarantor',
          'Verify certificate of indebtedness clause for evidential shortcut',
          'File writ; plan Order 14 application after appearance',
          'Consider parallel insolvency proceedings after judgment',
        ],
        moduleLink: { label: 'Open Banking Recovery module', path: '/app/banking-recovery' },
      },
      {
        id: 'foreclosure',
        name: 'Foreclosure / Order for Sale',
        summary: 'Enforcing a charge over land by order for sale (Order 83 / NLC 1965).',
        workflowKeywords: ['order for sale', 'foreclosure'],
        formNumbers: ['Form 16D', 'Form 16C', 'Form OS (Order 83)', 'Form Order 83 (Supplemental)', 'Form 16A'],
        checklist: [
          'Confirm charge duly registered (Form 16A) and default subsisting',
          'Serve Form 16D (registered land) or 16C notice; diarise 1-month expiry',
          'Prepare OS under Order 83 with strict r.3 affidavit contents',
          'Conduct land search and exhibit title in support',
          'Address any "cause to the contrary" arguments (Low Lee Lian)',
          'After order: fix auction date, valuation and reserve price',
        ],
        moduleLink: { label: 'Open Banking Recovery module', path: '/app/banking-recovery' },
      },
      {
        id: 'hire-purchase',
        name: 'Hire Purchase Recovery',
        summary: 'Repossession and deficiency claims under the Hire-Purchase Act 1967.',
        workflowKeywords: ['hire purchase'],
        formNumbers: ['Form HP1', 'Letter of Demand'],
        checklist: [
          'Serve Fourth Schedule notice before repossession; diarise 21 days',
          'Fifth Schedule notice after repossession within 21 days',
          'Observe the statutory sale procedure before deficiency claim',
          'Sue for deficiency only after proper credit of sale proceeds',
        ],
      },
      {
        id: 'receivership',
        name: 'Receiver & Manager',
        summary: 'Appointment of receivers under a debenture and related corporate enforcement.',
        workflowKeywords: ['receiver'],
        formNumbers: ['Debenture'],
        checklist: [
          'Confirm crystallisation event under the debenture',
          'Check the appointment formalities and required notices to SSM',
          'Coordinate with liquidator if winding up supervenes',
        ],
      },
    ],
  },
  {
    id: 'enforcement',
    name: 'Enforcement',
    description: 'Turning judgments into money — garnishee, seizure and sale, JDS and committal.',
    icon: 'gavel',
    matters: [
      {
        id: 'garnishee',
        name: 'Garnishee Proceedings',
        summary: 'Attaching debts owed to the judgment debtor — usually bank accounts (Order 49).',
        workflowKeywords: ['garnishee'],
        formNumbers: [],
        checklist: [
          'Identify garnishee (bank branch) and account particulars',
          'Ex parte application for order to show cause with supporting affidavit',
          'Serve order nisi on garnishee at least 7 days before hearing',
          'Attend show-cause hearing; obtain order absolute',
        ],
      },
      {
        id: 'wss',
        name: 'Writ of Seizure & Sale',
        summary: 'Seizing and auctioning the judgment debtor’s movable or immovable property (Order 47).',
        workflowKeywords: ['seizure', 'execution'],
        formNumbers: ['Writ of Seizure and Sale'],
        checklist: [
          'Conduct asset searches (land, JPJ, company) before choosing WSS',
          'Apply for leave where required (e.g. judgment older than 6 years)',
          'Extract writ (Form 83); coordinate with sheriff/bailiff for seizure',
          'For immovables: prohibitory order and registration under NLC',
          'Prepare for auction: valuation, reserve price, conditions of sale',
        ],
      },
      {
        id: 'jds',
        name: 'Judgment Debtor Summons',
        summary: 'Examining the debtor’s means and obtaining instalment orders (Order 48).',
        workflowKeywords: ['judgment debtor', 'examination'],
        formNumbers: ['Form O48'],
        checklist: [
          'File JDS with affidavit of the unpaid judgment sum',
          'Personal service on the judgment debtor is mandatory',
          'Prepare questionnaire on assets, income and liabilities',
          'Seek instalment order or committal warning on default',
        ],
      },
      {
        id: 'committal',
        name: 'Committal Proceedings',
        summary: 'Contempt proceedings for breach of court orders (Order 52).',
        workflowKeywords: ['committal', 'contempt'],
        formNumbers: [],
        checklist: [
          'Ensure the order breached was endorsed with a penal notice',
          'Obtain leave ex parte with statement and affidavit (O.52 r 3)',
          'Personal service of the order and committal papers',
          'Prove breach beyond reasonable doubt — strict compliance throughout',
        ],
        moduleLink: { label: 'Open Enforcement & Costs module', path: '/app/enforcement' },
      },
    ],
  },
];

export function findMatter(matterId: string): { area: PracticeArea; matter: MatterConfig } | null {
  for (const area of PRACTICE_AREAS) {
    const matter = area.matters.find(m => m.id === matterId);
    if (matter) return { area, matter };
  }
  return null;
}
