import type { TFunc, Lang } from "@/lib/i18n";

/**
 * Guided task-drafting rubric.
 *
 * Staff compose a task by picking, from dropdowns, the position level the work
 * is pitched at, an action verb and a quality standard appropriate to that
 * level, plus the nature of work, business unit and deliverable. From those
 * structured choices we assemble a uniform house-style title and description.
 *
 * Every option is a stable canonical KEY; the human label is resolved through
 * i18n (`rubric.*` keys) so the whole rubric is bilingual. The canonical keys
 * are what we persist on the task, so a stored task can be re-localised later.
 */

export const POSITION_LEVELS = [
  "executive_chairman",
  "management",
  "brand_leader",
  "liaison_officer",
  "game_developer",
  "board_of_studies",
] as const;
export type PositionLevel = (typeof POSITION_LEVELS)[number];

/** Action verbs available for each position level. */
export const VERBS_BY_LEVEL: Record<PositionLevel, string[]> = {
  executive_chairman: [
    "approve",
    "authorise",
    "endorse",
    "set_direction",
    "champion",
    "ratify",
  ],
  management: [
    "oversee",
    "allocate",
    "review",
    "strategise",
    "coordinate",
    "budget",
    "approve",
  ],
  brand_leader: [
    "lead",
    "develop",
    "launch",
    "pitch",
    "negotiate",
    "forge",
    "drive",
    "curate",
  ],
  liaison_officer: [
    "coordinate",
    "liaise",
    "arrange",
    "schedule",
    "follow_up",
    "compile",
  ],
  game_developer: [
    "design",
    "prototype",
    "build",
    "playtest",
    "iterate",
    "document",
  ],
  board_of_studies: ["advise", "review", "validate", "accredit", "evaluate"],
};

/** Quality standards (adjectives) available for each position level. */
export const STANDARDS_BY_LEVEL: Record<PositionLevel, string[]> = {
  executive_chairman: ["strategic", "board_ready", "decisive", "visionary"],
  management: [
    "cost_effective",
    "compliant",
    "well_governed",
    "timely",
    "audit_ready",
  ],
  brand_leader: [
    "market_ready",
    "client_ready",
    "polished",
    "high_impact",
    "on_brand",
  ],
  liaison_officer: ["prompt", "well_coordinated", "accurate", "documented"],
  game_developer: ["playtested", "polished", "production_ready", "documented"],
  board_of_studies: [
    "rigorous",
    "accredited",
    "evidence_based",
    "quality_assured",
  ],
};

export const NATURE_OF_WORK = [
  "training_delivery",
  "curriculum_development",
  "instructional_design",
  "elearning_development",
  "game_based_learning",
  "board_game_dev",
  "certification",
  "assessment_evaluation",
  "fast_track_programme",
  "student_recruitment",
  "participant_support",
  "partnership_bd",
  "university_liaison",
  "grant_funding",
  "event_exhibition",
  "marketing_promotion",
  "content_media",
  "community_outreach",
  "quality_assurance",
  "research",
  "admin_compliance",
  "human_resource",
  "procurement",
  "finance",
  "legal",
] as const;

export const BUSINESS_UNITS = [
  "work_play_labs",
  "fast_track_uni",
  "training_exhibition",
  "corporate",
  "board_of_studies",
] as const;

export const DELIVERABLES = [
  "report",
  "proposal",
  "deck",
  "prototype",
  "module",
  "curriculum",
  "syllabus",
  "assessment",
  "certificate",
  "video",
  "agreement",
  "mou",
  "event",
  "other",
] as const;

export interface RubricSelection {
  positionLevel?: string | null;
  actionVerb?: string | null;
  qualityStandard?: string | null;
  natureOfWork?: string | null;
  businessUnit?: string | null;
  deliverable?: string | null;
}

const label = (t: TFunc, group: string, key: string | null | undefined) =>
  key ? t(`rubric.${group}.${key}`) : "";

/**
 * Assemble a uniform house-style title from the rubric selection. Returns an
 * empty string until at least an action verb plus a subject (deliverable or
 * nature of work) are chosen.
 */
export function assembleTitle(
  t: TFunc,
  lang: Lang,
  sel: RubricSelection,
): string {
  const verb = label(t, "verb", sel.actionVerb);
  if (!verb) return "";
  const unit = label(t, "unit", sel.businessUnit);
  const subject =
    sel.deliverable && sel.deliverable !== "other"
      ? label(t, "deliverable", sel.deliverable)
      : label(t, "nature", sel.natureOfWork);
  if (!subject) return "";

  // English reads verb → unit → subject; Malay reads verb → subject → unit.
  const ordered = lang === "ms" ? [subject, unit] : [unit, subject];
  let title = `${verb} ${ordered.filter(Boolean).join(" ")}`.trim();

  const standard = label(t, "standard", sel.qualityStandard);
  if (standard) {
    title = `${title} — ${t("rubric.standardSuffix", { standard })}`;
  }
  return title;
}

/**
 * Assemble a structured description block from the rubric selection plus any
 * collaborator names and free-text notes the author adds.
 */
export function assembleDescription(
  t: TFunc,
  sel: RubricSelection,
  memberNames: string[],
  notes: string,
): string {
  const lines: string[] = [];
  const push = (labelKey: string, value: string) => {
    if (value) lines.push(`${t(labelKey)}: ${value}`);
  };
  push("rubric.desc.nature", label(t, "nature", sel.natureOfWork));
  push("rubric.desc.unit", label(t, "unit", sel.businessUnit));
  push(
    "rubric.desc.deliverable",
    sel.deliverable && sel.deliverable !== "other"
      ? label(t, "deliverable", sel.deliverable)
      : "",
  );
  push("rubric.desc.standard", label(t, "standard", sel.qualityStandard));
  if (memberNames.length > 0) {
    push("rubric.desc.members", memberNames.join(", "));
  }
  const block = lines.join("\n");
  const trimmedNotes = notes.trim();
  if (block && trimmedNotes) return `${block}\n\n${trimmedNotes}`;
  return block || trimmedNotes;
}
