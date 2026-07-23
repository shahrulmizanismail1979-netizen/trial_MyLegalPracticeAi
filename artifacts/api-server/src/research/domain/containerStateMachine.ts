import {
  db,
  researchSourceContainers,
  CONTAINER_STATES,
  type ContainerState,
  type ResearchSourceContainer,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { recordAuditEvent } from "./audit";
import {
  StateTransitionError,
  EntityNotFoundError,
  type DbClient,
} from "./types";

// Container state machine (Phase 01). All 20 states from the specification;
// every state change goes through transitionContainer() — never write
// processing_state directly. Invalid transitions throw StateTransitionError.

// Explicit pipeline / review transitions.
const EXPLICIT: Record<ContainerState, ContainerState[]> = {
  UPLOADED: ["RIGHTS_REVIEW_REQUIRED"],
  QUARANTINED: ["RIGHTS_REVIEW_REQUIRED"],
  RIGHTS_REVIEW_REQUIRED: ["RIGHTS_APPROVED"],
  RIGHTS_APPROVED: ["INVENTORY_PENDING"],
  INVENTORY_PENDING: ["INVENTORIED"],
  INVENTORIED: ["EXTRACTION_PENDING"],
  EXTRACTION_PENDING: ["TEXT_EXTRACTED", "OCR_REVIEW_REQUIRED"],
  OCR_REVIEW_REQUIRED: ["EXTRACTION_PENDING", "TEXT_EXTRACTED"],
  TEXT_EXTRACTED: ["SEGMENTATION_PENDING"],
  SEGMENTATION_PENDING: ["SEGMENTATION_PROPOSED"],
  SEGMENTATION_PROPOSED: [
    "SEGMENTATION_REVIEW_REQUIRED",
    "EDITORIAL_REVIEW_PENDING",
  ],
  SEGMENTATION_REVIEW_REQUIRED: [
    "SEGMENTATION_PENDING",
    "EDITORIAL_REVIEW_PENDING",
  ],
  EDITORIAL_REVIEW_PENDING: [
    "EDITORIAL_REVIEW_REQUIRED",
    "JUDGMENT_VERIFICATION_PENDING",
  ],
  EDITORIAL_REVIEW_REQUIRED: [
    "EDITORIAL_REVIEW_PENDING",
    "JUDGMENT_VERIFICATION_PENDING",
  ],
  JUDGMENT_VERIFICATION_PENDING: ["VERIFIED"],
  VERIFIED: ["SEARCHABLE"],
  SEARCHABLE: [],
  // Blocked containers resume at an explicit safe re-entry point.
  PROCESSING_BLOCKED: [
    "RIGHTS_REVIEW_REQUIRED",
    "INVENTORY_PENDING",
    "EXTRACTION_PENDING",
    "SEGMENTATION_PENDING",
    "EDITORIAL_REVIEW_PENDING",
    "JUDGMENT_VERIFICATION_PENDING",
  ],
  DELETION_PENDING: ["DELETED"],
  DELETED: [], // terminal
};

// Safety states reachable from any live state: quarantine (rights/integrity
// problem), processing block (operational halt), deletion request.
const GLOBAL_TARGETS: ContainerState[] = [
  "QUARANTINED",
  "PROCESSING_BLOCKED",
  "DELETION_PENDING",
];

export const CONTAINER_TRANSITIONS: Readonly<
  Record<ContainerState, readonly ContainerState[]>
> = Object.fromEntries(
  CONTAINER_STATES.map((from) => {
    if (from === "DELETED") return [from, []];
    const targets = new Set<ContainerState>(EXPLICIT[from]);
    if (from !== "DELETION_PENDING") {
      for (const g of GLOBAL_TARGETS) if (g !== from) targets.add(g);
    }
    return [from, [...targets]];
  }),
) as unknown as Record<ContainerState, readonly ContainerState[]>;

export function canTransitionContainer(
  from: ContainerState,
  to: ContainerState,
): boolean {
  return CONTAINER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The single guarded transition function. Locks the container row, validates
 * the transition against the allowed map, applies it, and writes the audit
 * event — all in one transaction.
 */
export async function transitionContainer(
  containerId: number,
  to: ContainerState,
  opts: {
    actor?: string;
    detail?: Record<string, unknown>;
    dbc?: DbClient;
  } = {},
): Promise<ResearchSourceContainer> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT id, processing_state FROM research_source_containers
      WHERE id = ${containerId} FOR UPDATE
    `);
    const row = locked.rows[0] as
      | { id: number; processing_state: ContainerState }
      | undefined;
    if (!row) throw new EntityNotFoundError("container", containerId);
    const from = row.processing_state;
    if (!canTransitionContainer(from, to)) {
      throw new StateTransitionError("container", containerId, from, to);
    }
    const [updated] = await tx
      .update(researchSourceContainers)
      .set({ processingState: to, updatedAt: new Date() })
      .where(sql`${researchSourceContainers.id} = ${containerId}`)
      .returning();
    await recordAuditEvent(tx, {
      entityType: "container",
      entityId: containerId,
      event: "state-transition",
      fromState: from,
      toState: to,
      actor: opts.actor,
      detail: opts.detail,
    });
    return updated!;
  });
}
