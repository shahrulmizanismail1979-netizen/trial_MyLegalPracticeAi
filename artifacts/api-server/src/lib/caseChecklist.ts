/**
 * Case checklist management: auto-generate procedural checklists on matter
 * creation (via Gemini) and provide CRUD routes for all portals.
 *
 * All queries scope by portal + matter_id + owner_key so no tenant can read,
 * modify, or delete another tenant's checklist items.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import { PORTAL_NAMES, type Portal } from "./caseStages";
import { verifyMatterOwnership } from "./caseOwnership";

// ── AI checklist generation ───────────────────────────────────────────────────

function buildChecklistPrompt(
  portal: Portal,
  matterTitle: string,
  matterType: string | null | undefined,
  charge: string | null | undefined,
): string {
  const portalName = PORTAL_NAMES[portal];
  const typeHint = charge ?? matterType ?? "General";
  return `You are a Malaysian legal practice management assistant for ${portalName}.

Generate a procedural checklist for a new matter:
Title: "${matterTitle}"
Type/Offence/Category: "${typeHint}"

Return a JSON array of checklist item strings — practical, actionable steps a Malaysian lawyer must complete for this type of matter. 10-15 items ordered chronologically.

Example format:
["Obtain client instructions and signed authority", "Open matter file and generate file reference", ...]

Respond ONLY with the JSON array, no markdown, no extra text.`;
}

export async function generateAndSaveChecklist(
  portal: Portal,
  matterId: number,
  ownerKey: string,
  matterTitle: string,
  matterType?: string | null,
  charge?: string | null,
): Promise<void> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: buildChecklistPrompt(portal, matterTitle, matterType, charge) }],
        },
      ],
      config: { maxOutputTokens: 2048, responseMimeType: "application/json" },
    });
    const raw = result.text ?? "[]";
    const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const items: string[] = JSON.parse(clean);
    if (!Array.isArray(items) || items.length === 0) return;

    // Bulk insert checklist items
    const capped = items.slice(0, 20);
    for (let i = 0; i < capped.length; i++) {
      await pool.query(
        `INSERT INTO case_checklists (portal, matter_id, owner_key, item_text, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [portal, matterId, ownerKey, String(capped[i]).slice(0, 500), i],
      );
    }
    logger.info({ portal, matterId, count: capped.length }, "Checklist generated");
  } catch (err) {
    logger.warn({ err, portal, matterId }, "Checklist generation failed (non-fatal)");
  }
}

// ── Route builder ─────────────────────────────────────────────────────────────

/**
 * Returns a router handling GET/POST/PATCH/DELETE for checklist items.
 * The router uses mergeParams: true and reads req.params.matterId.
 *
 * SECURITY: every query includes owner_key to scope reads and writes to the
 * authenticated tenant. POST also verifies the matter row itself belongs to
 * the caller via verifyMatterOwnership before inserting.
 */
export function makeChecklistRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
): IRouter {
  const router: IRouter = Router({ mergeParams: true });

  router.get("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    // Scope by portal + matter_id + owner_key — no cross-tenant reads
    const { rows } = await pool.query(
      `SELECT id, item_text, done, position, created_at, updated_at
       FROM case_checklists
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
       ORDER BY position, id`,
      [portal, matterId, ownerKey],
    );
    res.json(rows);
  });

  router.post("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    const { item_text } = req.body ?? {};
    if (!item_text || typeof item_text !== "string" || !item_text.trim()) {
      res.status(400).json({ error: "item_text is required" });
      return;
    }

    // Verify the caller owns this matter before linking a checklist item to it
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const { rows: pos } = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM case_checklists WHERE portal = $1 AND matter_id = $2 AND owner_key = $3`,
      [portal, matterId, ownerKey],
    );
    const position = (pos[0]?.next_pos as number) ?? 0;
    const { rows } = await pool.query(
      `INSERT INTO case_checklists (portal, matter_id, owner_key, item_text, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [portal, matterId, ownerKey, item_text.trim().slice(0, 500), position],
    );
    res.status(201).json(rows[0]);
  });

  router.patch("/:itemId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const itemId = parseInt((req.params as Record<string, string>).itemId ?? "0", 10);
    if (Number.isNaN(matterId) || Number.isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // Include owner_key in WHERE so a tenant cannot update another's items
    const { rows: updated } = await pool.query(
      `UPDATE case_checklists
       SET done = COALESCE($5, done),
           item_text = COALESCE($6, item_text),
           updated_at = now()
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4
       RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        itemId,
        typeof req.body?.done === "boolean" ? req.body.done : null,
        typeof req.body?.item_text === "string" && req.body.item_text.trim()
          ? req.body.item_text.trim().slice(0, 500)
          : null,
      ],
    );
    if (!updated.length) {
      res.status(404).json({ error: "Checklist item not found" });
      return;
    }
    res.json(updated[0]);
  });

  router.delete("/:itemId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const itemId = parseInt((req.params as Record<string, string>).itemId ?? "0", 10);
    if (Number.isNaN(matterId) || Number.isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // Include owner_key so a tenant cannot delete another's items
    await pool.query(
      `DELETE FROM case_checklists
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4`,
      [portal, matterId, ownerKey, itemId],
    );
    res.json({ success: true });
  });

  return router;
}
