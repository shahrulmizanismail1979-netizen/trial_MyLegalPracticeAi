/**
 * Deadline templates grounded in the Malaysian Rules of Court 2012 (ROC 2012),
 * the Limitation Act 1953 and the appellate rules. Given a trigger event and its
 * date, we compute the standard downstream deadlines a litigator must diarise.
 *
 * IMPORTANT (practitioner caveat): these are the ordinary periods. ROC 2012 O.3
 * r.2(2) excludes intervening weekends/public holidays where a period is under 6
 * days, and the court may abridge or extend time. Always verify against the
 * sealed cause papers and any specific directions before relying on a date.
 */

export type DeadlineCategory =
  | "limitation"
  | "appearance"
  | "pleading"
  | "interlocutory"
  | "hearing"
  | "enforcement"
  | "appeal"
  | "custom";

export interface ComputedDeadline {
  title: string;
  category: DeadlineCategory;
  dueDate: string; // ISO date
  basis: string;
  notes?: string;
}

interface TemplateRule {
  title: string;
  category: DeadlineCategory;
  offsetDays?: number;
  offsetYears?: number;
  basis: string;
  notes?: string;
}

export interface TriggerTemplate {
  trigger: string;
  label: string;
  description: string;
  rules: TemplateRule[];
}

export const DEADLINE_TRIGGERS: TriggerTemplate[] = [
  {
    trigger: "writ_served",
    label: "Writ served on defendant",
    description:
      "Service of a Writ of Summons (with Statement of Claim endorsed) on the defendant.",
    rules: [
      {
        title: "Enter Memorandum of Appearance",
        category: "appearance",
        offsetDays: 14,
        basis: "O.12 r.4 ROC 2012",
        notes:
          "Within 14 days after service of the writ (inclusive of the day of service).",
      },
      {
        title: "File & serve Statement of Defence",
        category: "pleading",
        offsetDays: 28,
        basis: "O.18 r.2 ROC 2012",
        notes:
          "Within 14 days after the time limited for appearance (assumes SOC endorsed on the writ). If SOC served separately, count 14 days from that service instead.",
      },
    ],
  },
  {
    trigger: "soc_served",
    label: "Statement of Claim served separately",
    description:
      "Where the Statement of Claim is served after the writ rather than endorsed on it.",
    rules: [
      {
        title: "File & serve Statement of Defence",
        category: "pleading",
        offsetDays: 14,
        basis: "O.18 r.2 ROC 2012",
        notes: "Within 14 days after service of the Statement of Claim.",
      },
    ],
  },
  {
    trigger: "defence_served",
    label: "Defence served",
    description: "The defendant has served its Statement of Defence.",
    rules: [
      {
        title: "File & serve Reply (and Defence to Counterclaim, if any)",
        category: "pleading",
        offsetDays: 14,
        basis: "O.18 r.3 ROC 2012",
        notes:
          "A Reply, if any, must be served within 14 days after service of the Defence.",
      },
    ],
  },
  {
    trigger: "judgment_date",
    label: "Judgment obtained / pronounced",
    description: "Date the court delivered judgment or the order was made.",
    rules: [
      {
        title: "File Notice of Appeal to Court of Appeal (if appealing)",
        category: "appeal",
        offsetDays: 30,
        basis: "r.6 Rules of the Court of Appeal 1994",
        notes:
          "Within 30 days from the date the decision was pronounced. Leave may be required for certain matters.",
      },
      {
        title: "Limitation to enforce the judgment expires",
        category: "enforcement",
        offsetYears: 12,
        basis: "s.6(3) Limitation Act 1953",
        notes:
          "An action upon a judgment cannot be brought after 12 years from when it became enforceable.",
      },
    ],
  },
  {
    trigger: "contract_breach",
    label: "Breach of contract / debt due date",
    description:
      "Date a contractual breach occurred or a contractual debt fell due.",
    rules: [
      {
        title: "Limitation to sue on the contract/debt expires",
        category: "limitation",
        offsetYears: 6,
        basis: "s.6(1)(a) Limitation Act 1953",
        notes: "6 years from the date of breach / when the debt became payable.",
      },
    ],
  },
  {
    trigger: "tort_damage",
    label: "Tort — damage suffered",
    description: "Date damage was suffered for a general (non-PI) tort claim.",
    rules: [
      {
        title: "Limitation to sue in tort expires",
        category: "limitation",
        offsetYears: 6,
        basis: "s.6(1)(a) Limitation Act 1953",
        notes: "6 years from when the damage was suffered.",
      },
    ],
  },
  {
    trigger: "loan_default",
    label: "Loan default (banking recovery)",
    description:
      "Date of default under a facility — drives both the personal covenant and the security limitation.",
    rules: [
      {
        title: "Limitation to sue borrower on the personal covenant expires",
        category: "limitation",
        offsetYears: 6,
        basis: "s.6(1)(a) Limitation Act 1953",
        notes: "6 years from breach of the loan agreement (suing the borrower).",
      },
      {
        title: "Limitation to recover on the charge/mortgage expires",
        category: "limitation",
        offsetYears: 12,
        basis: "s.21(1) Limitation Act 1953",
        notes:
          "12 years from the date the right to receive the money accrued (action to recover principal sum secured by a charge on land).",
      },
    ],
  },
  {
    trigger: "ptcm_date",
    label: "Pre-Trial Case Management fixed",
    description:
      "A PTCM date has been fixed under O.34 — bundles and witness statements are usually directed here.",
    rules: [
      {
        title: "Pre-Trial Case Management hearing",
        category: "hearing",
        offsetDays: 0,
        basis: "O.34 ROC 2012",
        notes:
          "Attend PTCM. Directions for Bundle of Pleadings, Common Agreed Bundle, issues to be tried, agreed facts, list of witnesses and witness statements are typically given with strict timelines.",
      },
    ],
  },
];

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + days);
  return r;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d.getTime());
  r.setFullYear(r.getFullYear() + years);
  return r;
}

