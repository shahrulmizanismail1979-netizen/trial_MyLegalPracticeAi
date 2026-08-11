/**
 * Client management routes for portals that don't have their own client table.
 * (MyLitAI uses lit_clients; all others use the shared case_clients table.)
 *
 * Routes:
 *   GET    /clients                           — list all clients for the authenticated user
 *   POST   /clients                           — create a client
 *   GET    /clients/:id                       — get one client (incl. linked matterIds)
 *   PATCH  /clients/:id                       — update a client
 *   DELETE /clients/:id                       — delete a client
 *   POST   /clients/:id/link-matter {matterId} — link a client to a matter
 *   DELETE /clients/:id/link-matter/:matterId — unlink a client from a matter
 *
 * Client<->matter links live in the shared case_client_matters table (see
 * ensureCaseClientMatterTable). makeMatterClientsRouter exposes the reverse
 * direction (linked clients for a given matter).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { Portal } from "./caseStages";
import { verifyMatterOwnership } from "./caseOwnership";

export function makeClientsRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
): IRouter {
  const router: IRouter = Router();

  router.get("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT id, name, ic_number, company_name, email, phone, address, notes, created_at, updated_at
       FROM case_clients WHERE portal = $1 AND owner_key = $2 ORDER BY name`,
      [portal, ownerKey],
    );
    res.json(rows);
  });

  router.post("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const { name, ic_number, company_name, email, phone, address, notes } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO case_clients (portal, owner_key, name, ic_number, company_name, email, phone, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        portal,
        ownerKey,
        name.trim().slice(0, 300),
        typeof ic_number === "string" ? ic_number.slice(0, 50) : null,
        typeof company_name === "string" ? company_name.slice(0, 300) : null,
        typeof email === "string" ? email.slice(0, 200) : null,
        typeof phone === "string" ? phone.slice(0, 50) : null,
        typeof address === "string" ? address.slice(0, 500) : null,
        typeof notes === "string" ? notes.slice(0, 5000) : null,
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.get("/:clientId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const clientId = parseInt((req.params as Record<string, string>).clientId, 10);
    if (Number.isNaN(clientId)) {
      res.status(400).json({ error: "Invalid client id" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT * FROM case_clients WHERE portal = $1 AND owner_key = $2 AND id = $3 LIMIT 1`,
      [portal, ownerKey, clientId],
    );
    if (!rows.length) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    // Include the matter ids this client is linked to (owner-scoped).
    const { rows: links } = await pool.query(
      `SELECT matter_id FROM case_client_matters
       WHERE portal = $1 AND owner_key = $2 AND client_id = $3
       ORDER BY matter_id`,
      [portal, ownerKey, clientId],
    );
    res.json({
      ...rows[0],
      matterIds: links.map((l: { matter_id: number }) => l.matter_id),
    });
  });

  router.patch("/:clientId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const clientId = parseInt((req.params as Record<string, string>).clientId, 10);
    if (Number.isNaN(clientId)) {
      res.status(400).json({ error: "Invalid client id" });
      return;
    }
    const { name, ic_number, company_name, email, phone, address, notes } = req.body ?? {};
    const { rows } = await pool.query(
      `UPDATE case_clients SET
         name = COALESCE($4, name),
         ic_number = COALESCE($5, ic_number),
         company_name = COALESCE($6, company_name),
         email = COALESCE($7, email),
         phone = COALESCE($8, phone),
         address = COALESCE($9, address),
         notes = COALESCE($10, notes),
         updated_at = now()
       WHERE portal = $1 AND owner_key = $2 AND id = $3
       RETURNING *`,
      [
        portal,
        ownerKey,
        clientId,
        typeof name === "string" ? name.trim().slice(0, 300) : null,
        typeof ic_number === "string" ? ic_number.slice(0, 50) : null,
        typeof company_name === "string" ? company_name.slice(0, 300) : null,
        typeof email === "string" ? email.slice(0, 200) : null,
        typeof phone === "string" ? phone.slice(0, 50) : null,
        typeof address === "string" ? address.slice(0, 500) : null,
        typeof notes === "string" ? notes.slice(0, 5000) : null,
      ],
    );
    if (!rows.length) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json(rows[0]);
  });

  router.delete("/:clientId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const clientId = parseInt((req.params as Record<string, string>).clientId, 10);
    if (Number.isNaN(clientId)) {
      res.status(400).json({ error: "Invalid client id" });
      return;
    }
    await pool.query(
      `DELETE FROM case_clients WHERE portal = $1 AND owner_key = $2 AND id = $3`,
      [portal, ownerKey, clientId],
    );
    res.json({ success: true });
  });

  // ── Link a client to a matter ──────────────────────────────────────────────
  router.post("/:clientId/link-matter", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const clientId = parseInt((req.params as Record<string, string>).clientId, 10);
    if (Number.isNaN(clientId)) {
      res.status(400).json({ error: "Invalid client id" });
      return;
    }
    const matterId = parseInt(String(req.body?.matterId ?? ""), 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "matterId is required" });
      return;
    }

    // Verify the caller owns the client (portal + owner_key scoped lookup)
    const { rows: client } = await pool.query(
      `SELECT id FROM case_clients WHERE portal = $1 AND owner_key = $2 AND id = $3`,
      [portal, ownerKey, clientId],
    );
    if (!client.length) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    // Verify the caller owns the matter before linking to it
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO case_client_matters (portal, client_id, matter_id, owner_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (portal, client_id, matter_id) DO NOTHING
       RETURNING *`,
      [portal, clientId, matterId, ownerKey],
    );
    if (rows.length) {
      res.status(201).json(rows[0]);
      return;
    }
    // Already linked — return the existing link idempotently
    const { rows: existing } = await pool.query(
      `SELECT * FROM case_client_matters
       WHERE portal = $1 AND client_id = $2 AND matter_id = $3 AND owner_key = $4`,
      [portal, clientId, matterId, ownerKey],
    );
    res.status(200).json(existing[0]);
  });

  // ── Unlink a client from a matter ──────────────────────────────────────────
  router.delete(
    "/:clientId/link-matter/:matterId",
    async (req: Request, res: Response) => {
      const ownerKey = getOwnerKey(req, res);
      if (!ownerKey) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      const clientId = parseInt((req.params as Record<string, string>).clientId, 10);
      const matterId = parseInt((req.params as Record<string, string>).matterId, 10);
      if (Number.isNaN(clientId) || Number.isNaN(matterId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      // Include owner_key so a tenant cannot unlink another's records
      await pool.query(
        `DELETE FROM case_client_matters
         WHERE portal = $1 AND owner_key = $2 AND client_id = $3 AND matter_id = $4`,
        [portal, ownerKey, clientId, matterId],
      );
      res.json({ success: true });
    },
  );

  return router;
}

/**
 * Shared client<->matter link table (case_client_matters).
 *
 * Lets a lawyer link an existing client record (case_clients) directly to a
 * specific matter, many-to-many. This does NOT duplicate the client directory —
 * it only records links, keyed by the existing case_clients.id.
 *
 * All queries scope by portal + owner_key so no tenant can read, modify, or
 * delete another tenant's links. Linking additionally verifies both the client
 * (case_clients portal + owner_key lookup) and the matter (verifyMatterOwnership).
 *
 * Created via direct SQL boot-ensure (ensureCaseClientMatterTable) — NOT drizzle
 * push (rename trap). The drizzle schema in lib/db/src/schema mirrors the shape.
 */

