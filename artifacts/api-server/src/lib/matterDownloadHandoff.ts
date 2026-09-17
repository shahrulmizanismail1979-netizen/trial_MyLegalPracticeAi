import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Request, Response, RequestHandler } from "express";

const COOKIE = "matter_download";
const TTL = 60_000;
const OPEN_PATH = /^\/api\/[a-z-]+\/matters\/\d+\/case-home\/(?:documents|saved-work)\/\d+\/open$/;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Download handoff requires SESSION_SECRET");
  return createHash("sha256").update(`matter-download-v1:${secret}`).digest();
}

/** Called only AFTER the normal owner and matter/file linkage checks. */
export function issueMatterDownload(req: Request, res: Response): void {
  const path = req.originalUrl.split("?")[0];
  if (!OPEN_PATH.test(path)) {
    res.status(400).json({ error: "Unsupported download path" });
    return;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(path));
  const payload = JSON.stringify({
    expires: Date.now() + TTL,
    authorization: req.headers.authorization,
    master: req.header("x-master-code"),
  });
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (token.length > 3500) {
    res.status(400).json({ error: "Authentication is too large for a download handoff" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.cookie(COOKIE, token, {
    httpOnly: true, secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict", path, maxAge: TTL,
  });
  res.json({ url: `${path}?download=1` });
}

/**
 * Restore only the authenticated headers, before existing auth middleware.
 * No storage key or credentials enter a URL. The encrypted cookie is bound to
 * one exact file endpoint, expires quickly, and works across server instances.
 * Normal session cookies and all live authorization checks remain in force.
 */
export const restoreMatterDownload: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" || req.query.download !== "1" || !OPEN_PATH.test(req.path)) return next();
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const token = req.cookies?.[COOKIE];
    if (typeof token !== "string" || token.length > 3500) throw new Error("Missing handoff");
    const bytes = Buffer.from(token, "base64url");
    // Node's decoder accepts ignored characters and non-zero padding bits.
    // Accept only the exact encoding we issue, not alternate spellings of it.
    if (bytes.length <= 28 || bytes.toString("base64url") !== token) {
      throw new Error("Invalid handoff encoding");
    }
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(req.path));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(bytes.subarray(28)), decipher.final(),
    ]).toString());
    if (!Number.isFinite(payload.expires) || payload.expires <= Date.now() ||
        payload.expires > Date.now() + TTL) throw new Error("Expired handoff");
    // Navigation cannot carry these headers itself. Do not accept a conflicting
    // identity from the navigation request.
    delete req.headers.authorization;
    delete req.headers["x-master-code"];
    if (typeof payload.authorization === "string") req.headers.authorization = payload.authorization;
    if (typeof payload.master === "string") req.headers["x-master-code"] = payload.master;
    next();
  } catch {
    res.status(401).json({ error: "Download link expired. Open the file again from the matter." });
  }
};