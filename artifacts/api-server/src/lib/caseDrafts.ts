/**
 * Shared client-letter writer & versioned drafts for every practice portal
 * (Task #194).
 *
 * Drafts are versioned: the first save creates the root draft (root_id = self.id
 * set after insert). "Save new version" creates a sibling row with the same
 * root_id and an incremented version_number. All versions of a draft share one
 * root_id, so a timeline can be fetched by `WHERE root_id = $x`.
 *
 * Letters are drafts with kind='letter'. The AI letter-writer endpoint streams
 * a generated letter into the response; the client saves it as a draft.
 *
 * Routes (relative to where the router is mounted via attachCaseIntelligence):
 *   POST  {P}/letters/generate          — stream AI letter (auth → aiRateLimit → AI)
 *   GET   {P}/drafts/list               — list owner's drafts (filterable)
 *   POST  {P}/drafts                    — save/create a draft (root or new version)
 *   GET   {P}/drafts/:draftId           — get one draft
 *   GET   {P}/drafts/:draftId/versions  — all versions of this draft's root
 *   PATCH {P}/drafts/:draftId           — rename / update notes
 *   DELETE {P}/drafts/:draftId          — delete one version
 *   GET   {P}/drafts/:draftId/export/pdf   — export as PDF
 *   GET   {P}/drafts/:draftId/export/docx  — export as DOCX
 *   GET   {P}/:matterId/drafts          — list drafts for a matter
 *
 * SECURITY: every route resolves the owner key first (401 if absent). Matter
 * links are verified via verifyMatterOwnership before persist. AI route runs
 * auth BEFORE aiRateLimit per project rule (ai-ratelimit-auth-ordering).
 */
import type { IRouter, Request, Response } from "express";
import { Readable } from "stream";
import PDFDocument from "pdfkit";
import { pool } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { verifyMatterOwnership } from "./caseOwnership";
import { aiRateLimit } from "./aiRateLimit";
import { type Portal } from "./caseStages";
import { logger } from "./logger";

// Re-use billing settings (firm_name, firm_address, etc.) for letterhead.
async function getLetterheadSettings(
  portal: Portal,
  ownerKey: string,
): Promise<Record<string, string | null>> {
  const { rows } = await pool.query(
    `SELECT firm_name, firm_address, firm_phone, firm_email
     FROM case_billing_settings WHERE portal = $1 AND owner_key = $2 LIMIT 1`,
    [portal, ownerKey],
  );
  return (
    rows[0] ?? {
      firm_name: null,
      firm_address: null,
      firm_phone: null,
      firm_email: null,
    }
  );
}

type Row = Record<string, unknown>;
type GetOwnerKey = (req: Request, res: Response) => string | null;

const MAX_CONTENT = 500_000;
const MAX_TITLE = 300;

export const LETTER_TYPES = [
  { id: "status_update",       label: "Status Update to Client" },
  { id: "fee_reminder",        label: "Fee Reminder to Client" },
  { id: "request_documents",   label: "Request for Documents from Client" },
  { id: "cover_letter_court",  label: "Cover Letter to Court" },
  { id: "cover_letter_opponent", label: "Cover Letter to Opposing Counsel" },
  { id: "demand_letter",       label: "Demand Letter" },
  { id: "settlement_offer",    label: "Settlement Offer Letter" },
  { id: "engagement_letter",   label: "Engagement / Retainer Letter" },
] as const;

const PORTAL_PRACTICE: Record<Portal, string> = {
  lit:    "Malaysian civil litigation (contract, tort, land, employment, company law)",
  crim:   "Malaysian criminal litigation (criminal defence)",
  sya:    "Malaysian Syariah / Islamic family law and advisory",
  ccb:    "Malaysian corporate and commercial banking litigation",
  acc:    "Malaysian personal injury, road accident, and medical negligence claims",
  convey: "Malaysian property conveyancing and land transactions",
  corp:   "Malaysian corporate legal practice and commercial transactions",
};

