import {
  db,
  researchSourceContainers,
  researchTransformations,
  researchReviewItems,
  type ResearchSourceContainer,
  type InsertResearchSourceContainer,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";

// Repository for research source containers. Routes never touch the database
// directly — they go through this layer, where rights gating and audit
// logging are enforced.

/**
 * Register a source container. Rights status always starts UNREVIEWED (the
 * insert schema forbids supplying it) and the registration itself is recorded
 * as a transformation for provenance.
 */
export async function registerContainer(
  values: InsertResearchSourceContainer,
): Promise<ResearchSourceContainer> {
  return db.transaction(async (tx) => {
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
    return container!;
  });
}

export async function getContainer(
  id: number,
): Promise<ResearchSourceContainer | undefined> {
  const [row] = await db
    .select()
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, id));
  return row;
}

export async function listContainers(
  limit = 50,
): Promise<ResearchSourceContainer[]> {
  return db
    .select()
    .from(researchSourceContainers)
    .orderBy(desc(researchSourceContainers.id))
    .limit(limit);
}

/** Route a container to human review — uncertainty is preserved, not guessed. */
export async function routeToReview(
  containerId: number,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(researchReviewItems).values({ containerId, reason });
    await tx
      .update(researchSourceContainers)
      .set({ processingState: "NEEDS_REVIEW", updatedAt: new Date() })
      .where(eq(researchSourceContainers.id, containerId));
  });
}
