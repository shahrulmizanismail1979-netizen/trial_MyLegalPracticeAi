/**
 * Post-judgment enforcement methods under the Rules of Court 2012 (Orders 45–52)
 * and related statutes. Used to (a) present an enforcement reference library and
 * (b) ground the AI enforcement-strategy advisor.
 *
 * PRACTITIONER CAVEAT: court fees and statutory thresholds change. Always verify
 * the current figure, the correct forum and the latest rules before acting.
 */

export type DebtorKind = "individual" | "company" | "any";

export interface EnforcementMethod {
  id: string;
  name: string;
  shortName: string;
  basis: string;
  debtor: DebtorKind;
  /** What the method does, in one practitioner sentence. */
  summary: string;
  /** The asset/situation it targets. */
  targets: string;
  whenToUse: string[];
  prerequisites: string[];
  pros: string[];
  cons: string[];
  /** Indicative court fee note — VERIFY before relying. */
  courtFee: string;
}

export const ENFORCEMENT_METHODS: EnforcementMethod[] = [
  {
    id: "wss_movable",
    name: "Writ of Seizure and Sale — movable property",
    shortName: "WSS (movable)",
    basis: "O.46 & O.47 ROC 2012",
    debtor: "any",
    summary:
      "Direct the court bailiff to seize and sell the debtor's movable property and apply the proceeds to the judgment.",
    targets: "Vehicles, stock, equipment, goods and other movables owned by the debtor.",
    whenToUse: [
      "The debtor has identifiable, unencumbered movable assets.",
      "You want a relatively quick, self-contained execution.",
    ],
    prerequisites: [
      "A final money judgment that is enforceable (not stayed).",
      "Leave to issue execution if the judgment is more than 6 years old or there is a change of parties (O.46 r.2).",
    ],
    pros: [
      "Direct realisation of assets.",
      "Useful pressure where the debtor trades from identifiable premises.",
    ],
    cons: [
      "Bailiff/auction costs and delay; assets may be subject to prior charges or hire-purchase.",
      "Third parties may claim ownership (interpleader).",
    ],
    courtFee: "Filing fee + per-item seizure fee and bailiff levy (VERIFY current scale).",
  },
  {
    id: "wss_immovable",
    name: "Writ of Seizure and Sale — immovable property",
    shortName: "WSS (land)",
    basis: "O.46 & O.47 ROC 2012",
    debtor: "any",
    summary:
      "Seize and sell the debtor's land (where not already charged to you) by court-directed auction.",
    targets: "Land/immovable property registered in the debtor's name.",
    whenToUse: [
      "The debtor owns land with realisable equity.",
      "There is no separate charge giving you an O.83 order-for-sale route.",
    ],
    prerequisites: [
      "A final money judgment.",
      "Official land search confirming ownership and prior encumbrances.",
      "Prohibitory order / registration steps as required to bind the land.",
    ],
    pros: ["Reaches substantial fixed assets.", "Can secure priority by registration."],
    cons: [
      "Slow; auction at a reserve price; prior chargees rank ahead.",
      "Procedural steps to bind the land must be precise.",
    ],
    courtFee: "Filing fee; auctioneer's commission on sale price (VERIFY current scale).",
  },
  {
    id: "garnishee",
    name: "Garnishee proceedings",
    basis: "O.49 ROC 2012",
    shortName: "Garnishee",
    debtor: "any",
    summary:
      "Attach a debt owed to the judgment debtor by a third party (the garnishee) — typically money in the debtor's bank account — and have it paid to you.",
    targets: "Bank balances and other debts due/accruing to the debtor from third parties.",
    whenToUse: [
      "You can identify a bank account or a third party that owes the debtor money.",
      "You want a fast, low-cost attachment of liquid funds.",
    ],
    prerequisites: [
      "A final money judgment.",
      "Evidence identifying the garnishee and the debt (e.g. the debtor's bank/branch).",
    ],
    pros: ["Fast and inexpensive; captures liquid funds directly.", "Two-stage nisi/absolute process."],
    cons: [
      "Only catches debts existing at the date of the order nisi; empty accounts yield nothing.",
      "Joint accounts and disputed balances complicate matters.",
    ],
    courtFee: "Order nisi + order absolute filing fees (VERIFY current scale).",
  },
  {
    id: "jde",
    name: "Judgment Debtor Examination",
    shortName: "JDE (O.48)",
    basis: "O.48 ROC 2012",
    debtor: "any",
    summary:
      "Examine the judgment debtor on oath as to their assets and means, to inform which enforcement method to deploy.",
    targets: "Information — the debtor's assets, income, bank accounts and liabilities.",
    whenToUse: [
      "You do not yet know what the debtor owns.",
      "You want sworn disclosure before committing to an execution method.",
    ],
    prerequisites: ["A judgment.", "Order for the debtor (or an officer of a company) to attend for examination."],
    pros: ["Surfaces assets you can then target.", "Non-attendance can found contempt proceedings."],
    cons: ["Information-gathering only — does not itself recover money.", "Debtor may be evasive."],
    courtFee: "Filing fee per summons (VERIFY current scale).",
  },
  {
    id: "charging_order",
    name: "Charging order on securities / funds",
    shortName: "Charging order (O.50)",
    basis: "O.50 ROC 2012",
    debtor: "any",
    summary:
      "Impose a charge on the debtor's beneficial interest in shares, securities or funds, which can then be realised.",
    targets: "Shares, stock, units and money in court or funds standing to the debtor.",
    whenToUse: [
      "The debtor holds shares/securities or funds.",
      "You want to secure and then enforce against those interests.",
    ],
    prerequisites: ["A final money judgment.", "Identification of the securities/funds to be charged."],
    pros: ["Secures an interest pending realisation.", "Two-stage nisi/absolute process."],
    cons: ["Realisation requires further steps (e.g. sale).", "Value may fluctuate."],
    courtFee: "Order nisi + order absolute filing fees (VERIFY current scale).",
  },
  {
    id: "bankruptcy",
    name: "Bankruptcy (individual judgment debtor)",
    shortName: "Bankruptcy",
    basis: "Insolvency Act 1967; Insolvency Rules 2017",
    debtor: "individual",
    summary:
      "Bankrupt an individual on the judgment debt — a recovery route (dividend from the estate) and strong settlement pressure.",
    targets: "The whole estate of an individual debtor, administered by the Director General of Insolvency.",
    whenToUse: [
      "The debtor is an individual and the debt meets the bankruptcy threshold.",
      "Other execution has failed or the debtor has dispersed assets.",
    ],
    prerequisites: [
      "A final judgment that is not stayed.",
      "Debt at/above the bankruptcy threshold under s.5 Insolvency Act 1967 (VERIFY current figure — amended by the Insolvency (Amendment) Act 2023).",
      "Bankruptcy Notice served; non-compliance founds the act of bankruptcy.",
    ],
    pros: ["Powerful pressure; reaches the whole estate.", "Vests assets in the DGI for distribution."],
    cons: [
      "You share rateably with other creditors; slow process.",
      "Threshold and procedure must be exact; certain debtors are protected.",
    ],
    courtFee: "Bankruptcy Notice issue fee + Creditor's Petition filing fee (VERIFY current scale).",
  },
  {
    id: "winding_up",
    name: "Winding-up (company judgment debtor)",
    shortName: "Winding-up",
    basis: "ss.464–466 Companies Act 2016; Companies (Winding-Up) Rules 1972",
    debtor: "company",
    summary:
      "Wind up an insolvent company on its inability to pay debts — recovery via the liquidation and strong commercial pressure.",
    targets: "The company's assets, realised and distributed by the liquidator.",
    whenToUse: [
      "The debtor is a company owing at least the statutory threshold (RM10,000).",
      "The debt is undisputed and a statutory demand has gone unsatisfied.",
    ],
    prerequisites: [
      "A debt of at least RM10,000 (s.466(1)(a) CA 2016).",
      "s.466 statutory demand served at the registered office; 21 days expired without payment.",
      "The debt is not bona fide disputed on substantial grounds.",
    ],
    pros: ["Strong pressure; independent liquidator investigates and recovers assets.", "Reaches the whole company estate."],
    cons: [
      "Rateable distribution among creditors; abuse of process if the debt is disputed.",
      "Advertisement and liquidator-consent formalities.",
    ],
    courtFee: "Winding-up petition filing fee + advertisement costs (VERIFY current scale).",
  },
  {
    id: "committal",
    name: "Committal for contempt",
    shortName: "Committal (O.52)",
    basis: "O.52 ROC 2012",
    debtor: "any",
    summary:
      "Punish disobedience of a court order (e.g. breach of an injunction or a non-money order) by committal for contempt.",
    targets: "The contemnor personally — for breach of an order, not a money judgment as such.",
    whenToUse: [
      "The debtor has disobeyed a non-money order (injunction, undertaking, order to deliver up).",
      "Coercive or punitive relief is needed to secure compliance.",
    ],
    prerequisites: [
      "A clear, served order with a penal endorsement (where required).",
      "Leave to apply and a supporting affidavit proving deliberate breach.",
    ],
    pros: ["Coerces compliance with court orders.", "Available against officers of a company."],
    cons: ["Quasi-criminal standard; strict procedural compliance required.", "Not a money-recovery tool by itself."],
    courtFee: "Filing fee on application by originating summons/notice (VERIFY current scale).",
  },
  {
    id: "receiver",
    name: "Appointment of a receiver by way of equitable execution",
    shortName: "Receiver (O.51)",
    basis: "O.30 & O.51 ROC 2012; s.25 & Schedule (para 6) Courts of Judicature Act 1964",
    debtor: "any",
    summary:
      "Have the court appoint a receiver to intercept and collect an equitable or future interest of the debtor that ordinary execution (WSS, garnishee) cannot reach.",
    targets:
      "Rental income, partnership profits, distributions, royalties and other equitable or reversionary interests not attachable by legal execution.",
    whenToUse: [
      "The debtor's value lies in an interest the usual writs cannot touch (e.g. an equitable interest in land, a share of partnership profits, rent receivable).",
      "There is a real prospect the receiver will actually recover money after costs.",
    ],
    prerequisites: [
      "A final money judgment.",
      "Evidence of the specific interest/income stream and why ordinary execution is inadequate (it is discretionary and granted where 'just and convenient').",
      "A proposed receiver and security/remuneration arrangements.",
    ],
    pros: [
      "Reaches assets and income streams beyond ordinary execution.",
      "Flexible — the court tailors the receiver's powers to the interest.",
    ],
    cons: [
      "Discretionary, slower and more expensive; receiver's remuneration erodes recovery.",
      "Court must be satisfied it is the proportionate route.",
    ],
    courtFee:
      "Filing fee on application + receiver's security and remuneration (VERIFY current scale).",
  },
  {
    id: "prohibitory_order",
    name: "Prohibitory order / registrar's caveat over land",
    shortName: "Prohibitory order (NLC)",
    basis: "ss.334–335 National Land Code 1965; read with O.47 r.6 ROC 2012",
    debtor: "any",
    summary:
      "Obtain a prohibitory order binding the debtor's land so it cannot be transferred, charged or leased — the standard step to secure land before a writ of seizure and sale of immovable property.",
    targets: "Land/immovable property registered in the judgment debtor's name (including an undivided share).",
    whenToUse: [
      "The debtor owns land you intend to execute against and you need to freeze dealings first.",
      "You want to prevent the debtor disposing of or encumbering the land pending the auction.",
    ],
    prerequisites: [
      "A money judgment and an official land search confirming the registered proprietor and prior encumbrances.",
      "Application to the High Court for a prohibitory order; entry/registration at the land registry to bind the title (a prohibitory order generally endures for 6 months unless extended — VERIFY).",
    ],
    pros: [
      "Locks down the land and preserves priority pending sale.",
      "Essential precursor that makes a WSS over land effective.",
    ],
    cons: [
      "Time-limited — must be renewed if execution is not completed in time.",
      "Prior registered chargees still rank ahead; does not by itself realise money.",
    ],
    courtFee: "Application filing fee + land registry entry fee (VERIFY current scale).",
  },
  {
    id: "foreign_judgment",
    name: "Reciprocal enforcement of a foreign / Malaysian judgment",
    shortName: "Foreign judgment (REJA)",
    basis: "Reciprocal Enforcement of Judgments Act 1958 (Act 99); or common-law action on the judgment",
    debtor: "any",
    summary:
      "Register a money judgment from a reciprocating country (listed in the First Schedule to REJA 1958) in the Malaysian High Court so it can be enforced here as a local judgment — or, for non-listed countries, sue on the judgment at common law.",
    targets:
      "A debtor or assets located in Malaysia where the judgment was obtained in a reciprocating superior court abroad (or vice versa).",
    whenToUse: [
      "You hold a judgment from a REJA-listed country (e.g. specified Commonwealth/Singapore superior courts — VERIFY the current First Schedule) and the debtor/assets are in Malaysia.",
      "You need to convert a foreign money judgment into an enforceable Malaysian one before deploying the execution methods above.",
    ],
    prerequisites: [
      "A final and conclusive money judgment of a recognised superior court of a reciprocating country.",
      "Application to register within 6 years of the judgment (s.4(1) REJA 1958 — VERIFY); judgment not satisfied, not impeachable for fraud/public policy/lack of jurisdiction.",
      "For non-reciprocating countries: a fresh common-law action on the foreign judgment instead of registration.",
    ],
    pros: [
      "Avoids re-litigating the merits — registration converts it into a Malaysian judgment.",
      "Once registered, the full domestic enforcement toolkit becomes available.",
    ],
    cons: [
      "Only reciprocating countries can use the fast registration route; others need a fresh suit.",
      "Subject to challenge (fraud, jurisdiction, public policy, breach of natural justice) and strict time limits.",
    ],
    courtFee: "Originating summons / registration filing fee (VERIFY current scale).",
  },
];

