/**
 * Client management routes for portals that don't have their own client table.
 * (MyLitAI uses lit_clients; all others use the shared case_clients table.)
 *
 * Routes:
 *   GET  /clients          — list all clients for the authenticated user
 *   POST /clients          — create a client
 *   GET  /clients/:id      — get one client
 *   PATCH /clients/:id     — update a client
 *   DELETE /clients/:id    — delete a client
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import type { Portal } from "./caseStages";

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
    res.json(rows[0]);
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

  return router;
}
