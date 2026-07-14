/**
 * Banking-recovery pathways grounded in Malaysian law and practice: the routes a
 * lender's solicitor takes to recover a defaulted facility. Each track sets out
 * when it is used, its prerequisites, the cause papers it generates and a
 * standard timeline that can be diarised against a matter.
 *
 * PRACTITIONER CAVEAT: these are the ordinary steps and periods. Statutory
 * thresholds (especially the bankruptcy threshold under the Insolvency Act 1967)
 * change — always verify the current figure, the correct forum and any specific
 * directions before relying on a date or filing.
 */

export type RecoveryDebtor = "individual" | "company" | "any";

export interface DueDiligenceItem {
  id: string;
  label: string;
  detail: string;
  source: string;
}

export interface CausePaper {
  id: string;
  name: string;
  basis: string;
  description: string;
  preAction?: boolean;
}

export interface RecoveryTimelineStep {
  label: string;
  offsetDays: number;
  category: string;
  basis: string;
  notes?: string;
}

export interface RecoveryTrack {
  id: string;
  name: string;
  shortName: string;
  debtor: RecoveryDebtor;
  summary: string;
  whenToUse: string[];
  prerequisites: string[];
  causePapers: CausePaper[];
  anchorLabel: string;
  timeline: RecoveryTimelineStep[];
  caveats: string[];
}

/**
 * Pre-action debtor due-diligence — run before committing to a recovery route so
 * the chosen track actually yields a return (a bankrupt or wound-up shell rarely
 * does).
 */
export const DUE_DILIGENCE: DueDiligenceItem[] = [
  {
    id: "ssm_company",
    label: "SSM company / business search",
    detail:
      "Confirm the debtor's exact registered name, company/registration number, status (existing, dormant, struck-off, in liquidation), directors and registered office, and any registered charges (debentures) ranking ahead of you.",
    source: "Companies Commission of Malaysia (SSM) — MyData / e-Info",
  },
  {
    id: "bankruptcy_search",
    label: "Bankruptcy / insolvency search",
    detail:
      "Check whether an individual debtor or guarantor is already an undischarged bankrupt (you cannot sue or bankrupt afresh without leave) and whether a company is already wound up or under judicial management.",
    source: "Insolvency Department (Jabatan Insolvensi Malaysia, MdI) e-Insolvency",
  },
  {
    id: "litigation_search",
    label: "Litigation / winding-up search",
    detail:
      "Search for pending suits, existing winding-up or bankruptcy petitions and registered judgments against the debtor to gauge competing creditors and the debtor's solvency.",
    source: "Court e-Filing / cause book search",
  },
  {
    id: "land_search",
    label: "Land title search",
    detail:
      "Conduct an official title search on any charged land: confirm the registered proprietor, your charge's priority, the title type (Registry vs Land Office) and any caveats or subsequent charges.",
    source: "Land Registry / Pejabat Tanah (official search)",
  },
  {
    id: "credit_report",
    label: "Credit / financial profile",
    detail:
      "Pull CCRIS/CTOS to assess the debtor's wider exposure and ability to pay before electing between a money judgment, bankruptcy/winding-up, or realising security.",
    source: "BNM CCRIS / CTOS",
  },
  {
    id: "security_docs",
    label: "Verify & stamp the security",
    detail:
      "Confirm the letter of offer, facility agreement, charge and any guarantee/indemnity are duly executed and properly stamped (an unstamped instrument is inadmissible until stamped), and that the charge is registered.",
    source: "Facility file + Stamp Act 1949",
  },
  {
    id: "compute_outstanding",
    label: "Crystallise the outstanding sum",
    detail:
      "Produce a certified statement of account showing principal, accrued interest and default interest as at a cut-off date — this underpins the indorsement of claim, the affidavit sum and any bankruptcy notice / statutory demand sum.",
    source: "Lender's statement of account (certificate of indebtedness)",
  },
  {
    id: "demand_served",
    label: "Serve the requisite demand / notice",
    detail:
      "Serve the letter of demand and any contractually or statutorily required notice (e.g. Form 16D for a charge, notice of default under the facility) and confirm valid service before commencing.",
    source: "Facility terms / NLC / relevant statute",
  },
];

