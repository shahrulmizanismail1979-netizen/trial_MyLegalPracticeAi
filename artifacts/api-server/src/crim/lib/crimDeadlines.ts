/**
 * Criminal-procedure deadline templates for MyCrimAI matter files. Given a
 * trigger event (arrest, charge, conviction, High Court decision, bail
 * refused) and its date, we compute the standard downstream dates a criminal
 * practitioner must diarise — CPC, Federal Constitution and Courts of
 * Judicature Act periods rather than the civil ROC 2012 triggers used in
 * MyLitAI.
 *
 * IMPORTANT (practitioner caveat): these are the ordinary statutory periods.
 * Courts may abridge or extend time, and some periods run from service of
 * records rather than the decision itself. Always verify against the sealed
 * orders and the current practice directions before relying on a date.
 */

export type CrimDeadlineCategory =
  | "remand"
  | "charge"
  | "bail"
  | "trial"
  | "appeal"
  | "revision"
  | "custom";

export interface ComputedCrimDeadline {
  title: string;
  category: CrimDeadlineCategory;
  dueDate: string; // ISO date
  basis: string;
  notes?: string;
}

interface TemplateRule {
  title: string;
  category: CrimDeadlineCategory;
  offsetDays: number;
  basis: string;
  notes?: string;
}

export interface CrimTriggerTemplate {
  trigger: string;
  label: string;
  description: string;
  rules: TemplateRule[];
}

export const CRIM_DEADLINE_TRIGGERS: CrimTriggerTemplate[] = [
  {
    trigger: "arrest",
    label: "Client arrested",
    description:
      "Arrest of the client. Production before a Magistrate, remand horizons and early bail strategy dates.",
    rules: [
      {
        title: "Production before Magistrate (24 hours)",
        category: "remand",
        offsetDays: 1,
        basis: "Art. 5(4) Federal Constitution; s.28 CPC",
        notes:
          "The arrested person must be produced before a Magistrate within 24 hours of arrest (excluding journey time).",
      },
      {
        title: "First remand horizon — oppose extension (offence < 14y)",
        category: "remand",
        offsetDays: 4,
        basis: "s.117(2)(a) CPC",
        notes:
          "For offences punishable with under 14 years, first remand may not exceed 4 days. Prepare to oppose any extension.",
      },
      {
        title: "Second remand horizon — maximum aggregate (offence < 14y)",
        category: "remand",
        offsetDays: 7,
        basis: "s.117(2)(a) CPC",
        notes: "Aggregate remand may not exceed 7 days for offences punishable with under 14 years (14 days where 14 years or more / death).",
      },
      {
        title: "Prepare bail application",
        category: "bail",
        offsetDays: 3,
        basis: "ss.387–388 CPC",
        notes: "Have the bail papers (and proposed bailors) ready before the charge or remand extension hearing.",
      },
    ],
  },
  {
    trigger: "charge",
    label: "Client charged / first mention",
    description:
      "The client is charged in court. Document delivery under s.51A CPC, representation to the AG and pre-trial case management dates.",
    rules: [
      {
        title: "Follow up s.51A CPC documents from prosecution",
        category: "charge",
        offsetDays: 14,
        basis: "s.51A CPC",
        notes:
          "The prosecution must deliver the FIR, exhibit documents and statements of facts favourable to the defence before trial commences. Chase early.",
      },
      {
        title: "Consider representation letter to the AG / DPP",
        category: "charge",
        offsetDays: 21,
        basis: "Practice — representation under s.254 CPC discretion",
        notes: "A representation for reduction or withdrawal of the charge is most effective well before trial dates are fixed.",
      },
      {
        title: "Pre-trial conference (if represented)",
        category: "trial",
        offsetDays: 30,
        basis: "s.172A CPC",
        notes: "Pre-trial conference is to be held within 30 days of the accused being charged where the accused is represented.",
      },
      {
        title: "Case management by court",
        category: "trial",
        offsetDays: 60,
        basis: "s.172B CPC",
        notes: "Case management is to be held within 60 days of the accused being charged.",
      },
    ],
  },
  {
    trigger: "conviction_subordinate",
    label: "Conviction / sentence in Magistrates' or Sessions Court",
    description:
      "Decision of a subordinate court. Appeal to the High Court and stay of execution dates.",
    rules: [
      {
        title: "File Notice of Appeal to the High Court",
        category: "appeal",
        offsetDays: 14,
        basis: "s.307(1) CPC",
        notes: "Notice of appeal must be lodged with the clerk of the subordinate court within 14 days of the decision.",
      },
      {
        title: "Apply for stay of execution / bail pending appeal",
        category: "appeal",
        offsetDays: 7,
        basis: "s.311 CPC (stay); s.315 CPC (bail pending appeal)",
        notes: "An appeal does not operate as an automatic stay — apply promptly.",
      },
      {
        title: "Diarise: Petition of Appeal — 10 days after grounds/record served",
        category: "appeal",
        offsetDays: 30,
        basis: "s.307(3) CPC",
        notes:
          "The petition of appeal is due within 10 days of service of the grounds of judgment and appeal record — the actual date runs from service; this entry is a reminder to watch for it.",
      },
    ],
  },
  {
    trigger: "decision_high_court",
    label: "Decision of the High Court",
    description:
      "Decision of the High Court (original or appellate jurisdiction). Onward appeal to the Court of Appeal.",
    rules: [
      {
        title: "File Notice of Appeal to the Court of Appeal",
        category: "appeal",
        offsetDays: 14,
        basis: "s.51 Courts of Judicature Act 1964; r.18 Rules of the Court of Appeal 1994",
        notes: "Notice of appeal within 14 days of the decision appealed against.",
      },
      {
        title: "Apply for stay / bail pending appeal",
        category: "appeal",
        offsetDays: 7,
        basis: "s.57 Courts of Judicature Act 1964",
      },
    ],
  },
  {
    trigger: "bail_refused",
    label: "Bail refused",
    description: "Bail refused by the subordinate court — review options in the High Court.",
    rules: [
      {
        title: "Apply to the High Court for bail",
        category: "bail",
        offsetDays: 7,
        basis: "s.389 CPC",
        notes: "The High Court may grant bail notwithstanding refusal below. Move quickly while circumstances are fresh.",
      },
      {
        title: "Consider revision of remand/bail order",
        category: "revision",
        offsetDays: 14,
        basis: "ss.323–325 CPC",
      },
    ],
  },
];

/** Roll a date forward off Saturday/Sunday. */
function rollForward(d: Date): Date {
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

export function computeCrimDeadlines(
  trigger: string,
  triggerDateIso: string,
): ComputedCrimDeadline[] {
  const template = CRIM_DEADLINE_TRIGGERS.find((t) => t.trigger === trigger);
  if (!template) return [];
  const base = new Date(triggerDateIso);
  if (Number.isNaN(base.getTime())) return [];
  return template.rules.map((rule) => {
    const d = new Date(base);
    d.setDate(d.getDate() + rule.offsetDays);
    rollForward(d);
    return {
      title: rule.title,
      category: rule.category,
      dueDate: d.toISOString(),
      basis: rule.basis,
      notes: rule.notes,
    };
  });
}
