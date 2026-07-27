// Quotation routes (Phase 09).
// Mounted at /api/research/quotations (and the judgment sub-path in index.ts).
//
// ACCESS CONTROL MODEL (mirrors viewer.ts / ADR 0009 §D5):
//   • Every quotation is bound to a judgment which is bound to a container.
//   • All read/cite/list operations require `checkContainerAccess(…, "view")`.
//   • Export requires `checkContainerAccess(…, "export")`.
//   • Create/alter require `checkContainerAccess(…, "view")` (user can see the
//     text) PLUS an explicit research role (no guest/unauthenticated creates).
//   • Not-found (404) is returned instead of 403 when access is denied so that
//     the existence of a restricted quotation is not leaked to unauthorised
//     callers (non-leak policy, consistent with viewer.ts).

import { Router } from "express";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import { checkContainerAccess } from "../domain/gates";
import {
  db,
  researchVerifiedJudgments,
  researchQuotations,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createQuotation,
  getQuotation,
  recordAlteration,
  listQuotationsForJudgment,
  resolveMetadataMap,
  isReportCitationVerified,
  QuotationIntegrityError,
  QuotationNotFoundError,
  QUOTATION_EXPORT_ROLES,
} from "../quotations/service";
import {
  formatCitation,
  renderAlteredText,
  CITATION_STYLES,
} from "../quotations/formatter";
import type { CitationStyle } from "../quotations/formatter";

const router = Router();

// ── Shared access helpers ─────────────────────────────────────────────────

type ResearchRole = import("@workspace/db").ResearchRole;

/** Load judgment and check container access. Returns null when denied. */
async function resolveJudgmentAccess(
  judgmentId: number,
  role: ResearchRole | null,
  action: import("../domain/access").AccessAction,
  authEmail: string | undefined,
): Promise<{
  judgment: import("@workspace/db").ResearchVerifiedJudgment;
  allowed: boolean;
} | null> {
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));

  if (!judgment) return null;

  const { decision } = await checkContainerAccess(
    judgment.containerId,
    role,
    action,
    { actor: authEmail, audit: false },
  );

  return { judgment, allowed: decision.allowed };
}

/**
 * Load a quotation, resolve its judgment, and gate on container access.
 * Returns null when the quotation doesn't exist or access is denied.
 */
async function resolveQuotationAccess(
  quotationId: number,
  role: ResearchRole | null,
  action: import("../domain/access").AccessAction,
  authEmail: string | undefined,
): Promise<{
  quotation: typeof researchQuotations.$inferSelect;
  allowed: boolean;
} | null> {
  const [quotation] = await db
    .select()
    .from(researchQuotations)
    .where(eq(researchQuotations.id, quotationId));

  if (!quotation) return null;

  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, quotation.judgmentId));

  if (!judgment) return null;

  const { decision } = await checkContainerAccess(
    judgment.containerId,
    role,
    action,
    { actor: authEmail, audit: false },
  );

  return { quotation, allowed: decision.allowed };
}

// ── POST /quotations ── Create ─────────────────────────────────────────────

const CreateQuotationBody = z.object({
  judgmentId: z.number().int().positive(),
  selectedText: z.string().min(1),
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().positive(),
  paragraphIdentifier: z.string().optional().nullable(),
  sourcePageId: z.number().int().positive().optional().nullable(),
  userNote: z.string().max(2000).optional().nullable(),
});