export async function ensureDraftTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_drafts (
      id SERIAL PRIMARY KEY,
      portal TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      matter_id INTEGER,
      root_id INTEGER,
      version_number INTEGER NOT NULL DEFAULT 1,
      kind TEXT NOT NULL DEFAULT 'draft',
      letter_type TEXT,
      language TEXT NOT NULL DEFAULT 'en',
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS case_drafts_owner_idx ON case_drafts (portal, owner_key);
    CREATE INDEX IF NOT EXISTS case_drafts_matter_idx ON case_drafts (portal, owner_key, matter_id);
    CREATE INDEX IF NOT EXISTS case_drafts_root_idx ON case_drafts (root_id);
  `);
}

function parseDraftId(raw: string, res: Response): number | undefined {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid draft id" });
    return undefined;
  }
  return id;
}

async function ownedDraft(
  portal: Portal,
  ownerKey: string,
  idParam: string,
  res: Response,
): Promise<Row | undefined> {
  const id = parseDraftId(idParam, res);
  if (!id) return undefined;
  const { rows } = await pool.query(
    `SELECT * FROM case_drafts WHERE id = $1 AND portal = $2 AND owner_key = $3`,
    [id, portal, ownerKey],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Draft not found" });
    return undefined;
  }
  return rows[0] as Row;
}

// ── PDF export ────────────────────────────────────────────────────────────────

function exportDraftPdf(draft: Row, settings: Record<string, string | null>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 60 });
  doc.on("data", (c: Buffer) => chunks.push(c));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const firmName = settings.firm_name || "Legal Practice";
  const firmAddr = settings.firm_address || "";
  const firmPhone = settings.firm_phone || "";
  const firmEmail = settings.firm_email || "";

  // Letterhead
  doc.font("Helvetica-Bold").fontSize(14).text(firmName, { align: "center" });
  if (firmAddr) doc.font("Helvetica").fontSize(10).text(firmAddr, { align: "center" });
  const contact = [firmPhone, firmEmail].filter(Boolean).join("  |  ");
  if (contact) doc.font("Helvetica").fontSize(10).text(contact, { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke();
  doc.moveDown(1);

  // Date + title
  const dateStr = new Date().toLocaleDateString("en-MY", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.font("Helvetica").fontSize(10).text(dateStr, { align: "right" });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(13).text(String(draft.title), { align: "left" });
  doc.moveDown(1);

  // Body — render markdown-lite
  const lines = String(draft.content ?? "").split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { doc.moveDown(0.4); continue; }
    if (line.startsWith("# ")) {
      doc.font("Helvetica-Bold").fontSize(13).text(line.slice(2).trim());
    } else if (line.startsWith("## ")) {
      doc.font("Helvetica-Bold").fontSize(12).text(line.slice(3).trim());
    } else if (line.startsWith("**") && line.endsWith("**")) {
      doc.font("Helvetica-Bold").fontSize(11).text(line.slice(2, -2).trim());
    } else {
      doc.font("Helvetica").fontSize(11).text(line, { align: "justify" });
    }
    doc.moveDown(0.3);
  }

  // Footer
  doc
    .fontSize(9)
    .fillColor("#666666")
    .text(
      `Generated by ${PORTAL_PRACTICE[draft.portal as Portal] ? `${String(draft.portal).toUpperCase()} Portal` : "Legal Practice"} — Version ${draft.version_number}`,
      60,
      doc.page.height - 50,
      { align: "center" },
    );

  doc.end();
  }); // close Promise constructor
}

// ── DOCX export ───────────────────────────────────────────────────────────────

async function exportDraftDocx(
  draft: Row,
  settings: Record<string, string | null>,
): Promise<Buffer> {
  const { buildLandOfficeDocx } = await import("../utils/docxExport.js");
  const firmName = settings.firm_name || "Legal Practice";
  const firmAddr = settings.firm_address || "";
  return buildLandOfficeDocx({
    title: String(draft.title),
    content: `**${firmName}**\n${firmAddr}\n\n${String(draft.content ?? "")}`,
    docType: "firm",
    dateStr: new Date().toLocaleDateString("en-MY", {
      day: "2-digit", month: "long", year: "numeric",
    }),
  });
}

// ── Route attachment ──────────────────────────────────────────────────────────

export function attachDraftWorkspace(opts: {
  router: IRouter;
  portal: Portal;
  pathPrefix?: string;
  getOwnerKey: GetOwnerKey;
}): void {
  const { router, portal, getOwnerKey } = opts;
  const P = opts.pathPrefix ?? "";

  const authKey = (req: Request, res: Response): string | null => {
    const k = getOwnerKey(req, res);
    if (!k) res.status(401).json({ error: "Not authenticated" });
    return k;
  };

  // ── AI letter generation (auth FIRST, then aiRateLimit) ──────────────────

  router.post(`${P}/letters/generate`, async (req: Request, res: Response, next) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    aiRateLimit(req, res, next);
  }, async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) return;

    const b = (req.body ?? {}) as Record<string, unknown>;
    const letterType = typeof b.letterType === "string" ? b.letterType : "status_update";
    const language = b.language === "bm" ? "bm" : "en";
    const clientName = typeof b.clientName === "string" ? b.clientName.slice(0, 200) : "";
    const matterTitle = typeof b.matterTitle === "string" ? b.matterTitle.slice(0, 500) : "";
    const details = typeof b.details === "string" ? b.details.slice(0, 2000) : "";

    const typeDef = LETTER_TYPES.find((t) => t.id === letterType);
    const typeLabel = typeDef?.label ?? "Status Update to Client";
    const practice = PORTAL_PRACTICE[portal] ?? "Malaysian legal practice";

    const letterheadSettings = await getLetterheadSettings(portal, ownerKey);
    const firmName = letterheadSettings.firm_name || "Peguam & Co";

    const langInstruction =
      language === "bm"
        ? "Write the letter entirely in formal Bahasa Malaysia with proper legal Malay phrasing."
        : "Write the letter in formal English. Include Malay legal terms where standard Malaysian practice requires them.";

    const prompt = `You are a senior Malaysian lawyer drafting a professional client letter. Write a complete, polished, print-ready letter.

FIRM: ${firmName}
LETTER TYPE: ${typeLabel}
PRACTICE AREA: ${practice}
CLIENT NAME: ${clientName || "(client)"}
MATTER: ${matterTitle || "(matter description)"}
ADDITIONAL DETAILS PROVIDED BY LAWYER: ${details || "(none)"}

INSTRUCTIONS:
1. Begin with the date and client's address block (use "Client's Address" placeholder if unknown).
2. Write a clear subject line in bold ("**Re: [matter]**").
3. ${langInstruction}
4. Use formal Malaysian legal letter conventions (salutation "Dear [Client]", closing "Yours faithfully").
5. Tailor the body to the letter type (${typeLabel}).
6. Keep the tone professional but clear — avoid legalese the client cannot understand.
7. End with a signature block: "${firmName}" with lines for name, designation, date.
8. Use markdown formatting: **bold** for headings/subject, plain paragraphs for body.
9. Do NOT fabricate specific legal citations unless they are universally correct.
10. Output ONLY the letter — no preamble, no commentary.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 4096 },
      });
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      logger.error({ err, portal }, "letter generation failed");
      res.write(`data: ${JSON.stringify({ error: "Letter generation failed. Please try again." })}\n\n`);
      res.end();
    }
  });

  // ── Letter types list ────────────────────────────────────────────────────

  router.get(`${P}/letters/types`, (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    res.json({ letterTypes: LETTER_TYPES });
  });

  // ── List drafts (owner-level) ─────────────────────────────────────────────

  router.get(`${P}/drafts/list`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const q = req.query as Record<string, unknown>;
    const conds = [`d.portal = $1`, `d.owner_key = $2`];
    const vals: unknown[] = [portal, ownerKey];
    const add = (c: string, v: unknown) => { vals.push(v); conds.push(c.replace("?", `$${vals.length}`)); };
    if (q.matterId) { const id = parseInt(String(q.matterId), 10); if (!Number.isNaN(id)) add(`d.matter_id = ?`, id); }
    if (q.kind === "letter" || q.kind === "draft") add(`d.kind = ?`, q.kind);
    if (typeof q.q === "string" && q.q.trim()) add(`d.title ILIKE ?`, `%${q.q.trim()}%`);
    // Return only the latest version of each root (or all, if showVersions=1)
    const showVersions = q.showVersions === "1";
    const versionFilter = showVersions
      ? ""
      : `AND d.version_number = (SELECT MAX(v2.version_number) FROM case_drafts v2 WHERE v2.root_id = d.root_id)`;
    const { rows } = await pool.query(
      `SELECT d.* FROM case_drafts d WHERE ${conds.join(" AND ")} ${versionFilter}
       ORDER BY d.updated_at DESC, d.id DESC LIMIT 200`,
      vals,
    );
    res.json({ drafts: rows, letterTypes: LETTER_TYPES });
  });

  // ── Create draft (root or new version) ───────────────────────────────────

  router.post(`${P}/drafts`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, MAX_TITLE) : "";
    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    const content = typeof b.content === "string" ? b.content : "";
    if (content.length > MAX_CONTENT) { res.status(413).json({ error: "content too large" }); return; }

    let matterId: number | null = null;
    if (b.matterId != null) {
      const id = parseInt(String(b.matterId), 10);
      if (!Number.isNaN(id) && id > 0) {
        if (!(await verifyMatterOwnership(portal, id, ownerKey))) {
          res.status(404).json({ error: "Matter not found" }); return;
        }
        matterId = id;
      }
    }

    const kind = b.kind === "letter" ? "letter" : "draft";
    const letterType = kind === "letter" && typeof b.letterType === "string" ? b.letterType : null;
    const language = b.language === "bm" ? "bm" : "en";
    const notes = typeof b.notes === "string" ? b.notes.slice(0, 5000) : null;

    // Versioning: if rootId provided and it belongs to this owner, create a new version.
    // Use an advisory lock (keyed on root_id) so concurrent saves cannot allocate
    // the same version number — avoids a gap/duplicate under race conditions.
    let rootId: number | null = null;
    let versionNumber = 1;

    const client = await pool.connect();
    let resultRow: Row;
    try {
      await client.query("BEGIN");

      if (b.rootId != null) {
        const rid = parseInt(String(b.rootId), 10);
        if (!Number.isNaN(rid) && rid > 0) {
          // Lock the root row to serialise concurrent version inserts.
          const { rows: locked } = await client.query(
            `SELECT root_id FROM case_drafts
             WHERE id = $1 AND portal = $2 AND owner_key = $3
             FOR UPDATE`,
            [rid, portal, ownerKey],
          );
          if (locked[0]) {
            const { rows: rv } = await client.query(
              `SELECT MAX(version_number) AS latest FROM case_drafts WHERE root_id = $1`,
              [rid],
            );
            rootId = rid;
            versionNumber = Number(rv[0]?.latest ?? 0) + 1;
          }
        }
      }

      const { rows } = await client.query(
        `INSERT INTO case_drafts
           (portal, owner_key, matter_id, root_id, version_number, kind, letter_type, language, title, content, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [portal, ownerKey, matterId, rootId, versionNumber, kind, letterType, language, title, content, notes],
      );
      const row = rows[0] as Row;

      // If this is the first version, set root_id = self.id atomically.
      if (!rootId) {
        const { rows: r2 } = await client.query(
          `UPDATE case_drafts SET root_id = id WHERE id = $1 RETURNING *`,
          [row.id],
        );
        resultRow = r2[0] as Row;
      } else {
        resultRow = row;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json(resultRow!);
  });

  // ── Get one draft ─────────────────────────────────────────────────────────

  router.get(`${P}/drafts/:draftId`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    res.json(draft);
  });

  // ── Version history ───────────────────────────────────────────────────────

  router.get(`${P}/drafts/:draftId/versions`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    const { rows } = await pool.query(
      `SELECT * FROM case_drafts WHERE root_id = $1 AND portal = $2 AND owner_key = $3
       ORDER BY version_number`,
      [draft.root_id ?? draft.id, portal, ownerKey],
    );
    res.json({ versions: rows, rootId: draft.root_id ?? draft.id });
  });

  // ── Rename / update notes ─────────────────────────────────────────────────

  router.patch(`${P}/drafts/:draftId`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [draft.id];
    const push = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (typeof b.title === "string" && b.title.trim()) push("title", b.title.trim().slice(0, MAX_TITLE));
    if (typeof b.notes === "string") push("notes", b.notes.slice(0, 5000));
    if (typeof b.content === "string") {
      if (b.content.length > MAX_CONTENT) { res.status(413).json({ error: "content too large" }); return; }
      push("content", b.content);
    }
    if (sets.length === 0) { res.json(draft); return; }
    const { rows } = await pool.query(
      `UPDATE case_drafts SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
      vals,
    );
    res.json(rows[0]);
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  router.delete(`${P}/drafts/:draftId`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    await pool.query(`DELETE FROM case_drafts WHERE id = $1`, [draft.id]);
    res.json({ success: true });
  });

  // ── Export PDF ────────────────────────────────────────────────────────────

  router.get(`${P}/drafts/:draftId/export/pdf`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    const settings = await getLetterheadSettings(portal, ownerKey);
    try {
      const buf = await exportDraftPdf(draft, settings);
      const fname = String(draft.title).replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 80);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fname}-v${draft.version_number}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(buf);
    } catch (err) {
      logger.error({ err, portal }, "draft PDF export failed");
      res.status(500).json({ error: "Export failed" });
    }
  });

  // ── Export DOCX ───────────────────────────────────────────────────────────

  router.get(`${P}/drafts/:draftId/export/docx`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const draft = await ownedDraft(portal, ownerKey, (req.params as Record<string, string>).draftId, res);
    if (!draft) return;
    const settings = await getLetterheadSettings(portal, ownerKey);
    try {
      const buf = await exportDraftDocx(draft, settings);
      const fname = String(draft.title).replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 80);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fname}-v${draft.version_number}.docx"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(buf);
    } catch (err) {
      logger.error({ err, portal }, "draft DOCX export failed");
      res.status(500).json({ error: "Export failed" });
    }
  });

  // ── Matter-level draft list ───────────────────────────────────────────────

  router.get(`${P}/:matterId/drafts`, async (req: Request, res: Response) => {
    const ownerKey = authKey(req, res);
    if (!ownerKey) return;
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) { res.status(400).json({ error: "Invalid matter id" }); return; }
    if (!(await verifyMatterOwnership(portal, matterId, ownerKey))) {
      res.status(404).json({ error: "Matter not found" }); return;
    }
    // Return latest version of each root draft for this matter.
    const { rows } = await pool.query(
      `SELECT d.* FROM case_drafts d
       WHERE d.portal = $1 AND d.owner_key = $2 AND d.matter_id = $3
         AND d.version_number = (SELECT MAX(v2.version_number) FROM case_drafts v2 WHERE v2.root_id = d.root_id)
       ORDER BY d.updated_at DESC, d.id DESC`,
      [portal, ownerKey, matterId],
    );
    res.json({ drafts: rows, letterTypes: LETTER_TYPES });
  });
}
