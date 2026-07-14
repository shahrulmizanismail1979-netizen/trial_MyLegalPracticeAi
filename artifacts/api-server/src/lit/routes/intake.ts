import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import {
  litIntakeRecords,
  litMatters,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";

const router: IRouter = Router();

function getAccessCodeId(req: Request): number | undefined {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) return undefined;
  return sess.accessCodeId as number | undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessCodeId = getAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as unknown as Request & { accessCodeId: number }).accessCodeId = accessCodeId;
  next();
}

router.use(requireAuth);

const MAX_NOTES = 20_000;

// Normalise a name for fuzzy-ish comparison: lowercase, strip common entity
// suffixes/punctuation/honorifics, collapse whitespace.
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(sdn\.?\s*bhd\.?|berhad|bhd\.?|plt|enterprise|trading|holdings?)\b/g, "")
    .replace(/\b(bin|binti|a\/l|a\/p|s\/o|d\/o|dato'?|datin|tan sri|tun|haji|hajjah|mr|mrs|ms|encik|puan)\b/g, "")
    .replace(/[.,'"()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter((t) => t.length >= 3));
}

// Two names "match" if one normalised string contains the other, or they share
// at least two significant (3+ char) tokens. Deliberately over-inclusive — a
// conflict screen should surface possibles for a human to clear.
function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared >= 2;
}

interface ConflictMatch {
  name: string;
  matchedAgainst: string;
  source: "matter" | "intake";
  role: string;
  reference: string | null;
}

// Screen a set of subject names (the prospective client + adverse/connected
// parties) against the caller's existing matters and prior intake records.
async function screenConflicts(
  accessCodeId: number,
  subjects: string[],
): Promise<ConflictMatch[]> {
  const subj = subjects.map((s) => s.trim()).filter(Boolean);
  if (subj.length === 0) return [];

  const matters = await db
    .select()
    .from(litMatters)
    .where(eq(litMatters.accessCodeId, accessCodeId));
  const intakes = await db
    .select()
    .from(litIntakeRecords)
    .where(eq(litIntakeRecords.accessCodeId, accessCodeId));

  const matches: ConflictMatch[] = [];
  const seen = new Set<string>();

  const consider = (
    name: string | null | undefined,
    source: "matter" | "intake",
    role: string,
    reference: string | null,
  ) => {
    if (!name || !name.trim()) return;
    for (const s of subj) {
      if (namesMatch(s, name)) {
        const key = `${source}|${role}|${name}|${s}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ name, matchedAgainst: s, source, role, reference });
      }
    }
  };

  for (const m of matters) {
    const ref = m.suitNo || m.title;
    consider(m.clientName, "matter", "existing client", ref);
    consider(m.plaintiff, "matter", "plaintiff", ref);
    consider(m.defendant, "matter", "defendant", ref);
  }
  for (const it of intakes) {
    consider(it.clientName, "intake", "prior intake — client", it.clientName);
    if (it.adverseParties) {
      for (const line of it.adverseParties.split("\n")) {
        consider(line, "intake", "prior intake — adverse party", it.clientName);
      }
    }
  }
  return matches;
}

router.post("/conflict-check", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const { clientName, adverseParties } = req.body ?? {};
  const subjects: string[] = [];
  if (typeof clientName === "string") subjects.push(clientName);
  if (typeof adverseParties === "string") {
    for (const line of adverseParties.split("\n")) if (line.trim()) subjects.push(line);
  }
  if (Array.isArray(req.body?.parties)) {
    for (const p of req.body.parties) if (typeof p === "string" && p.trim()) subjects.push(p);
  }
  const matches = await screenConflicts(accessCodeId, subjects);
  res.json({
    status: matches.length === 0 ? "clear" : "potential",
    matches,
    screened: subjects.map((s) => s.trim()).filter(Boolean),
  });
}); 

// ── Intake record CRUD ───────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const rows = await db
    .select()
    .from(litIntakeRecords)
    .where(eq(litIntakeRecords.accessCodeId, accessCodeId))
    .orderBy(desc(litIntakeRecords.updatedAt));
  res.json(rows);
});

async function getOwnedRecord(req: Request, res: Response, idParam: string) {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid record id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(litIntakeRecords)
    .where(and(eq(litIntakeRecords.id, id), eq(litIntakeRecords.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Record not found" });
    return undefined;
  }
  return row;
}

router.get("/:id", async (req, res) => {
  const row = await getOwnedRecord(req, res, (req.params.id as string));
  if (!row) return;
  res.json(row);
});

function normaliseBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of ["clientName", "clientType", "idNumber", "contact", "actingFor", "sourceOfFunds", "pep", "riskRating", "conflictStatus", "status"]) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  for (const f of ["matterDescription", "adverseParties", "amlaNotes", "notes"]) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, MAX_NOTES);
  }
  if (body.conflictMatches !== undefined) out.conflictMatches = body.conflictMatches ?? null;
  return out;
}

router.post("/", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const data = normaliseBody(req.body ?? {});
  if (!data.clientName || typeof data.clientName !== "string" || !data.clientName.trim()) {
    res.status(400).json({ error: "clientName is required" });
    return;
  }
  const [row] = await db
    .insert(litIntakeRecords)
    .values({ ...(data as object), accessCodeId, clientName: (data.clientName as string).trim() })
    .returning();
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const record = await getOwnedRecord(req, res, (req.params.id as string));
  if (!record) return;
  const data = normaliseBody(req.body ?? {});
  const [row] = await db
    .update(litIntakeRecords)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(litIntakeRecords.id, record.id))
    .returning();
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const record = await getOwnedRecord(req, res, (req.params.id as string));
  if (!record) return;
  await db.delete(litIntakeRecords).where(eq(litIntakeRecords.id, record.id));
  res.json({ success: true });
});

export default router;