router.post(
  "/",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const creatorId = req.researchUserId ?? null;
    if (!creatorId) {
      res.status(403).json({ error: "Forbidden", reason: "No research user identity" });
      return;
    }

    const parsed = CreateQuotationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    // Gate: must be able to VIEW the judgment's source container.
    const access = await resolveJudgmentAccess(
      parsed.data.judgmentId,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );
    if (!access || !access.allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const quotation = await createQuotation({
        ...parsed.data,
        creatorId,
      });
      res.status(201).json(quotation);
    } catch (err) {
      if (err instanceof QuotationIntegrityError) {
        res.status(422).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// ── GET /quotations/:id ── Read ───────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid quotation id" });
    return;
  }

  const access = await resolveQuotationAccess(
    id,
    req.researchRole ?? null,
    "view",
    req.authEmail ?? undefined,
  );
  // Deny → 404 (non-leak policy)
  if (!access || !access.allowed) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const { quotation, alterations, sourceChanged } = await getQuotation(id);
    res.json({ quotation, alterations, sourceChanged });
  } catch (err) {
    if (err instanceof QuotationNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── PATCH /quotations/:id/alterations ── Append alteration ───────────────

const RecordAlterationBody = z.object({
  kind: z.enum(["omission", "insertion", "alteration"]),
  positionStart: z.number().int().nonnegative(),
  positionEnd: z.number().int().nonnegative(),
  originalText: z.string(),
  replacementText: z.string(),
});

router.patch(
  "/:id/alterations",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid quotation id" });
      return;
    }
    const recordedBy = req.researchUserId ?? null;
    if (!recordedBy) {
      res.status(403).json({ error: "Forbidden", reason: "No research user identity" });
      return;
    }

    // Gate: must be able to VIEW the source container.
    const access = await resolveQuotationAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );
    if (!access || !access.allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const parsed = RecordAlterationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    try {
      const alteration = await recordAlteration({
        quotationId: id,
        recordedBy,
        ...parsed.data,
      });
      const { quotation } = await getQuotation(id);
      res.json({ alteration, quotation });
    } catch (err) {
      if (err instanceof QuotationNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (err instanceof QuotationIntegrityError) {
        res.status(422).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// ── GET /quotations/:id/cite?style=… ── Formatted citation ────────────────

router.get("/:id/cite", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid quotation id" });
    return;
  }

  const style = (req.query.style as string) ?? "neutral-citation-first";
  if (!CITATION_STYLES.includes(style as CitationStyle)) {
    res.status(400).json({
      error: `Unknown citation style '${style}'. Valid styles: ${CITATION_STYLES.join(", ")}`,
    });
    return;
  }

  // Gate: VIEW access required.
  const access = await resolveQuotationAccess(
    id,
    req.researchRole ?? null,
    "view",
    req.authEmail ?? undefined,
  );
  if (!access || !access.allowed) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const { quotation, alterations } = await getQuotation(id);

    // "exact" style refused for altered quotations.
    if (style === "exact" && quotation.kind === "altered") {
      res.status(409).json({
        error:
          "Altered quotations cannot be cited as exact. Use a citation style that acknowledges the alterations, or access the original selectedText directly.",
        code: "ALTERED_QUOTATION_NOT_EXACT",
      });
      return;
    }

    const metadata = await resolveMetadataMap(quotation.judgmentId);
    const reportVerified = await isReportCitationVerified(quotation.judgmentId);

    const citation = formatCitation(
      {
        selectedText: quotation.selectedText,
        caseName: quotation.caseName,
        citation: quotation.citation,
        court: quotation.court,
        judge: quotation.judge,
        decisionDate: quotation.decisionDate,
        paragraphIdentifier: quotation.paragraphIdentifier,
        kind: quotation.kind as "exact" | "altered",
      },
      style as CitationStyle,
      metadata,
      reportVerified,
    );

    const renderedText =
      quotation.kind === "altered"
        ? renderAlteredText(
            quotation.selectedText,
            alterations.map((a) => ({
              kind: a.kind as "omission" | "insertion" | "alteration",
              positionStart: a.positionStart,
              positionEnd: a.positionEnd,
              replacementText: a.replacementText,
            })),
          )
        : quotation.selectedText;

    res.json({ style, citation, renderedText, kind: quotation.kind });
  } catch (err) {
    if (err instanceof QuotationNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── GET /quotations/:id/export ── Provenance bundle (guest blocked) ────────
// Requires EXPORT access on the source container — not just VIEW.

router.get(
  "/:id/export",
  requireResearchRole(...QUOTATION_EXPORT_ROLES),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid quotation id" });
      return;
    }

    // Gate: EXPORT access required (stricter than view).
    const access = await resolveQuotationAccess(
      id,
      req.researchRole ?? null,
      "export",
      req.authEmail ?? undefined,
    );
    if (!access || !access.allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const { quotation, alterations, sourceChanged } = await getQuotation(id);
      const metadata = await resolveMetadataMap(quotation.judgmentId);
      const reportVerified = await isReportCitationVerified(quotation.judgmentId);

      res.json({
        quotation,
        alterations,
        metadata,
        reportVerified,
        sourceChanged,
        exportedAt: new Date().toISOString(),
        integrityNote: sourceChanged
          ? "WARNING: Source text has changed since this quotation was created."
          : "Source text matches stored checksum at time of export.",
      });
    } catch (err) {
      if (err instanceof QuotationNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  },
);

// ── GET /judgments/:judgmentId/quotations ── List for judgment ────────────
// Registered in routes/index.ts under /judgments/:judgmentId/quotations.
// VIEW access on the container is required.

export const listForJudgmentHandler = async (
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> => {
  const judgmentId = Number(req.params.judgmentId);
  if (!Number.isInteger(judgmentId) || judgmentId <= 0) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  // Gate: VIEW access on the judgment's container.
  const access = await resolveJudgmentAccess(
    judgmentId,
    req.researchRole ?? null,
    "view",
    req.authEmail ?? undefined,
  );
  if (!access || !access.allowed) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const rows = await listQuotationsForJudgment(judgmentId);
  res.json(rows);
};

export default router;