/**
 * ROC 2012 O.3 r.2(4): where the last day for doing an act falls on a day on
 * which the court registry is closed (Saturday, Sunday or a public holiday),
 * the act is in time if done on the next day the registry is open. We roll a
 * Saturday/Sunday forward to the following Monday. Public holidays vary by
 * state and year and are NOT applied automatically — the practitioner caveat
 * directs users to verify against the calendar.
 */
function rollForwardOffWeekend(d: Date): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDay();
  if (day === 6) r.setUTCDate(r.getUTCDate() + 2); // Saturday -> Monday
  else if (day === 0) r.setUTCDate(r.getUTCDate() + 1); // Sunday -> Monday
  return r;
}

/**
 * Compute the standard deadlines flowing from a trigger event on a given date.
 * Returns an empty array for an unknown trigger.
 */
export function computeDeadlines(
  trigger: string,
  triggerDateIso: string,
): ComputedDeadline[] {
  const template = DEADLINE_TRIGGERS.find((t) => t.trigger === trigger);
  if (!template) return [];
  const base = new Date(triggerDateIso);
  if (Number.isNaN(base.getTime())) return [];

  return template.rules.map((rule) => {
    let due = base;
    if (rule.offsetYears) due = addYears(due, rule.offsetYears);
    if (rule.offsetDays) due = addDays(due, rule.offsetDays);
    // Roll procedural day-based deadlines off a weekend to the next open day
    // (O.3 r.2(4)). Limitation periods (years) are substantive bars and are
    // NOT rolled forward — they expire on the calendar date.
    if (rule.offsetDays && !rule.offsetYears && rule.category !== "limitation") {
      due = rollForwardOffWeekend(due);
    }
    return {
      title: rule.title,
      category: rule.category,
      dueDate: due.toISOString(),
      basis: rule.basis,
      notes: rule.notes,
    };
  });
}