export function findMethod(id: string): EnforcementMethod | undefined {
  return ENFORCEMENT_METHODS.find((m) => m.id === id);
}

/**
 * Catalogue of post-judgment enforcement COURT DOCUMENTS the AI drafter can
 * produce. Each entry carries server-only `promptGuidance` that tells the model
 * exactly what to draft and the governing rule. `promptGuidance` is stripped
 * before the catalogue is sent to the client (see the /methods route).
 */
export interface EnforcementDocument {
  id: string;
  /** Document name shown in the selector. */
  name: string;
  /** Governing Order/section. */
  basis: string;
  debtor: DebtorKind;
  /** One-line description of the instrument. */
  summary: string;
  /** What the drafter actually outputs (e.g. "Application + supporting affidavit"). */
  produces: string;
  /** Placeholder hint for the document-specific particulars field. */
  particularsHint: string;
  /** SERVER-ONLY drafting instruction for the model. Never sent to the client. */
  promptGuidance: string;
}

export const ENFORCEMENT_DOCUMENTS: EnforcementDocument[] = [
  {
    id: "wss",
    name: "Writ of Seizure and Sale",
    basis: "O.46 & O.47 ROC 2012",
    debtor: "any",
    summary:
      "Direct the bailiff to seize and sell the debtor's property to satisfy the judgment.",
    produces: "Praecipe to issue the writ + the Writ of Seizure and Sale",
    particularsHint:
      "Property to be seized (movables: vehicles/stock/equipment, or land title details), location, and any known encumbrances.",
    promptGuidance:
      "Draft (1) the Praecipe for issue of a Writ of Seizure and Sale and (2) the Writ itself directed to the bailiff/Sheriff under O.46–47 ROC 2012. Identify the judgment, the sum due with interest computed to date where given, and a numbered Schedule of the property to be seized. Expressly address whether leave to issue execution is needed (O.46 r.2 — judgment over 6 years old or a change of parties) and add it as a prerequisite if so.",
  },
  {
    id: "garnishee",
    name: "Garnishee Order to Show Cause (nisi)",
    basis: "O.49 r.1–2 ROC 2012",
    debtor: "any",
    summary:
      "Attach a debt owed to the judgment debtor by a third party (e.g. their bank).",
    produces: "Ex parte Notice of Application + supporting Affidavit + draft Order to Show Cause",
    particularsHint:
      "Garnishee's name and address (e.g. the debtor's bank and branch), the debt owed to the debtor (e.g. account balance), and the proposed hearing/return date.",
    promptGuidance:
      "Draft (1) the ex parte Notice of Application under O.49 r.1 ROC 2012, (2) the supporting Affidavit deposing to the judgment, the sum unpaid and that the named garnishee is indebted to (or holds money for) the judgment debtor within jurisdiction, and (3) a draft Garnishee Order to Show Cause (order nisi) returnable on the hearing date. Warn in a NOTES block about an empty/insufficient or joint account, the need to serve both the garnishee and the judgment debtor, and that the order is nisi until made absolute.",
  },
  {
    id: "jde",
    name: "Judgment Debtor Examination",
    basis: "O.48 ROC 2012",
    debtor: "any",
    summary:
      "Compel the debtor (or an officer of a corporate debtor) to be examined on oath as to assets and means.",
    produces: "Notice of Application + draft Order for examination",
    particularsHint:
      "Who is to be examined (the debtor, or the named director/officer of a company), and what asset information is sought.",
    promptGuidance:
      "Draft (1) the Notice of Application under O.48 r.1 ROC 2012 for an order that the judgment debtor (or, for a company, a named officer) attend court to be orally examined as to their assets and means, and (2) a draft Order for examination. Include a penal endorsement / note the consequences of non-attendance, and that documents (bank statements, accounts) may be ordered to be produced.",
  },
  {
    id: "leave_execution",
    name: "Leave to Issue Execution",
    basis: "O.46 r.2 ROC 2012",
    debtor: "any",
    summary:
      "Obtain leave to execute where the judgment is stale (6+ years) or parties have changed.",
    produces: "Notice of Application + supporting Affidavit",
    particularsHint:
      "Date of judgment, reason leave is needed (6+ years elapsed and/or change of parties), and why the debt remains unsatisfied.",
    promptGuidance:
      "Draft (1) the Notice of Application and (2) the supporting Affidavit for leave to issue execution under O.46 r.2 ROC 2012, where six years or more have elapsed since the judgment or there has been a change of parties. Explain the reason for the delay, confirm the judgment remains wholly/partly unsatisfied (state the sum), and identify the execution intended to be issued.",
  },
  {
    id: "bankruptcy_notice",
    name: "Bankruptcy Notice (individual debtor)",
    basis: "Insolvency Act 1967",
    debtor: "individual",
    summary:
      "Demand payment of the judgment debt from an individual; non-compliance is an act of bankruptcy.",
    produces: "Bankruptcy Notice + supporting Affidavit",
    particularsHint:
      "The judgment debt sum and date, and confirmation it remains unpaid. (Threshold/period to be verified against the current Insolvency Act 1967.)",
    promptGuidance:
      "Draft (1) a Bankruptcy Notice under the Insolvency Act 1967 requiring the individual judgment debtor to pay the judgment debt within the statutory period, and (2) a verifying Affidavit. Mark the minimum debt threshold and the compliance period as \"[VERIFY: current threshold/period under the Insolvency Act 1967]\" rather than stating a figure. State that failure to comply constitutes an act of bankruptcy founding a creditor's petition.",
  },
  {
    id: "winding_up",
    name: "Statutory Demand & Winding-Up Petition (company debtor)",
    basis: "ss.465–466 Companies Act 2016",
    debtor: "company",
    summary:
      "Demand payment from a company and petition to wind it up for inability to pay debts.",
    produces: "Statutory Notice of Demand (s.466) + draft Winding-Up Petition",
    particularsHint:
      "The company's name and registered office, the debt sum and date, and confirmation no bona fide dispute exists.",
    promptGuidance:
      "Draft (1) a statutory notice of demand under s.466(1)(a) Companies Act 2016 requiring the company to pay within 21 days, and (2) a draft creditor's Winding-Up Petition under s.465(1)(e)/466 on the ground of inability to pay debts. Mark the statutory demand threshold as \"[VERIFY: current threshold under s.466(1)(a) CA 2016]\". Warn prominently that winding-up must NOT be used to enforce a debt that is bona fide disputed on substantial grounds (risk of abuse-of-process strike-out and costs).",
  },
  {
    id: "charging_order",
    name: "Charging Order on shares/securities",
    basis: "O.50 ROC 2012",
    debtor: "any",
    summary:
      "Impose a charge over the debtor's shares or securities to secure the judgment sum.",
    produces: "Ex parte application + supporting Affidavit + draft Order nisi",
    particularsHint:
      "The shares/securities to be charged (company, number/class of shares or the security), and how the debtor's interest is held.",
    promptGuidance:
      "Draft (1) the ex parte Notice of Application under O.50 ROC 2012 for a charging order over the judgment debtor's shares/securities, (2) the supporting Affidavit identifying the asset and the debtor's beneficial interest, and (3) a draft Order nisi. Explain the two-stage show-cause/absolute process and the need to serve affected parties.",
  },
];

/** Public view of the document catalogue — strips server-only prompt guidance. */
export function publicEnforcementDocuments() {
  return ENFORCEMENT_DOCUMENTS.map(({ promptGuidance: _omit, ...rest }) => rest);
}

export function findDocument(id: string): EnforcementDocument | undefined {
  return ENFORCEMENT_DOCUMENTS.find((d) => d.id === id);
}

/** Bases on which a bill of costs may be drawn under O.59 ROC 2012. */
export const COSTS_BASES = [
  {
    id: "standard",
    name: "Standard basis (party-and-party)",
    description:
      "The default basis on taxation: only costs reasonably incurred and proportionate are allowed; any doubt is resolved against the receiving party (O.59 r.16(3)).",
  },
  {
    id: "indemnity",
    name: "Indemnity basis",
    description:
      "A special order (e.g. for reprehensible conduct or by agreement): all costs are allowed except those unreasonably incurred; doubt is resolved in favour of the receiving party.",
  },
  {
    id: "solicitor_client",
    name: "Solicitor-and-client basis",
    description:
      "Costs as between a solicitor and their own client; commonly contracted for (e.g. a full-indemnity costs clause in a facility agreement).",
  },
] as const;
