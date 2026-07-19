export type StudioTaxonomyKind = "bloom" | "miller" | "solo" | "dok";

export interface StudioTaxonomyLevel {
  level: number;
  name: string;
  summary: string;
  verbs: string[];
}

export interface StudioTaxonomyDefinition {
  kind: StudioTaxonomyKind;
  title: string;
  subtitle: string;
  description: string;
  levels: StudioTaxonomyLevel[];
}

export const STUDIO_TAXONOMIES: StudioTaxonomyDefinition[] = [
  {
    kind: "bloom",
    title: "Bloom's Revised Taxonomy",
    subtitle: "Anderson & Krathwohl, 2001",
    description:
      "A six-tier hierarchy of cognitive processes used to classify learning objectives. Lower tiers describe recall and comprehension; upper tiers describe critical thinking and creation. Use it to balance an assessment between knowing facts and doing something with them.",
    levels: [
      {
        level: 1,
        name: "Remember",
        summary: "Retrieve relevant knowledge from long-term memory.",
        verbs: ["define", "list", "recall", "identify", "name", "state"],
      },
      {
        level: 2,
        name: "Understand",
        summary:
          "Determine the meaning of instructional messages, including oral, written, and graphic.",
        verbs: ["explain", "summarize", "paraphrase", "classify", "compare", "interpret"],
      },
      {
        level: 3,
        name: "Apply",
        summary: "Carry out or use a procedure in a given situation.",
        verbs: ["execute", "implement", "solve", "use", "demonstrate", "operate"],
      },
      {
        level: 4,
        name: "Analyze",
        summary:
          "Break material into constituent parts, detecting how the parts relate to each other and to an overall structure.",
        verbs: ["differentiate", "organize", "attribute", "compare", "deconstruct", "outline"],
      },
      {
        level: 5,
        name: "Evaluate",
        summary: "Make judgments based on criteria and standards.",
        verbs: ["check", "critique", "judge", "defend", "appraise", "argue"],
      },
      {
        level: 6,
        name: "Create",
        summary: "Put elements together to form a novel, coherent whole or original product.",
        verbs: ["design", "construct", "produce", "invent", "compose", "plan"],
      },
    ],
  },
  {
    kind: "miller",
    title: "Miller's Pyramid of Clinical Competence",
    subtitle: "Miller, 1990",
    description:
      "Originally formulated for clinical training, Miller's Pyramid maps assessment from knowledge to authentic professional performance. It is the gold standard for any competency-based programme that needs to verify a learner can actually do the job.",
    levels: [
      {
        level: 1,
        name: "Knows",
        summary: "Recalls facts, principles, and theories underlying competent practice.",
        verbs: ["recall", "list", "identify", "describe"],
      },
      {
        level: 2,
        name: "Knows How",
        summary:
          "Applies knowledge — interprets data, devises a plan, troubleshoots a scenario.",
        verbs: ["interpret", "plan", "select", "diagnose"],
      },
      {
        level: 3,
        name: "Shows How",
        summary:
          "Demonstrates the competency in a simulated or controlled setting (OSCE, role-play).",
        verbs: ["perform", "demonstrate", "execute", "model"],
      },
      {
        level: 4,
        name: "Does",
        summary:
          "Performs the competency unassisted in authentic professional practice.",
        verbs: ["practise", "deliver", "operate", "lead"],
      },
    ],
  },
  {
    kind: "solo",
    title: "SOLO Taxonomy",
    subtitle: "Biggs & Collis, 1982 — Structure of Observed Learning Outcomes",
    description:
      "SOLO classifies a learner's response by the structural complexity of the answer rather than by topic. It is invaluable for marking open-ended responses because it gives marker and learner a shared, descriptive vocabulary for depth.",
    levels: [
      {
        level: 1,
        name: "Prestructural",
        summary: "Misses the point — answer is irrelevant or simply incorrect.",
        verbs: ["misses", "ignores"],
      },
      {
        level: 2,
        name: "Unistructural",
        summary: "Identifies one relevant aspect.",
        verbs: ["identify", "name", "follow simple procedure"],
      },
      {
        level: 3,
        name: "Multistructural",
        summary: "Identifies several relevant aspects but treats them independently.",
        verbs: ["describe", "list", "enumerate"],
      },
      {
        level: 4,
        name: "Relational",
        summary:
          "Integrates the parts into a coherent whole — explains how aspects relate.",
        verbs: ["compare", "contrast", "explain causes", "analyse"],
      },
      {
        level: 5,
        name: "Extended Abstract",
        summary:
          "Generalises the integrated whole to new domains, hypothesises, theorises.",
        verbs: ["generalise", "hypothesise", "theorise", "reflect"],
      },
    ],
  },
  {
    kind: "dok",
    title: "Webb's Depth of Knowledge",
    subtitle: "Norman Webb, 1997",
    description:
      "DOK measures the depth of cognitive engagement an item demands — not difficulty, but how much the learner must do with the content. Widely used in K-12 standards alignment and increasingly in higher-ed competency mapping.",
    levels: [
      {
        level: 1,
        name: "Recall & Reproduction",
        summary: "Recall a fact, term, principle, or perform a simple procedure.",
        verbs: ["define", "identify", "calculate", "recognize"],
      },
      {
        level: 2,
        name: "Skills & Concepts",
        summary:
          "Use information or conceptual knowledge — two or more steps required.",
        verbs: ["classify", "organize", "estimate", "compare"],
      },
      {
        level: 3,
        name: "Strategic Thinking",
        summary:
          "Reasoning, planning, and using evidence; abstract or complex thinking.",
        verbs: ["justify", "critique", "formulate", "investigate"],
      },
      {
        level: 4,
        name: "Extended Thinking",
        summary:
          "Investigation, complex reasoning over time, transfer to novel situations.",
        verbs: ["design", "synthesize", "prove", "analyze across sources"],
      },
    ],
  },
];

export function getTaxonomy(kind: StudioTaxonomyKind): StudioTaxonomyDefinition {
  const t = STUDIO_TAXONOMIES.find((x) => x.kind === kind);
  if (!t) throw new Error(`Unknown taxonomy: ${kind}`);
  return t;
}
