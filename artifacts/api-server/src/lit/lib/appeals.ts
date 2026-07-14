/**
 * Appeals & jurisdiction library for Malaysian civil litigation.
 *
 * Two jobs:
 *  1. Forum routing — given a claim amount, indicate the court of first instance
 *     (Magistrates / Sessions / High Court) under the Subordinate Courts Act 1948
 *     and the Courts of Judicature Act 1964 (CJA).
 *  2. Appeal pathways — for each tier, the appellate forum, whether leave is
 *     required, the ordinary time limits and the cause papers generated.
 *
 * PRACTITIONER CAVEAT: monetary jurisdiction limits and appeal periods change and
 * are subject to specific computation rules (and extensions). The figures below are
 * the ordinary positions; always verify the current limit, the correct forum, the
 * exact period and its starting point against the primary sources before relying on
 * a date or filing.
 */

export type Forum = "magistrates" | "sessions" | "high-court";

export interface ForumTier {
  id: Forum;
  name: string;
  statute: string;
  /** Lower bound (exclusive) in RM; null = no lower bound. */
  min: number | null;
  /** Upper bound (inclusive) in RM; null = unlimited. */
  max: number | null;
  scope: string;
}

/**
 * Civil monetary jurisdiction of the courts of first instance.
 * NOTE the limits are marked for verification — they have been revised by order
 * and may change again.
 */
export const FORUM_TIERS: ForumTier[] = [
  {
    id: "magistrates",
    name: "Magistrates' Court",
    statute: "Subordinate Courts Act 1948, s.90 [VERIFY current limit]",
    min: null,
    max: 100_000,
    scope:
      "Civil claims where the amount in dispute or value of the subject-matter does not exceed RM100,000 [VERIFY].",
  },
  {
    id: "sessions",
    name: "Sessions Court",
    statute: "Subordinate Courts Act 1948, s.65 [VERIFY current limit]",
    min: 100_000,
    max: 1_000_000,
    scope:
      "Civil claims where the amount in dispute exceeds RM100,000 but does not exceed RM1,000,000 [VERIFY]. The Sessions Court also has unlimited jurisdiction in certain matters (e.g. motor-vehicle accidents, landlord-and-tenant, distress).",
  },
  {
    id: "high-court",
    name: "High Court",
    statute: "Courts of Judicature Act 1964, s.23–24",
    min: 1_000_000,
    max: null,
    scope:
      "Civil claims exceeding the Sessions Court limit, plus matters within the High Court's exclusive original jurisdiction (e.g. land, probate, company winding-up, judicial review, admiralty).",
  },
];

export interface ForumResult {
  amount: number;
  forum: ForumTier;
  rationale: string;
  note: string;
}

/** Route a money claim to its court of first instance by amount. */
export function routeForum(amount: number): ForumResult {
  const tier =
    FORUM_TIERS.find(
      (t) =>
        (t.min === null || amount > t.min) &&
        (t.max === null || amount <= t.max),
    ) ?? FORUM_TIERS[FORUM_TIERS.length - 1];

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      maximumFractionDigits: 0,
    }).format(n);

  return {
    amount,
    forum: tier,
    rationale:
      tier.id === "magistrates"
        ? `${fmt(amount)} is within the Magistrates' Court limit of ${fmt(100_000)} [VERIFY].`
        : tier.id === "sessions"
          ? `${fmt(amount)} exceeds the Magistrates' limit but is within the Sessions Court limit of ${fmt(1_000_000)} [VERIFY].`
          : `${fmt(amount)} exceeds the Sessions Court limit, so the claim is brought in the High Court.`,
    note: "Forum is not decided by amount alone — the nature of the claim (land, equity, company, judicial review, admiralty, etc.) may compel the High Court regardless of value. Confirm the current monetary limits and any subject-matter rule before filing.",
  };
}

export interface AppealCausePaper {
  id: string;
  name: string;
  basis: string;
  description: string;
}

export interface AppealStep {
  label: string;
  offsetDays: number;
  category: string;
  basis: string;
  notes?: string;
}

export interface AppealPathway {
  id: string;
  name: string;
  shortName: string;
  fromForum: string;
  toForum: string;
  summary: string;
  leaveRequired: boolean;
  leaveNote: string;
  prerequisites: string[];
  causePapers: AppealCausePaper[];
  anchorLabel: string;
  timeline: AppealStep[];
  caveats: string[];
}