// ── Boot-ensure DDL ───────────────────────────────────────────────────────────

const CASE_CLIENT_MATTERS_DDL = `
CREATE TABLE IF NOT EXISTS case_client_matters (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  client_id integer NOT NULL REFERENCES case_clients(id) ON DELETE CASCADE,
  matter_id integer NOT NULL,
  owner_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS case_client_matters_portal_client_matter_uniq
  ON case_client_matters (portal, client_id, matter_id);
CREATE INDEX IF NOT EXISTS idx_case_client_matters_matter ON case_client_matters (portal, matter_id);
CREATE INDEX IF NOT EXISTS idx_case_client_matters_owner ON case_client_matters (portal, owner_key);
`;

let caseClientMattersEnsured: Promise<void> | null = null;

/**
 * Idempotent boot-time DDL for the case_client_matters table. The orchestrator
 * awaits this once at startup before mounting the routers.
 */
export function ensureCaseClientMatterTable(): Promise<void> {
  if (!caseClientMattersEnsured) {
    caseClientMattersEnsured = pool
      .query(CASE_CLIENT_MATTERS_DDL)
      .then(() => {
        logger.info("Case client-matter link table ensured");
      })
      .catch((err) => {
        caseClientMattersEnsured = null; // allow retry
        logger.error({ err }, "Failed to ensure case client-matter link table");
        throw err;
      });
  }
  return caseClientMattersEnsured;
}

// ── Matter-side route builder ───────────────────────────────────────────────

/**
 * Returns a router exposing the linked clients for a given matter. Mounts at
 * {P}/:matterId/clients relative to each portal's matter router; uses
 * mergeParams: true and reads req.params.matterId (same convention as
 * buildCaseEventsRouter in caseEvents.ts).
 *
 * SECURITY: verifies the matter belongs to the caller via verifyMatterOwnership
 * before returning, and joins on portal + owner_key so no cross-tenant client
 * rows can leak.
 */
export function makeMatterClientsRouter(
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
    // Verify the caller owns the matter before returning its clients
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    // Scope by portal + owner_key so no cross-tenant client rows leak
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.ic_number, c.company_name, c.email, c.phone, c.address,
              c.notes, c.created_at, c.updated_at
       FROM case_client_matters l
       JOIN case_clients c
         ON c.id = l.client_id AND c.portal = l.portal AND c.owner_key = l.owner_key
       WHERE l.portal = $1 AND l.owner_key = $2 AND l.matter_id = $3
       ORDER BY c.name, c.id`,
      [portal, ownerKey, matterId],
    );
    res.json(rows);
  });

  return router;
}
