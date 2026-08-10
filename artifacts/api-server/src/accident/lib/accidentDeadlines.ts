/**
 * Deadline templates for Malaysian accident / personal-injury ("running-down")
 * practice, grounded mainly in the Limitation Act 1953, the Civil Law Act 1956
 * (fatal accidents / dependency), the Road Transport Act 1987 (s.96 insurer
 * notice), the Public Authorities Protection Act 1948 and the Rules of Court
 * 2012.
 *
 * IMPORTANT (practitioner caveat): these are the ordinary statutory periods.
 * Limitation runs differently for minors, persons under disability and fatal
 * accident claims, and periods against public authorities are shortened. The
 * court may extend or abridge procedural time. Always verify against the
 * sealed process, the applicable enactment and current practice directions
 * before relying on a date.
 */

export type AccDeadlineCategory =
  | "notice"
  | "limitation"
  | "pleading"
  | "trial"
  | "appeal"
  | "enforcement"
  | "custom";

export interface ComputedAccDeadline {
  title: string;
  category: AccDeadlineCategory;
  dueDate: string; // ISO date
  basis: string;
  notes?: string;
}

interface TemplateRule {
  title: string;
  category: AccDeadlineCategory;
  offsetDays?: number;
  offsetYears?: number;
  basis: string;
  notes?: string;
}

export interface AccTriggerTemplate {
  trigger: string;
  label: string;
  description: string;
  rules: TemplateRule[];
}

export const ACC_DEADLINE_TRIGGERS: AccTriggerTemplate[] = [
  {
    trigger: "accident",
    label: "Date of accident",
    description:
      "The date of the road accident / injury. Drives the police report, the insurer notice under s.96 RTA 1987 and the primary limitation horizon.",
    rules: [
      {
        title: "Lodge police report (within 24 hours)",
        category: "notice",
        offsetDays: 1,
        basis: "s.52 Road Transport Act 1987; practice",
        notes:
          "A police report should be lodged as soon as reasonably practicable — within 24 hours where possible. Obtain the report, sketch plan and key to prove liability.",
      },
      {
        title: "Notice to insurer under s.96(2) RTA 1987",
        category: "notice",
        offsetDays: 7,
        basis: "s.96(2) Road Transport Act 1987",
        notes:
          "Written notice of the bringing of proceedings must be given to the insurer before or within 7 days after commencing the action; give early notice of the claim as a matter of practice.",
      },
      {
        title: "Primary limitation period expires (personal injury)",
        category: "limitation",
        offsetYears: 3,
        basis: "s.6(1) & Sch. Limitation Act 1953",
        notes:
          "Actions for damages for negligence causing personal injury are ordinarily barred 3 years* from the cause of action. *Verify — many personal-injury / running-down actions are treated under the 6-year tort period; confirm the correct period and any disability/minority extension for THIS claim before relying on it.",
      },
    ],
  },
  {
    trigger: "fatal",
    label: "Date of death (fatal accident)",
    description:
      "Fatal accident claim. Dependency (s.7) and estate (s.8) claims under the Civil Law Act 1956 with their own limitation horizon.",
    rules: [
      {
        title: "Dependency claim limitation expires (s.7 CLA)",
        category: "limitation",
        offsetYears: 3,
        basis: "s.7(5) Civil Law Act 1956",
        notes:
          "A dependency action under s.7 CLA 1956 must be brought within 3 years of the death. Identify all dependants and quantify the multiplier-multiplicand early.",
      },
      {
        title: "Estate claim — extract grant of representation",
        category: "notice",
        offsetDays: 60,
        basis: "s.8 Civil Law Act 1956; Probate & Administration Act 1959",
        notes:
          "The s.8 estate claim is brought by the personal representative — extract the grant of probate / letters of administration before filing.",
      },
    ],
  },
  {
    trigger: "public_authority",
    label: "Cause of action against a public authority",
    description:
      "Claim against the Government or a public authority (e.g. a local council or a government vehicle). Shortened limitation applies.",
    rules: [
      {
        title: "Limitation against public authority expires",
        category: "limitation",
        offsetDays: 36 * 30,
        basis: "s.2 Public Authorities Protection Act 1948",
        notes:
          "Proceedings against a public authority for an act done in execution of a public duty must be commenced within 36 months of the act, neglect or default. Verify the defendant's status and give any statutory notice required.",
      },
    ],
  },
  {
    trigger: "writ_served",
    label: "Writ / summons served on defendant",
    description:
      "Service of the writ and statement of claim. Drives appearance and pleadings under the Rules of Court 2012.",
    rules: [
      {
        title: "Defendant to enter appearance",
        category: "pleading",
        offsetDays: 14,
        basis: "O.12 r.4 Rules of Court 2012",
        notes:
          "Time for entering appearance runs from service (14 days within jurisdiction is the ordinary period) — verify against the sealed writ and any endorsement.",
      },
      {
        title: "Defence to be filed",
        category: "pleading",
        offsetDays: 28,
        basis: "O.18 r.2 Rules of Court 2012",
        notes:
          "A defence is ordinarily served within 14 days after the time limited for appearance; confirm the running of time and any extension agreed or ordered.",
      },
    ],
  },
  {
    trigger: "judgment",
    label: "Judgment delivered",
    description:
      "Judgment or order of the court. Drives the appeal period and enforcement steps.",
    rules: [
      {
        title: "File notice of appeal",
        category: "appeal",
        offsetDays: 30,
        basis: "r.15 Rules of the Court of Appeal 1994 / O.55 ROC 2012",
        notes:
          "A notice of appeal is ordinarily filed within 30 days from the date of the decision appealed against. Verify the exact period and whether time runs from the sealed order or grounds of judgment.",
      },
      {
        title: "Enforce judgment (execution)",
        category: "enforcement",
        offsetDays: 14,
        basis: "O.45–O.47 Rules of Court 2012",
        notes:
          "Consider writ of seizure and sale, garnishee or bankruptcy/winding-up once the judgment is final and any stay has lapsed.",
      },
    ],
  },
];

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d.getTime());
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

/** Roll a Saturday/Sunday due date forward to Monday (registry closed). */
function rollForwardOffWeekend(d: Date): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDay();
  if (day === 6) r.setUTCDate(r.getUTCDate() + 2);
  else if (day === 0) r.setUTCDate(r.getUTCDate() + 1);
  return r;
}

/**
 * Compute the standard deadlines flowing from a trigger event on a given date.
 * Returns an empty array for an unknown trigger.
 */
export function computeAccDeadlines(
  trigger: string,
  triggerDateIso: string,
): ComputedAccDeadline[] {
  const template = ACC_DEADLINE_TRIGGERS.find((t) => t.trigger === trigger);
  if (!template) return [];
  const base = new Date(triggerDateIso);
  if (Number.isNaN(base.getTime())) return [];

  return template.rules.map((rule) => {
    let due = base;
    if (rule.offsetYears) due = addYears(due, rule.offsetYears);
    if (rule.offsetDays) due = addDays(due, rule.offsetDays);
    // Procedural day-based periods roll off a weekend; substantive limitation
    // horizons are statutory dates and are NOT rolled.
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
