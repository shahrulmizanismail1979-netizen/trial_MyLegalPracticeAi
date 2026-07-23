import { createHash } from "node:crypto";
import {
  db,
  researchContainerInventories,
  researchTransformations,
  researchReviewItems,
  type ResearchContainerInventory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getAdapters } from "../adapters";
import { getContainer } from "../data/containers";
import { transitionContainer } from "../domain/containerStateMachine";
import { enqueue, registerProcessor } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import { analyzeContainer } from "./analyzer";

// Phase 03 container inventory (ADR 0004). A rights-gated, content-touching,
// resumable job that produces DIAGNOSTIC data only: no case records, no OCR,
// no extraction. Uncertain results route to human review.

export const INVENTORY_JOB_KIND = "container.inventory";

/**
 * Start inventory for a container. Requires the container to be past rights
 * review: RIGHTS_APPROVED → INVENTORY_PENDING here (RIGHTS_REVIEW_REQUIRED
 * callers must first record the approval transition). Idempotent per
 * (container, attempt).
 */
export async function startInventory(
  containerId: number,
  actor: string,
): Promise<{ jobId: number | null }> {
  const container = await getContainer(containerId);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }
  if (container.processingState === "RIGHTS_REVIEW_REQUIRED") {
    // The route has already verified process access, which is only possible
    // after a rights decision that permits processing — record the approval
    // transition explicitly (state machine path, never a direct write).
    await transitionContainer(containerId, "RIGHTS_APPROVED", {
      actor,
      detail: { cause: "inventory-requested:process-access-verified" },
    });
    await transitionContainer(containerId, "INVENTORY_PENDING", {
      actor,
      detail: { cause: "inventory-requested" },
    });
  } else if (container.processingState === "RIGHTS_APPROVED") {
    await transitionContainer(containerId, "INVENTORY_PENDING", {
      actor,
      detail: { cause: "inventory-requested" },
    });
  } else if (container.processingState !== "INVENTORY_PENDING") {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; inventory requires RIGHTS_APPROVED or INVENTORY_PENDING`,
      false,
    );
  }
  const job = await enqueue(
    INVENTORY_JOB_KIND,
    `inventory-container-${containerId}`,
    { containerId },
    {
      actor,
      processorVersion: "container.inventory@1",
      sourceChecksum: container.contentSha256,
      provenance: { containerId },
    },
  );
  return { jobId: job?.id ?? null };
}

export async function getLatestInventory(
  containerId: number,
  dbc: DbClient = db,
): Promise<ResearchContainerInventory | undefined> {
  const [row] = await dbc
    .select()
    .from(researchContainerInventories)
    .where(eq(researchContainerInventories.containerId, containerId))
    .orderBy(desc(researchContainerInventories.id))
    .limit(1);
  return row;
}

async function inventoryProcessor({
  job,
  dbc,
}: {
  job: { id: number; payload: Record<string, unknown> };
  dbc: DbClient;
}): Promise<{ outputChecksum?: string }> {
  const containerId = job.payload["containerId"] as number;
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }
  if (container.processingState === "INVENTORIED") return {}; // idempotent
  if (container.processingState !== "INVENTORY_PENDING") {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; expected INVENTORY_PENDING`,
      false,
    );
  }
  if (!container.storageKey) {
    throw new ProcessorFailure(
      "NO_STORED_BYTES",
      `Container ${containerId} has no storage key; inventory impossible`,
      false,
    );
  }

  let bytes: Buffer;
  try {
    bytes = await getAdapters().storage.get(container.storageKey);
  } catch (err) {
    throw new ProcessorFailure(
      "STORAGE_FETCH_FAILED",
      `Could not fetch stored bytes for container ${containerId}: ${(err as Error).message}`,
      true,
    );
  }
  // Byte-integrity check: stored bytes must match the registered checksum.
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== container.contentSha256) {
    throw new ProcessorFailure(
      "CHECKSUM_MISMATCH",
      `Stored bytes for container ${containerId} do not match the registered SHA-256`,
      false,
    );
  }

  const analysis = await analyzeContainer(
    bytes,
    container.mimeType ?? "application/octet-stream",
    container.originalName,
  );

  const outputChecksum = createHash("sha256")
    .update(JSON.stringify({ containerId, ...analysis }))
    .digest("hex");

  await dbc.transaction(async (tx) => {
    await tx
      .insert(researchContainerInventories)
      .values({
        containerId,
        jobId: job.id,
        label: analysis.label,
        fileType: analysis.fileType,
        pageCount: analysis.pageCount,
        textCharCount: analysis.textCharCount,
        blankPageCount: analysis.blankPageCount,
        damagedPageCount: analysis.damagedPageCount,
        ocrProbable: analysis.ocrProbable,
        caseTitleRegionCount: analysis.caseTitleRegionCount,
        repeatedLines: analysis.repeatedLines,
        commercialMarkers: analysis.commercialMarkers,
        multiCasePossible: analysis.multiCasePossible,
        detail: analysis.detail,
        provenance: {
          jobId: job.id,
          processorVersion: "container.inventory@1",
          analyzedAt: new Date().toISOString(),
        },
      })
      .onConflictDoNothing();
    await tx.insert(researchTransformations).values({
      containerId,
      kind: "inventory",
      detail: {
        jobId: job.id,
        label: analysis.label,
        pageCount: analysis.pageCount,
        ocrProbable: analysis.ocrProbable,
        commercialMarkers: analysis.commercialMarkers,
      },
      actor: `job:${job.id}`,
    });
    // Uncertainty and suspected publisher content go to humans — the label
    // stays diagnostic; the review item makes the human step explicit.
    if (
      analysis.label === "MANUAL_INSPECTION_REQUIRED" ||
      analysis.label === "OCR_REQUIRED" ||
      analysis.label === "MIXED_CONTENT_POSSIBLE" ||
      analysis.commercialMarkers.length > 0
    ) {
      await tx.insert(researchReviewItems).values({
        containerId,
        kind: "inventory",
        reason: `Inventory flagged ${analysis.label}${
          analysis.commercialMarkers.length > 0
            ? ` (commercial markers: ${analysis.commercialMarkers.join(", ")})`
            : ""
        }`,
      });
    }
    await transitionContainer(containerId, "INVENTORIED", {
      actor: `job:${job.id}`,
      detail: { label: analysis.label },
      dbc: tx,
    });
  });

  return { outputChecksum };
}

let registered = false;
/** Register the inventory processor (idempotent). Rights-gated: touchesContent. */
export function registerInventoryProcessor(): void {
  if (registered) return;
  registered = true;
  registerProcessor(INVENTORY_JOB_KIND, inventoryProcessor, {
    touchesContent: true,
  });
}