export const APPEAL_PATHWAYS: AppealPathway[] = [
  {
    id: "subordinate_to_high_court",
    name: "Appeal from a Subordinate Court to the High Court",
    shortName: "Subordinate → High Court",
    fromForum: "Magistrates' / Sessions Court",
    toForum: "High Court",
    summary:
      "Appeal a final decision of a Magistrates' or Sessions Court to the High Court in its appellate jurisdiction.",
    leaveRequired: false,
    leaveNote:
      "No leave is ordinarily required to appeal a final decision; leave may be needed for certain interlocutory orders or where the amount is below a threshold [VERIFY].",
    prerequisites: [
      "A decision of a Magistrates' or Sessions Court that is appealable.",
      "Where required, the appellant has applied for and obtained the grounds of judgment.",
    ],
    causePapers: [
      {
        id: "notice_appeal_sub",
        name: "Notice of Appeal",
        basis: "O.55 r.2 ROC 2012 [VERIFY rule]",
        description:
          "Filed within 14 days of the decision appealed against [VERIFY period and starting point], stating the intention to appeal.",
      },
      {
        id: "memorandum_appeal_sub",
        name: "Memorandum of Appeal",
        basis: "O.55 r.3 ROC 2012 [VERIFY rule]",
        description:
          "Sets out the grounds of appeal concisely, filed within the prescribed period after receipt of the grounds of judgment / notes of evidence [VERIFY].",
      },
      {
        id: "record_appeal_sub",
        name: "Record of Appeal",
        basis: "O.55 ROC 2012 [VERIFY]",
        description:
          "The compiled record (pleadings, notes of evidence, exhibits, grounds of judgment) before the High Court.",
      },
    ],
    anchorLabel: "Date of the decision appealed against",
    timeline: [
      {
        label: "File Notice of Appeal",
        offsetDays: 14,
        category: "appeal",
        basis: "O.55 ROC 2012 [VERIFY period]",
        notes:
          "Ordinary period is 14 days from the decision [VERIFY]; confirm the exact starting point.",
      },
      {
        label: "Apply for / receive grounds of judgment & notes of evidence",
        offsetDays: 21,
        category: "appeal",
        basis: "Registry practice [VERIFY]",
        notes: "The memorandum period typically runs from receipt of the grounds.",
      },
      {
        label: "File Memorandum of Appeal",
        offsetDays: 35,
        category: "appeal",
        basis: "O.55 ROC 2012 [VERIFY period]",
        notes: "Diarise from receipt of grounds of judgment — confirm the period.",
      },
    ],
    caveats: [
      "Time limits for appeals are strictly enforced; an extension requires a separate application with good reason.",
      "Check whether the order is final or interlocutory — the route and any leave requirement differ.",
    ],
  },
  {
    id: "high_court_to_court_of_appeal",
    name: "Appeal from the High Court to the Court of Appeal",
    shortName: "High Court → Court of Appeal",
    fromForum: "High Court",
    toForum: "Court of Appeal",
    summary:
      "Appeal a decision of the High Court (in its original or appellate jurisdiction, subject to limits) to the Court of Appeal.",
    leaveRequired: false,
    leaveNote:
      "No leave is generally required to appeal a final High Court decision in its original jurisdiction; restrictions apply (e.g. s.68 CJA bars certain appeals — small amounts, consent judgments, costs only) [VERIFY].",
    prerequisites: [
      "An appealable decision of the High Court (mind the s.68 CJA exclusions).",
      "Where the decision was in the High Court's appellate jurisdiction, a further appeal may need leave / a question of law [VERIFY].",
    ],
    causePapers: [
      {
        id: "notice_appeal_coa",
        name: "Notice of Appeal",
        basis: "s.67 CJA 1964; Rules of the Court of Appeal 1994 r.12 [VERIFY]",
        description:
          "Filed within 30 days from the date of the decision appealed against [VERIFY period and starting point].",
      },
      {
        id: "memorandum_appeal_coa",
        name: "Memorandum of Appeal",
        basis: "Rules of the Court of Appeal 1994 [VERIFY rule]",
        description:
          "Concise grounds of appeal, filed within the prescribed period after the Record of Appeal / grounds are ready [VERIFY].",
      },
      {
        id: "record_appeal_coa",
        name: "Record of Appeal",
        basis: "Rules of the Court of Appeal 1994 [VERIFY]",
        description:
          "The bound record placed before the Court of Appeal (core and supplementary records as directed).",
      },
    ],
    anchorLabel: "Date of the High Court decision",
    timeline: [
      {
        label: "File Notice of Appeal",
        offsetDays: 30,
        category: "appeal",
        basis: "RCA 1994 r.12 [VERIFY period]",
        notes:
          "Ordinary period is 30 days from the decision [VERIFY]; deposit for costs of appeal is payable.",
      },
      {
        label: "File Memorandum & Record of Appeal",
        offsetDays: 60,
        category: "appeal",
        basis: "RCA 1994 [VERIFY period]",
        notes:
          "Indicative — runs from when the grounds of judgment / notes of proceedings are ready; confirm.",
      },
      {
        label: "Case management before the Court of Appeal (anticipated)",
        offsetDays: 90,
        category: "hearing",
        basis: "Registry direction [VERIFY]",
        notes: "Indicative; the registry fixes case management and hearing dates.",
      },
    ],
    caveats: [
      "s.68 CJA excludes certain appeals (e.g. where the amount/value is below the threshold, consent judgments, costs in the discretion of the court) — verify the order is appealable as of right.",
      "A deposit as security for the respondent's costs of the appeal must be paid within the prescribed time.",
    ],
  },
  {
    id: "court_of_appeal_to_federal_court",
    name: "Appeal from the Court of Appeal to the Federal Court (with leave)",
    shortName: "Court of Appeal → Federal Court",
    fromForum: "Court of Appeal",
    toForum: "Federal Court",
    summary:
      "Seek leave to appeal to the Federal Court against a Court of Appeal decision in a matter decided by the High Court in its original jurisdiction.",
    leaveRequired: true,
    leaveNote:
      "Leave of the Federal Court is required under s.96 CJA. Leave is confined to questions of general principle decided for the first time, or of importance upon which further argument and a decision would be to public advantage [VERIFY exact wording].",
    prerequisites: [
      "A Court of Appeal decision in respect of a matter decided by the High Court in its original jurisdiction (s.96(a) CJA) [VERIFY].",
      "A question of law that meets the s.96 threshold.",
    ],
    causePapers: [
      {
        id: "notice_motion_leave",
        name: "Notice of Motion for Leave to Appeal",
        basis: "s.96 & s.97 CJA 1964; Rules of the Federal Court 1995 [VERIFY]",
        description:
          "Filed within 1 month of the Court of Appeal decision [VERIFY period], with an affidavit and the proposed questions of law.",
      },
      {
        id: "affidavit_leave",
        name: "Affidavit in Support (leave)",
        basis: "Rules of the Federal Court 1995 [VERIFY]",
        description:
          "Exhibits the Court of Appeal grounds and sets out why the questions satisfy the s.96 threshold.",
      },
      {
        id: "notice_appeal_fc",
        name: "Notice of Appeal (after leave granted)",
        basis: "Rules of the Federal Court 1995 [VERIFY]",
        description:
          "Filed within the prescribed period after leave is granted, followed by the Record of Appeal.",
      },
    ],
    anchorLabel: "Date of the Court of Appeal decision",
    timeline: [
      {
        label: "File Notice of Motion for Leave to Appeal",
        offsetDays: 30,
        category: "appeal",
        basis: "s.97 CJA 1964 [VERIFY period]",
        notes: "Ordinary period is 1 month from the CoA decision [VERIFY].",
      },
      {
        label: "Hearing of the leave motion (anticipated)",
        offsetDays: 90,
        category: "hearing",
        basis: "Registry direction [VERIFY]",
        notes: "Indicative; fixed by the Federal Court registry.",
      },
      {
        label: "If leave granted: file Notice of Appeal & Record",
        offsetDays: 120,
        category: "appeal",
        basis: "Rules of the Federal Court 1995 [VERIFY]",
        notes: "Runs from the grant of leave — confirm the period.",
      },
    ],
    caveats: [
      "The Federal Court is not a second tier of appeal as of right — without leave on a qualifying question of law there is no appeal.",
      "s.96 limits appeals to CoA decisions on matters decided by the High Court in its original jurisdiction; appeals from the High Court's appellate jurisdiction face further restrictions.",
    ],
  },
];

export function findPathway(id: string): AppealPathway | undefined {
  return APPEAL_PATHWAYS.find((p) => p.id === id);
}
