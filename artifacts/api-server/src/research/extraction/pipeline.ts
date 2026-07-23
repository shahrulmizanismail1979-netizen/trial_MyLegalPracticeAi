import { createHash } from "node:crypto";
import {
  db,
  researchExtractionRuns,
  researchPageExtractions,
  researchPageBlocks,
  researchPageWarnings,
  researchJobs,
  researchReviewItems,
  researchSourcePages,
  researchTransformations,
  type ResearchExtractionRun,
} from "@workspace/db";
import { and, desc, eq, like } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getAdapters } from "../adapters";
import type {
  ExtractedPage,
  LayoutWarning,
  OcrPageResult,
} from "../adapters";
import { getContainer } from "../data/containers";
import { transitionContainer } from "../domain/containerStateMachine";
import { enqueue, registerProcessor } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import type { DbClient } from "../domain/types";

// Phase 04 extraction pipeline (ADR 0005). A rights-gated, content-touching,
// resumable job: per-page mode detection (native text layer vs OCR), page
// image storage for every OCR'd page, structured warnings for all
// uncertainty, and review routing instead of guessing.

export const EXTRACT_JOB_KIND = "container.extract";
export const EXTRACT_PROCESSOR_VERSION = "container.extract@1";

/** Mean OCR confidence below this routes the page/container to review. */
export const OCR_REVIEW_CONFIDENCE_THRESHOLD = 70;
/** Individual words below this confidence are flagged as illegible regions. */
export const WORD_ILLEGIBLE_CONFIDENCE = 40;
/** OSD orientation confidence below this is treated as uncertain. */
export const ROTATION_CONFIDENCE_THRESHOLD = 2;
/** A page accumulating this many structured warnings routes to review. */
export const PAGE_WARNINGS_REVIEW_THRESHOLD = 2;

/**
 * Start extraction for a container in EXTRACTION_PENDING (or move an
 * INVENTORIED container forward). Idempotent per (container, source sha).
 */
