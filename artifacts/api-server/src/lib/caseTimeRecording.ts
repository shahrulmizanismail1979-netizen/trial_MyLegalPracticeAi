/**
 * Time recording route builder for all portals.
 * Mounts at /:id/time-entries relative to each portal's matter router.
 *
 * SECURITY: GET and DELETE scope by owner_key so tenants cannot read or
 * remove each other's entries. POST verifies matter ownership before
 * inserting so a tenant cannot orphan entries under another's matter.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { verifyMatterOwnership } from "./caseOwnership";
import type { Portal } from "./caseStages";

/**
 * Rate card lookup result: the matched rate and which rule tier was used.
 *
 * source values:
 *   'named' — a row with a matching lawyer_name was found (steps 1 or 2)
 *   'level' — only a level/area-only row matched (steps 3 or 4), even if a
 *              lawyer_name was supplied but had no matching named rule
 */
export type RateCardSource = "named" | "level";
interface RateCardMatch {
  rate: number;
  source: RateCardSource;
  /** The id of the case_rate_cards row that was matched. Stored on the time
   *  entry so that propagation can target exactly the right entries when the
   *  card is later updated or deleted. */
  cardId: number;
}

/**
 * Look up the rate card rate for an activity-type × lawyer-level combination,
 * with optional named-lawyer and practice-area refinements.
 *
 * Fallback chain (most-specific first):
 *   1. activity + level + name + area  (all four match)  → source: 'named'
 *   2. activity + level + name          (name match, any area) → source: 'named'
 *   3. activity + level + area          (area match, no named-lawyer row) → source: 'level'
 *   4. activity + level                 (no name, no area — broadest fallback) → source: 'level'
 *
 * Returns null when no match exists; the caller then falls back to the
 * firm's default_hourly_rate at billing time.
 */
async function lookupRateCard(
  portal: Portal,
  ownerKey: string,
  activityType: string,
  lawyerLevel: string,
  lawyerName?: string | null,
  practiceArea?: string | null,
): Promise<RateCardMatch | null> {
  const hasName = !!(lawyerName && lawyerName.trim());
  const hasArea = !!(practiceArea && practiceArea.trim());
  const name = hasName ? lawyerName!.trim() : null;
  const area = hasArea ? practiceArea!.trim() : null;

  // Step 1 — named-lawyer + practice-area exact match.
  if (hasName && hasArea) {
    const { rows } = await pool.query(
      `SELECT id, rate_usd FROM case_rate_cards
       WHERE portal = $1 AND owner_key = $2 AND activity_type = $3
         AND lawyer_level = $4 AND lawyer_name = $5 AND practice_area = $6`,
      [portal, ownerKey, activityType, lawyerLevel, name, area],
    );
    if (rows[0]) return { rate: parseFloat(rows[0].rate_usd as string), source: "named", cardId: rows[0].id as number };
  }

  // Step 2 — named-lawyer match (any practice area).
  if (hasName) {
    const { rows } = await pool.query(
      `SELECT id, rate_usd FROM case_rate_cards
       WHERE portal = $1 AND owner_key = $2 AND activity_type = $3
         AND lawyer_level = $4 AND lawyer_name = $5 AND practice_area IS NULL`,
      [portal, ownerKey, activityType, lawyerLevel, name],
    );
    if (rows[0]) return { rate: parseFloat(rows[0].rate_usd as string), source: "named", cardId: rows[0].id as number };
  }

  // Step 3 — practice-area match with no named-lawyer row.
  if (hasArea) {
    const { rows } = await pool.query(
      `SELECT id, rate_usd FROM case_rate_cards
       WHERE portal = $1 AND owner_key = $2 AND activity_type = $3
         AND lawyer_level = $4 AND lawyer_name IS NULL AND practice_area = $5`,
      [portal, ownerKey, activityType, lawyerLevel, area],
    );
    if (rows[0]) return { rate: parseFloat(rows[0].rate_usd as string), source: "level", cardId: rows[0].id as number };
  }

  // Step 4 — level-only fallback (no name, no area).
  const { rows } = await pool.query(
    `SELECT id, rate_usd FROM case_rate_cards
     WHERE portal = $1 AND owner_key = $2 AND activity_type = $3
       AND lawyer_level = $4 AND lawyer_name IS NULL AND practice_area IS NULL`,
    [portal, ownerKey, activityType, lawyerLevel],
  );
  if (rows[0]) return { rate: parseFloat(rows[0].rate_usd as string), source: "level", cardId: rows[0].id as number };
  return null;
}

