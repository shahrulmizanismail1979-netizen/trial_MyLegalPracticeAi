import {
  db,
  researchSourceContainers,
  researchTransformations,
  researchReviewItems,
  type ResearchSourceContainer,
  type InsertResearchSourceContainer,
  type ContainerState,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { recordAuditEvent } from "../domain/audit";
import { transitionContainer } from "../domain/containerStateMachine";
import type { DbClient } from "../domain/types";

// Repository for research source containers. Routes never touch the database
// directly — they go through this layer, where rights gating and audit
// logging are enforced. State changes go through the container state machine.

/**
 * Register a source container. Rights status always starts UNREVIEWED and the
 * processing state always starts UPLOADED (the insert schema forbids
 * supplying either). Registration is recorded as a transformation and an
 * audit event, atomically with the insert.
 */
export async function registerContainer(
  values: InsertResearchSourceContainer,
  dbc: DbClient = db,
): Promise<ResearchSourceContainer> {
  return dbc.transaction(async (tx) => {
    const [container] = await tx
      .insert(researchSourceContainers)
      .values(values)
      .returning();
    await tx.insert(researchTransformations).values({
      containerId: container!.id,
      kind: "registration",
      detail: {
        originalName: container!.originalName,
        sourceBatch: container!.sourceBatch,
        contentSha256: container!.contentSha256,
      },
      actor: "system",
    });
    await recordAuditEvent(tx, {
      entityType: "container",
      entityId: container!.id,
      event: "registered",
      fromState: null,
      toState: container!.processingState,
      detail: { sourceBatch: container!.sourceBatch },
    });
    return container!;
  });
}

export async function getContainer(
  id: number,
  dbc: DbClient = db,
): Promise<ResearchSourceContainer | undefined> {
  const [row] = await dbc
    .select()
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, id));
  return row;
}

export async function listContainers(
  limit = 50,
  dbc: DbClient = db,
): Promise<ResearchSourceContainer[]> {
  return dbc
    .select()
    .from(researchSourceContainers)
    .orderBy(desc(researchSourceContainers.id))
    .limit(limit);
}

// Review routing may only target an explicit *_REVIEW_REQUIRED state.
const REVIEW_STATES = [
  "RIGHTS_REVIEW_REQUIRED",
  "OCR_REVIEW_REQUIRED",
  "SEGMENTATION_REVIEW_REQUIRED",
  "EDITORIAL_REVIEW_REQUIRED",
] as const satisfies readonly ContainerState[];
export type ReviewState = (typeof REVIEW_STATES)[number];

/** Route a container to human review — uncertainty is preserved, not guessed. */
export async function routeToReview(
  containerId: number,
  reason: string,
  opts: {
    toState?: ReviewState;
    kind?: string;
    actor?: string;
    dbc?: DbClient;
  } = {},
): Promise<void> {
  const toState = opts.toState ?? "RIGHTS_REVIEW_REQUIRED";
  if (!REVIEW_STATES.includes(toState)) {
    throw new Error(
      `routeToReview target must be a review state, got ${toState}`,
    );
  }
  const dbc = opts.dbc ?? db;
  await dbc.transaction(async (tx) => {
    await tx.insert(researchReviewItems).values({
      containerId,
      reason,
      kind: opts.kind ?? "general",
    });
    await transitionContainer(containerId, toState, {
      actor: opts.actor,
      detail: { reason, reviewKind: opts.kind ?? "general" },
      dbc: tx,
    });
  });
}