export async function startExtraction(
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
  if (
    container.processingState !== "INVENTORIED" &&
    container.processingState !== "EXTRACTION_PENDING" &&
    container.processingState !== "OCR_REVIEW_REQUIRED"
  ) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; extraction requires INVENTORIED, EXTRACTION_PENDING, or OCR_REVIEW_REQUIRED`,
      false,
    );
  }

  // Rerun-safe idempotency: the key includes the count of finished extraction
  // attempts, so a rerun after review resolution enqueues a NEW job, while
  // duplicate start requests for the same attempt still deduplicate (the
  // attempt count is unchanged while a job is QUEUED or RUNNING).
  const keyPrefix = `extract-container-${containerId}-${container.contentSha256.slice(0, 16)}`;
  const priorJobs = await db
    .select({ state: researchJobs.state })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.kind, EXTRACT_JOB_KIND),
        like(researchJobs.idempotencyKey, `${keyPrefix}%`),
      ),
    );
  const finishedAttempts = priorJobs.filter(
    (j) => j.state !== "QUEUED" && j.state !== "RUNNING",
  ).length;
  const job = await enqueue(
    EXTRACT_JOB_KIND,
    finishedAttempts === 0 ? keyPrefix : `${keyPrefix}-a${finishedAttempts}`,
    { containerId },
    {
      actor,
      processorVersion: EXTRACT_PROCESSOR_VERSION,
      sourceChecksum: container.contentSha256,
      provenance: { containerId },
    },
  );

  // Only advance the state machine when a job was actually enqueued —
  // otherwise a deduplicated request could strand the container in
  // EXTRACTION_PENDING with no job to move it forward.
  if (job && container.processingState === "INVENTORIED") {
    await transitionContainer(containerId, "EXTRACTION_PENDING", {
      actor,
      detail: { cause: "extraction-requested" },
    });
  } else if (job && container.processingState === "OCR_REVIEW_REQUIRED") {
    // Re-run after review resolution re-enters through the state machine.
    await transitionContainer(containerId, "EXTRACTION_PENDING", {
      actor,
      detail: { cause: "extraction-rerun-after-review" },
    });
  }
  return { jobId: job?.id ?? null };
}

export async function getLatestExtractionRun(
  containerId: number,
  dbc: DbClient = db,
): Promise<ResearchExtractionRun | undefined> {
  const [row] = await dbc
    .select()
    .from(researchExtractionRuns)
    .where(eq(researchExtractionRuns.containerId, containerId))
    .orderBy(desc(researchExtractionRuns.id))
    .limit(1);
  return row;
}

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

interface PagePlan {
  pageNumber: number;
  mode: "NATIVE" | "OCR";
  native?: ExtractedPage;
}

async function extractProcessor(ctx: ProcessorContext) {
  const { job, dbc } = ctx;
  const containerId = job.payload["containerId"] as number;
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }
  if (
    container.processingState === "TEXT_EXTRACTED" ||
    container.processingState === "OCR_REVIEW_REQUIRED"
  ) {
    return {}; // idempotent re-execution after completion
  }
  if (container.processingState !== "EXTRACTION_PENDING") {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; expected EXTRACTION_PENDING`,
      false,
    );
  }
  if (!container.storageKey) {
    throw new ProcessorFailure(
      "NO_STORED_BYTES",
      `Container ${containerId} has no storage key; extraction impossible`,
      false,
    );
  }

  const adapters = getAdapters();
  let bytes: Buffer;
  try {
    bytes = await adapters.storage.get(container.storageKey);
  } catch (err) {
    throw new ProcessorFailure(
      "STORAGE_FETCH_FAILED",
      `Could not fetch stored bytes for container ${containerId}: ${(err as Error).message}`,
      true,
    );
  }
  const sourceSha = sha256(bytes);
  if (sourceSha !== container.contentSha256) {
    throw new ProcessorFailure(
      "CHECKSUM_MISMATCH",
      `Stored bytes for container ${containerId} do not match the registered SHA-256`,
      false,
    );
  }

  const mimeType = container.mimeType ?? "application/octet-stream";
  if (!adapters.nativeText.supports(mimeType)) {
    throw new ProcessorFailure(
      "UNSUPPORTED_TYPE",
      `No extraction adapter supports mime type '${mimeType}'`,
      false,
    );
  }

  // ── Resume/create the extraction run (idempotent per container+sha) ────
  const runKey = `extract-${sourceSha.slice(0, 16)}-${EXTRACT_PROCESSOR_VERSION}`;
  const adapterSet = {
    nativeText: {
      name: adapters.nativeText.name,
      version: adapters.nativeText.version,
    },
    pageRenderer: {
      name: adapters.pageRenderer.name,
      version: adapters.pageRenderer.version,
    },
    ocr: { name: adapters.ocr.name, version: adapters.ocr.version },
    layout: { name: adapters.layout.name, version: adapters.layout.version },
  };
  await dbc
    .insert(researchExtractionRuns)
    .values({
      containerId,
      jobId: job.id,
      runKey,
      processorVersion: EXTRACT_PROCESSOR_VERSION,
      adapters: adapterSet,
      sourceChecksum: sourceSha,
      status: "RUNNING",
    })
    .onConflictDoNothing();
  const [run] = await dbc
    .select()
    .from(researchExtractionRuns)
    .where(
      and(
        eq(researchExtractionRuns.containerId, containerId),
        eq(researchExtractionRuns.runKey, runKey),
      ),
    );
  if (!run) {
    throw new ProcessorFailure(
      "RUN_MISSING",
      `Extraction run for container ${containerId} could not be created`,
      true,
    );
  }

  // ── Per-page mode detection ─────────────────────────────────────────────
  let nativePages: ExtractedPage[];
  try {
    nativePages = await adapters.nativeText.extract(bytes, mimeType);
  } catch (err) {
    throw new ProcessorFailure(
      "NATIVE_EXTRACT_FAILED",
      `Native text extraction failed for container ${containerId}: ${(err as Error).message}`,
      true,
    );
  }
  const plans: PagePlan[] = nativePages.map((p) => ({
    pageNumber: p.pageNumber,
    mode: p.hasTextLayer ? "NATIVE" : "OCR",
    native: p,
  }));

  const needsOcr = plans.some((p) => p.mode === "OCR");
  const canRender = adapters.pageRenderer.supports(mimeType);
  const rendered = new Map<number, { png: Buffer; widthPx: number; heightPx: number; dpi: number }>();
  if (needsOcr && canRender && adapters.ocr.isEnabled()) {
    let images;
    try {
      images = await adapters.pageRenderer.render(bytes, mimeType);
    } catch (err) {
      throw new ProcessorFailure(
        "RENDER_FAILED",
        `Page rendering failed for container ${containerId}: ${(err as Error).message}`,
        true,
      );
    }
    for (const img of images) rendered.set(img.pageNumber, img);
  }

  let reviewReasons: string[] = [];
  let charCursor = 0;
  let pagesDone = 0;

  for (const plan of plans) {
    // Resumability: skip pages already extracted for this run.
    const [existingPageRow] = await dbc
      .select()
      .from(researchSourcePages)
      .where(
        and(
          eq(researchSourcePages.containerId, containerId),
          eq(researchSourcePages.pageNumber, plan.pageNumber),
        ),
      );
    let pageId = existingPageRow?.id;
    if (pageId === undefined) {
      const [inserted] = await dbc
        .insert(researchSourcePages)
        .values({
          containerId,
          pageNumber: plan.pageNumber,
          provenance: { createdBy: EXTRACT_PROCESSOR_VERSION, jobId: job.id },
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) pageId = inserted.id;
      else {
        const [again] = await dbc
          .select()
          .from(researchSourcePages)
          .where(
            and(
              eq(researchSourcePages.containerId, containerId),
              eq(researchSourcePages.pageNumber, plan.pageNumber),
            ),
          );
        pageId = again!.id;
      }
    }

    const [already] = await dbc
      .select()
      .from(researchPageExtractions)
      .where(
        and(
          eq(researchPageExtractions.runId, run.id),
          eq(researchPageExtractions.pageId, pageId!),
        ),
      );
    if (already) {
      charCursor = already.charEnd + 1;
      pagesDone += 1;
      continue;
    }

    const warnings: LayoutWarning[] = [];
    let pageText = "";
    let blocks: ReturnType<typeof adapters.layout.analyze>["blocks"] = [];
    let ocrResult: OcrPageResult | null = null;
    let imageStorageKey: string | null = null;
    let imageSha: string | null = null;

    if (plan.mode === "NATIVE") {
      const analysis = adapters.layout.analyze(plan.native!);
      pageText = analysis.pageText;
      blocks = analysis.blocks;
      warnings.push(...analysis.warnings);
    } else {
      // OCR path. A missing renderer or disabled OCR must never fake text.
      const img = rendered.get(plan.pageNumber);
      if (!img) {
        warnings.push({
          code: "POSSIBLE_MISSING_TEXT",
          coordinates: null,
          detail: {
            reason: adapters.ocr.isEnabled()
              ? "page image could not be rendered"
              : "OCR adapter disabled",
            pageNumber: plan.pageNumber,
          },
        });
        reviewReasons.push(
          `page ${plan.pageNumber}: OCR unavailable (${adapters.ocr.isEnabled() ? "render failed" : "adapter disabled"})`,
        );
      } else {
        imageSha = sha256(img.png);
        // storage.put returns the canonical storage key (adapters may
        // prefix it); always persist the returned key, never the input.
        imageStorageKey = await adapters.storage.put(
          `extractions/${containerId}/${run.id}/page-${plan.pageNumber}.png`,
          img.png,
          "image/png",
        );
        await ctx.recordArtifact({
          kind: "page-image",
          storageKey: imageStorageKey,
          contentSha256: imageSha,
          sizeBytes: img.png.length,
          containerId,
          provenance: { pageNumber: plan.pageNumber, runId: run.id, dpi: img.dpi },
        });
        try {
          ocrResult = await adapters.ocr.recognize(img.png);
        } catch (err) {
          warnings.push({
            code: "POSSIBLE_MISSING_TEXT",
            coordinates: null,
            detail: {
              reason: `OCR failed: ${(err as Error).message}`,
              pageNumber: plan.pageNumber,
            },
          });
          reviewReasons.push(`page ${plan.pageNumber}: OCR failed`);
        }
        if (ocrResult) {
          const ocrPage: ExtractedPage = {
            pageNumber: plan.pageNumber,
            hasTextLayer: false,
            words: ocrResult.words,
            width: img.widthPx,
            height: img.heightPx,
            unit: "px",
          };
          const analysis = adapters.layout.analyze(ocrPage);
          pageText = analysis.pageText;
          blocks = analysis.blocks;
          warnings.push(...analysis.warnings);

          if (ocrResult.meanConfidence < OCR_REVIEW_CONFIDENCE_THRESHOLD) {
            warnings.push({
              code: "LOW_OCR_CONFIDENCE",
              coordinates: null,
              detail: {
                meanConfidence: ocrResult.meanConfidence,
                threshold: OCR_REVIEW_CONFIDENCE_THRESHOLD,
              },
            });
            reviewReasons.push(
              `page ${plan.pageNumber}: mean OCR confidence ${Math.round(ocrResult.meanConfidence)} < ${OCR_REVIEW_CONFIDENCE_THRESHOLD}`,
            );
          }
          for (const w of ocrResult.words) {
            if ((w.confidence ?? 100) < WORD_ILLEGIBLE_CONFIDENCE) {
              warnings.push({
                code: "ILLEGIBLE_REGION",
                coordinates: w.bbox,
                detail: { text: w.text, confidence: w.confidence },
              });
            }
          }
          if (
            ocrResult.rotationDegrees !== null &&
            ocrResult.rotationDegrees !== 0 &&
            (ocrResult.rotationConfidence ?? 0) < ROTATION_CONFIDENCE_THRESHOLD
          ) {
            warnings.push({
              code: "PAGE_ROTATION_UNCERTAIN",
              coordinates: null,
              detail: {
                rotationDegrees: ocrResult.rotationDegrees,
                rotationConfidence: ocrResult.rotationConfidence,
              },
            });
          }
        }
      }
    }

    // Warning-driven review routing: pages that accumulate multiple
    // structured uncertainty warnings need human eyes even when the mean
    // OCR confidence looks fine (e.g. rotation + reading-order uncertainty).
    if (warnings.length >= PAGE_WARNINGS_REVIEW_THRESHOLD) {
      const codes = [...new Set(warnings.map((w) => w.code))].join(", ");
      reviewReasons.push(
        `page ${plan.pageNumber}: ${warnings.length} uncertainty warnings (${codes})`,
      );
    }

    const isBlank = pageText.trim().length === 0 && warnings.length === 0;
    const charStart = charCursor;
    const charEnd = charStart + pageText.length;
    charCursor = charEnd + 1;

    await dbc.transaction(async (tx) => {
      const [extraction] = await tx
        .insert(researchPageExtractions)
        .values({
          runId: run.id,
          pageId: pageId!,
          mode: plan.mode,
          rawText: pageText,
          rawTextSha256: sha256(pageText),
          charStart,
          charEnd,
          imageStorageKey,
          imageSha256: imageSha,
          ocrMeanConfidence: ocrResult
            ? Math.round(ocrResult.meanConfidence)
            : null,
          rotationDegrees: ocrResult?.rotationDegrees ?? null,
          rotationConfidence: ocrResult?.rotationConfidence ?? null,
          languages: ocrResult?.languages ?? [],
          isBlank,
          provenance: {
            jobId: job.id,
            runId: run.id,
            processorVersion: EXTRACT_PROCESSOR_VERSION,
            adapters: adapterSet,
          },
        })
        .onConflictDoNothing()
        .returning();
      if (!extraction) return; // concurrent re-execution already wrote it
      if (blocks.length > 0) {
        await tx.insert(researchPageBlocks).values(
          blocks.map((b, i) => ({
            pageExtractionId: extraction.id,
            blockIndex: i,
            blockType: b.blockType,
            text: b.text,
            bbox: b.bbox,
            charStart: b.charStart,
            charEnd: b.charEnd,
            readingOrder: b.readingOrder,
            columnIndex: b.columnIndex,
            confidence: b.confidence,
          })),
        );
      }
      if (warnings.length > 0) {
        await tx.insert(researchPageWarnings).values(
          warnings.map((w) => ({
            pageExtractionId: extraction.id,
            code: w.code,
            coordinates: w.coordinates,
            detail: w.detail,
          })),
        );
      }
    });
    pagesDone += 1;
  }

  const needsReview = reviewReasons.length > 0;
  const outputChecksum = sha256(
    JSON.stringify({ containerId, runKey, pagesDone, needsReview }),
  );

  await dbc.transaction(async (tx) => {
    await tx
      .update(researchExtractionRuns)
      .set({
        status: needsReview ? "REVIEW_REQUIRED" : "COMPLETE",
        pageCount: plans.length,
        finishedAt: new Date(),
      })
      .where(eq(researchExtractionRuns.id, run.id));
    await tx.insert(researchTransformations).values({
      containerId,
      kind: "extraction",
      detail: {
        jobId: job.id,
        runId: run.id,
        pageCount: plans.length,
        modes: plans.map((p) => p.mode),
        reviewReasons,
      },
      actor: `job:${job.id}`,
    });
    if (needsReview) {
      await tx.insert(researchReviewItems).values({
        containerId,
        kind: "ocr",
        reason: `Extraction requires review: ${reviewReasons.join("; ")}`,
      });
    }
    await transitionContainer(
      containerId,
      needsReview ? "OCR_REVIEW_REQUIRED" : "TEXT_EXTRACTED",
      {
        actor: `job:${job.id}`,
        detail: { runId: run.id, pageCount: plans.length },
        dbc: tx,
      },
    );
  });

  logger.info(
    { containerId, runId: run.id, pages: plans.length, needsReview },
    "Research container extraction finished",
  );
  return { outputChecksum };
}

let registered = false;
/** Register the extraction processor (idempotent). Rights-gated: touchesContent. */
export function registerExtractionProcessor(): void {
  if (registered) return;
  registered = true;
  registerProcessor(EXTRACT_JOB_KIND, extractProcessor, {
    touchesContent: true,
  });
}