export const RECOVERY_TRACKS: RecoveryTrack[] = [
  {
    id: "o14_summary_judgment",
    name: "Summary Judgment (Order 14) on the debt",
    shortName: "O.14 Summary Judgment",
    debtor: "any",
    summary:
      "Obtain judgment quickly on a liquidated facility debt where the borrower (or guarantor) has no triable defence, avoiding a full trial.",
    whenToUse: [
      "The claim is for a liquidated sum (outstanding under the facility) provable by documents.",
      "There is no bona fide triable issue or arguable defence.",
      "You hold a clear paper trail: letter of offer, facility agreement and certified statement of account.",
    ],
    prerequisites: [
      "Writ of Summons and Statement of Claim filed and served.",
      "The defendant has entered a Memorandum of Appearance.",
      "The Statement of Claim has been served (O.14 r.1).",
    ],
    causePapers: [
      {
        id: "writ_soc",
        name: "Writ of Summons & Statement of Claim",
        basis: "O.6 & O.18 ROC 2012",
        description:
          "Commences the recovery suit; pleads the facility, default and the certified outstanding sum with interest.",
      },
      {
        id: "sic_o14",
        name: "Summons in Chambers (application for summary judgment)",
        basis: "O.14 r.1 ROC 2012",
        description: "The interlocutory application asking the court for judgment without trial.",
      },
      {
        id: "affidavit_support",
        name: "Affidavit in Support",
        basis: "O.14 r.2 ROC 2012",
        description:
          "Verifies the facts, exhibits the facility documents and statement of account, and deposes belief that there is no defence.",
      },
      {
        id: "draft_judgment",
        name: "Draft Judgment",
        basis: "O.42 ROC 2012",
        description: "The judgment for entry once the application succeeds.",
      },
    ],
    anchorLabel: "Date the Memorandum of Appearance was entered",
    timeline: [
      {
        label: "File O.14 Summons in Chambers + Affidavit in Support",
        offsetDays: 14,
        category: "interlocutory",
        basis: "O.14 r.1 ROC 2012",
        notes: "File promptly after appearance; the SOC must have been served.",
      },
      {
        label: "Defendant's Affidavit in Reply (anticipated)",
        offsetDays: 28,
        category: "interlocutory",
        basis: "O.14 ROC 2012",
        notes: "Diarise to expect and answer the defendant's affidavit.",
      },
      {
        label: "Hearing of the summary judgment application",
        offsetDays: 56,
        category: "hearing",
        basis: "O.14 ROC 2012",
        notes: "Indicative — fixed by the registry; confirm the actual date.",
      },
    ],
    caveats: [
      "If the defendant raises a triable issue the court may give unconditional or conditional leave to defend (e.g. payment into court).",
      "Ensure the statement of account is properly certified and the sum claimed is liquidated, not unliquidated damages.",
    ],
  },
  {
    id: "o83_order_for_sale",
    name: "Order for Sale of charged land (Order 83)",
    shortName: "O.83 Order for Sale",
    debtor: "any",
    summary:
      "Realise a registered charge over land by obtaining a court order to sell the charged property by public auction and apply the proceeds to the debt.",
    whenToUse: [
      "You hold a registered charge under the National Land Code over the debtor's land.",
      "There is a continuing default the chargor has not remedied.",
      "You wish to recover the secured sum from the land rather than (or in addition to) a personal judgment.",
    ],
    prerequisites: [
      "A registered charge under the NLC.",
      "Statutory notice of default in Form 16D (s.254 NLC) served and the remedy period (one month) expired without the default being cured.",
      "Default continuing as at the date of the application.",
    ],
    causePapers: [
      {
        id: "form_16d",
        name: "Notice of Default — Form 16D",
        basis: "s.254 National Land Code",
        description:
          "Statutory notice giving the chargor (usually one month) to remedy the breach before foreclosure can be commenced.",
        preAction: true,
      },
      {
        id: "originating_summons",
        name: "Originating Summons for Order for Sale",
        basis: "O.83 r.3 & O.7 ROC 2012",
        description: "Commences the foreclosure proceedings for an order for sale.",
      },
      {
        id: "affidavit_support_os",
        name: "Affidavit in Support",
        basis: "O.83 r.3 ROC 2012",
        description:
          "Exhibits the charge, Form 16D and proof of service, the certified statement of account and the land search.",
      },
      {
        id: "draft_order_sale",
        name: "Draft Order for Sale",
        basis: "s.256 NLC / O.83 ROC 2012",
        description: "Fixes the reserve price and directs sale by public auction.",
      },
    ],
    anchorLabel: "Date Form 16D was served on the chargor",
    timeline: [
      {
        label: "Form 16D remedy period expires (no remedy = default subsists)",
        offsetDays: 31,
        category: "enforcement",
        basis: "s.254 NLC",
        notes: "Roughly one month; compute by reference to the actual notice period stated.",
      },
      {
        label: "File Originating Summons + Affidavit for order for sale",
        offsetDays: 35,
        category: "enforcement",
        basis: "O.83 ROC 2012",
      },
      {
        label: "Hearing of the Originating Summons",
        offsetDays: 90,
        category: "hearing",
        basis: "O.83 ROC 2012",
        notes: "Indicative — confirm the date fixed by the registry.",
      },
    ],
    caveats: [
      "Forum depends on title type: Registry title → High Court (s.256 NLC); Land Office title → Land Administrator (s.260 NLC).",
      "The chargor may show 'cause to the contrary' (s.256(3) NLC) to resist the order.",
      "Fix the reserve price on a current valuation; serve all subsequent chargees/parties with an interest.",
    ],
  },
  {
    id: "guarantor_suit",
    name: "Suit against the guarantor",
    shortName: "Guarantor Suit",
    debtor: "any",
    summary:
      "Enforce a contract of guarantee/indemnity against the guarantor for the borrower's default, often combined with summary judgment.",
    whenToUse: [
      "A valid, duly stamped guarantee or indemnity secures the facility.",
      "The principal borrower is in default and the guarantor's liability has crystallised.",
      "You have made (or are making) demand on the guarantor.",
    ],
    prerequisites: [
      "A duly executed and stamped guarantee/indemnity.",
      "Letter of demand served on the guarantor.",
      "The guarantor's liability has accrued under the terms of the guarantee.",
    ],
    causePapers: [
      {
        id: "demand_guarantor",
        name: "Letter of Demand on the Guarantor",
        basis: "Contracts Act 1950 ss.79–81",
        description: "Demands payment under the guarantee and crystallises the cause of action.",
        preAction: true,
      },
      {
        id: "writ_soc_guarantor",
        name: "Writ & Statement of Claim against the Guarantor",
        basis: "O.6 & O.18 ROC 2012; Contracts Act 1950 ss.79–81",
        description: "Pleads the guarantee, the principal default and the guaranteed sum.",
      },
      {
        id: "sic_o14_guarantor",
        name: "Summary Judgment application (where undefended)",
        basis: "O.14 ROC 2012",
        description: "Frequently the guarantor has no triable defence, so O.14 is run in parallel.",
      },
    ],
    anchorLabel: "Date the letter of demand was served on the guarantor",
    timeline: [
      {
        label: "Demand compliance period expires",
        offsetDays: 14,
        category: "custom",
        basis: "Per the guarantee / demand",
        notes: "Use the period stated in your demand (commonly 7–14 days).",
      },
      {
        label: "File Writ & Statement of Claim against the guarantor",
        offsetDays: 21,
        category: "pleading",
        basis: "O.6 & O.18 ROC 2012",
      },
      {
        label: "File O.14 summary judgment application (if undefended)",
        offsetDays: 49,
        category: "interlocutory",
        basis: "O.14 ROC 2012",
        notes: "After appearance is entered; see the O.14 track for the downstream steps.",
      },
    ],
    caveats: [
      "A surety may be discharged by a material variation of the principal contract made without consent (s.86 Contracts Act 1950) or release of a co-surety (s.44).",
      "Confirm whether the guarantee is continuing and covers the sum claimed; ensure it is stamped before relying on it in evidence.",
    ],
  },
  {
    id: "bankruptcy",
    name: "Bankruptcy of an individual judgment debtor",
    shortName: "Bankruptcy",
    debtor: "individual",
    summary:
      "Bankrupt an individual debtor on a final judgment debt — both a recovery mechanism (dividend from the estate) and commercial pressure to settle.",
    whenToUse: [
      "You hold a final judgment against an individual that remains unsatisfied.",
      "The judgment debt meets the statutory bankruptcy threshold.",
      "The debtor is not already an undischarged bankrupt.",
    ],
    prerequisites: [
      "A final judgment that is not stayed.",
      "Judgment debt at or above the bankruptcy threshold under s.5 Insolvency Act 1967 (VERIFY the current figure — amended by the Insolvency (Amendment) Act 2023).",
      "Judgment not more than 6 years old (otherwise leave to issue execution is needed).",
    ],
    causePapers: [
      {
        id: "bankruptcy_notice",
        name: "Bankruptcy Notice",
        basis: "Insolvency Act 1967; Insolvency Rules 2017",
        description:
          "Demands payment of the judgment sum; non-compliance within the prescribed time is an act of bankruptcy.",
      },
      {
        id: "creditors_petition",
        name: "Creditor's Petition",
        basis: "s.5 Insolvency Act 1967",
        description: "Founded on the act of bankruptcy; seeks adjudication and a receiving order.",
      },
      {
        id: "affidavit_petition",
        name: "Affidavit verifying petition & affidavit of service",
        basis: "Insolvency Rules 2017",
        description: "Verifies the petition and proves service of the bankruptcy notice and petition.",
      },
    ],
    anchorLabel: "Date the Bankruptcy Notice was served",
    timeline: [
      {
        label: "Time to comply with the Bankruptcy Notice expires (act of bankruptcy)",
        offsetDays: 7,
        category: "enforcement",
        basis: "Insolvency Act 1967",
        notes: "Non-compliance within the prescribed period constitutes an act of bankruptcy.",
      },
      {
        label: "File the Creditor's Petition",
        offsetDays: 21,
        category: "enforcement",
        basis: "s.5 Insolvency Act 1967",
        notes: "The act of bankruptcy must be available (within 6 months) when the petition is presented.",
      },
      {
        label: "Hearing of the Creditor's Petition",
        offsetDays: 90,
        category: "hearing",
        basis: "Insolvency Act 1967",
        notes: "Indicative — confirm the date fixed by the court.",
      },
    ],
    caveats: [
      "VERIFY the current bankruptcy threshold figure — it has been amended (Insolvency (Amendment) Act 2023) and must match the judgment sum.",
      "The debtor may apply to set aside the bankruptcy notice; the sum demanded must accord exactly with the judgment.",
      "Certain debtors (e.g. social guarantors in defined circumstances) attract special protection — check eligibility before proceeding.",
    ],
  },
  {
    id: "winding_up",
    name: "Winding-up of a company debtor",
    shortName: "Winding-up",
    debtor: "company",
    summary:
      "Wind up an insolvent company debtor on the ground of inability to pay its debts, founded on an unsatisfied statutory demand.",
    whenToUse: [
      "The debtor is a company that owes a sum at or above the winding-up threshold.",
      "The debt is undisputed (a bona fide dispute on substantial grounds defeats a petition).",
      "The company has failed to satisfy a statutory demand.",
    ],
    prerequisites: [
      "A debt of at least RM10,000 (s.466(1)(a) Companies Act 2016).",
      "A statutory notice of demand under s.466 served at the company's registered office.",
      "21 days expired without payment, security or compounding — the company is then deemed unable to pay its debts.",
    ],
    causePapers: [
      {
        id: "statutory_demand_466",
        name: "Statutory Notice of Demand (s.466)",
        basis: "s.466 Companies Act 2016",
        description:
          "Served at the registered office; 21 days' non-compliance founds the deemed inability to pay debts.",
        preAction: true,
      },
      {
        id: "winding_up_petition",
        name: "Winding-up Petition",
        basis: "ss.464–466 Companies Act 2016; Companies (Winding-Up) Rules 1972",
        description: "Seeks an order to wind up the company and appoint a liquidator.",
      },
      {
        id: "affidavit_verifying_wu",
        name: "Affidavit verifying petition, affidavit of service & consent of liquidator",
        basis: "Companies (Winding-Up) Rules 1972",
        description: "Verifies the petition, proves service and exhibits the liquidator's consent to act.",
      },
    ],
    anchorLabel: "Date the s.466 statutory demand was served",
    timeline: [
      {
        label: "21-day compliance period expires (deemed inability to pay)",
        offsetDays: 21,
        category: "enforcement",
        basis: "s.466(1)(a) Companies Act 2016",
      },
      {
        label: "File the Winding-up Petition",
        offsetDays: 25,
        category: "enforcement",
        basis: "s.465 Companies Act 2016",
      },
      {
        label: "Advertise and serve the petition",
        offsetDays: 80,
        category: "custom",
        basis: "Companies (Winding-Up) Rules 1972",
        notes: "Advertisement must appear within the period prescribed before the hearing.",
      },
      {
        label: "Hearing of the Winding-up Petition",
        offsetDays: 90,
        category: "hearing",
        basis: "Companies Act 2016",
        notes: "Indicative — confirm the date fixed by the court.",
      },
    ],
    caveats: [
      "A debt disputed on bona fide and substantial grounds makes a petition an abuse of process — do not use winding-up to enforce a genuinely disputed debt.",
      "Serve the s.466 demand at the registered office; defects in service are fatal.",
      "Obtain the proposed liquidator's written consent and comply with the advertisement/gazette requirements.",
    ],
  },
];

export function findTrack(id: string): RecoveryTrack | undefined {
  return RECOVERY_TRACKS.find((t) => t.id === id);
}
