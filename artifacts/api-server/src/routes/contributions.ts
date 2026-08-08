import { Router, type IRouter } from "express";
import { and, arrayContains, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  contributionsTable,
  activityTable,
  contributionPendingUploadsTable,
} from "@workspace/db";
import { gt } from "drizzle-orm";
import {
  CreateContributionBody,
  GetContributionResponse,
  ListKnowledgeBaseQueryParams,
  ListKnowledgeBaseResponse,
  GetKnowledgeBaseEntryParams,
  GetKnowledgeBaseEntryResponse,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { extractTextFromObject } from "../lib/textExtraction";
import { anonymizeContribution } from "../lib/anonymization";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /contributions
 *
 * Public endpoint. Called after a file has been uploaded to object storage.
 * Records the contribution and attempts server-side text extraction.
 */
router.post("/contributions", async (req, res): Promise<void> => {
  const parsed = CreateContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // The objectPath must be a server-issued upload grant (recorded when the
  // presigned upload URL was requested). Consume it atomically — one-time
  // use — so nobody can submit a contribution pointing at an arbitrary or
  // already-used private object key.
  const consumed = await db
    .delete(contributionPendingUploadsTable)
    .where(
      and(
        eq(contributionPendingUploadsTable.objectPath, data.objectPath),
        gt(contributionPendingUploadsTable.expiresAt, new Date()),
      ),
    )
    .returning({ id: contributionPendingUploadsTable.id });

  if (consumed.length === 0) {
    res.status(403).json({
      error: "objectPath was not issued by this server or has expired",
    });
    return;
  }

  let extractionStatus: "pending" | "extracted" | "unsupported" | "failed" =
    "pending";
  let extractedText: string | null = null;

  try {
    const result = await extractTextFromObject({
      objectPath: data.objectPath,
      fileName: data.fileName,
      contentType: data.contentType,
      storage: objectStorageService,
    });
    extractionStatus = result.status;
    extractedText = result.text;
  } catch (error) {
    req.log.error({ err: error }, "Text extraction failed");
    extractionStatus = "failed";
  }

  const [contribution] = await db
    .insert(contributionsTable)
    .values({
      title: data.title,
      description: data.description ?? null,
      categories: data.categories,
      contributorName: data.contributorName,
      contributorEmail: data.contributorEmail,
      contributorPhone: data.contributorPhone ?? null,
      fileName: data.fileName,
      objectPath: data.objectPath,
      fileSize: data.fileSize ?? null,
      contentType: data.contentType ?? null,
      extractedText,
      extractionStatus,
      status: "pending",
    })
    .returning();

  await db.insert(activityTable).values({
    type: "contribution_added",
    description: `New contribution "${data.title}" (${data.categories.join(", ")}) from ${data.contributorName}`,
  });

  res.status(201).json(GetContributionResponse.parse(contribution));

  // Anonymise in the background — client details and real names are replaced
  // with fictitious ones before the text can ever reach the public corpus.
  if (contribution) {
    void anonymizeContribution(contribution.id).catch((err) => {
      req.log.error({ err, contributionId: contribution.id }, "Background anonymisation failed");
    });
  }
});

/**
 * GET /knowledge-base
 *
 * Read-only corpus of approved contributions for downstream app consumption.
 */
router.get("/knowledge-base", async (req, res): Promise<void> => {
  const query = ListKnowledgeBaseQueryParams.safeParse(req.query);
  const conditions = [eq(contributionsTable.status, "approved")];

  if (query.success && query.data.category) {
    conditions.push(arrayContains(contributionsTable.categories, [query.data.category]));
  }

  if (query.success && query.data.search) {
    const term = `%${query.data.search}%`;
    conditions.push(
      sql`(${or(
        ilike(contributionsTable.title, term),
        ilike(contributionsTable.anonymizedText, term),
      )})`,
    );
  }

  // The public corpus only ever exposes the anonymised text — never the raw
  // extracted text, which may contain real client details.
  const entries = await db
    .select({
      id: contributionsTable.id,
      title: contributionsTable.title,
      description: contributionsTable.description,
      categories: contributionsTable.categories,
      fileName: contributionsTable.fileName,
      objectPath: contributionsTable.objectPath,
      contentType: contributionsTable.contentType,
      extractedText: contributionsTable.anonymizedText,
      createdAt: contributionsTable.createdAt,
    })
    .from(contributionsTable)
    .where(and(...conditions))
    .orderBy(desc(contributionsTable.createdAt));

  res.json(ListKnowledgeBaseResponse.parse(entries));
});

/**
 * GET /knowledge-base/:id
 *
 * Single approved corpus entry.
 */
router.get("/knowledge-base/:id", async (req, res): Promise<void> => {
  const params = GetKnowledgeBaseEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select({
      id: contributionsTable.id,
      title: contributionsTable.title,
      description: contributionsTable.description,
      categories: contributionsTable.categories,
      fileName: contributionsTable.fileName,
      objectPath: contributionsTable.objectPath,
      contentType: contributionsTable.contentType,
      extractedText: contributionsTable.anonymizedText,
      createdAt: contributionsTable.createdAt,
    })
    .from(contributionsTable)
    .where(
      and(
        eq(contributionsTable.id, params.data.id),
        eq(contributionsTable.status, "approved"),
      ),
    );

  if (!entry) {
    res.status(404).json({ error: "Knowledge base entry not found" });
    return;
  }

  res.json(GetKnowledgeBaseEntryResponse.parse(entry));
});

export default router;