export function makeTimeRecordingRouter(
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
    const { rows } = await pool.query(
      `SELECT id, description, minutes, rate_usd, entry_date, created_at,
              activity_type, lawyer_level, lawyer_name, rate_source, rate_card_id
       FROM case_time_entries
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
       ORDER BY entry_date DESC, id DESC`,
      [portal, matterId, ownerKey],
    );
    const totalMinutes = rows.reduce(
      (s: number, r: { minutes: number }) => s + (r.minutes as number),
      0,
    );
    res.json({ entries: rows, totalMinutes });
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

    // Verify caller owns the matter before inserting a time entry for it
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const { description, minutes, rate_usd, entry_date, activity_type, lawyer_level, lawyer_name, practice_area } = req.body ?? {};
    if (!description || typeof description !== "string" || !description.trim()) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const mins = parseInt(String(minutes), 10);
    if (Number.isNaN(mins) || mins < 0) {
      res.status(400).json({ error: "minutes must be a non-negative integer" });
      return;
    }
    const dateStr =
      typeof entry_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry_date)
        ? entry_date
        : new Date().toISOString().slice(0, 10);

    const activityTypeStr = typeof activity_type === "string" && activity_type.trim() ? activity_type.trim().slice(0, 200) : null;
    const lawyerLevelStr = typeof lawyer_level === "string" && lawyer_level.trim() ? lawyer_level.trim().slice(0, 200) : null;
    const lawyerNameStr = typeof lawyer_name === "string" && lawyer_name.trim() ? lawyer_name.trim().slice(0, 200) : null;
    const practiceAreaStr = typeof practice_area === "string" && practice_area.trim() ? practice_area.trim().slice(0, 200) : null;

    // Resolve rate and record its provenance.
    // rate_source values:
    //   'manual'  — caller supplied an explicit rate_usd
    //   'named'   — rate card matched a named-lawyer rule
    //   'level'   — rate card matched a level/area-only rule (even if a name was supplied)
    //   'default' — no rate card matched; billing will use the firm's default_hourly_rate
    let rateVal: number | null = null;
    let rateSource: "manual" | "named" | "level" | "default" = "default";
    let rateCardId: number | null = null;

    const explicitRate =
      rate_usd !== undefined && rate_usd !== null && rate_usd !== ""
        ? parseFloat(String(rate_usd))
        : null;

    if (explicitRate !== null && !Number.isNaN(explicitRate)) {
      rateVal = explicitRate;
      rateSource = "manual";
      // rate_card_id stays null — manual rates are not tied to any card
    } else if (activityTypeStr && lawyerLevelStr) {
      const match = await lookupRateCard(portal, ownerKey, activityTypeStr, lawyerLevelStr, lawyerNameStr, practiceAreaStr);
      if (match) {
        rateVal = match.rate;
        rateSource = match.source;
        rateCardId = match.cardId;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO case_time_entries
         (portal, matter_id, owner_key, description, minutes, rate_usd, entry_date,
          activity_type, lawyer_level, lawyer_name, rate_source, rate_card_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        description.trim().slice(0, 500),
        mins,
        rateVal !== null && !Number.isNaN(rateVal) ? rateVal : null,
        dateStr,
        activityTypeStr,
        lawyerLevelStr,
        lawyerNameStr,
        rateSource,
        rateCardId,
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.delete("/:entryId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const entryId = parseInt((req.params as Record<string, string>).entryId ?? "0", 10);
    if (Number.isNaN(matterId) || Number.isNaN(entryId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // Include owner_key so a tenant cannot delete another's entries.
    // Never delete an entry that has been billed onto an invoice.
    const del = await pool.query(
      `DELETE FROM case_time_entries
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4
         AND invoice_id IS NULL`,
      [portal, matterId, ownerKey, entryId],
    );
    if (del.rowCount === 0) {
      const { rows } = await pool.query(
        `SELECT invoice_id FROM case_time_entries
         WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4`,
        [portal, matterId, ownerKey, entryId],
      );
      if (rows.length > 0) {
        res.status(409).json({
          error: "This time entry has been billed on an invoice and cannot be deleted. Void the invoice first.",
        });
        return;
      }
    }
    res.json({ success: true });
  });

  return router;
}
