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
      `SELECT id, description, minutes, rate_usd, entry_date, created_at
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

    const { description, minutes, rate_usd, entry_date } = req.body ?? {};
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
    const rateVal =
      rate_usd !== undefined && rate_usd !== null && rate_usd !== ""
        ? parseFloat(String(rate_usd))
        : null;
    const { rows } = await pool.query(
      `INSERT INTO case_time_entries (portal, matter_id, owner_key, description, minutes, rate_usd, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        description.trim().slice(0, 500),
        mins,
        rateVal !== null && !Number.isNaN(rateVal) ? rateVal : null,
        dateStr,
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
